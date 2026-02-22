import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { requireAdmin } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';
import { sanitizeString } from '@/lib/security';
import {
  callAiApi,
  callAiApiStream,
  getAdminSystemPrompt,
  parseAiCommands,
} from '@/lib/ai-chat';
import type { AiMessage } from '@/lib/ai-chat';
import AiChatSession from '@/models/AiChatSession';
import { getAllServers, getServer } from '@/lib/vpn-servers';
import VpnServerModel from '@/models/VpnServer';
import Order from '@/models/Order';
import User from '@/models/User';
import { invalidateServerCache } from '@/lib/vpn-servers';

// Rate limit: 30 messages per minute for admins
const adminChatLimiter = rateLimit({ windowMs: 60000, maxRequests: 30, prefix: 'ai-admin-chat' });

// ==========================================
// POST /api/admin/ai-chat — Admin AI Chat + Server Control
// ==========================================

export async function POST(request: NextRequest) {
  if (process.env.AI_CHAT_ENABLED !== 'true') {
    return NextResponse.json(
      { success: false, error: 'AI chat is not enabled' },
      { status: 503 }
    );
  }

  // Admin auth required
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const limited = await adminChatLimiter(request);
  if (limited) return limited;

  try {
    const body = await request.json();
    const message = sanitizeString(body.message || '').slice(0, 4000);
    const sessionId = sanitizeString(body.sessionId || '').slice(0, 64);
    const executeCommands = body.executeCommands === true;
    const stream = body.stream === true;

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      );
    }

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Find or create admin session
    let session = await AiChatSession.findOne({ sessionId, context: 'admin' });

    if (!session) {
      session = new AiChatSession({
        sessionId,
        user: admin.userId,
        context: 'admin',
        messages: [],
      });
    }

    // Add user message
    session.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date(),
    });

    // Build context with real-time server data
    const servers = await getAllServers();
    const serverStatus = Object.values(servers)
      .map((s) => `${s.id}: ${s.name} ${s.flag} - ${s.online ? '🟢 Online' : '🔴 Offline'} - ${s.enabled ? 'Enabled' : 'Disabled'}`)
      .join('\n');

    // Get quick stats
    const [totalUsers, todayOrders, pendingOrders] = await Promise.all([
      User.countDocuments(),
      Order.countDocuments({
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      }),
      Order.countDocuments({ status: 'pending' }),
    ]);

    const contextInfo = `
## Current Server Status (Real-time):
${serverStatus}

## Quick Stats:
- Total Users: ${totalUsers}
- Today's Orders: ${todayOrders}
- Pending Orders: ${pendingOrders}
`;

    const systemPrompt = getAdminSystemPrompt() + contextInfo;
    const aiMessages: AiMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    const recentMessages = session.messages.slice(-20);
    for (const msg of recentMessages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        aiMessages.push({ role: msg.role, content: msg.content });
      }
    }

    if (stream) {
      try {
        const aiStream = await callAiApiStream({
          messages: aiMessages,
          temperature: 0.5,
          maxTokens: 2048,
        });

        let fullContent = '';
        const decoder = new TextDecoder();

        const transformedStream = new TransformStream({
          transform(chunk, controller) {
            const text = decoder.decode(chunk, { stream: true });
            const lines = text.split('\n');
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
                try {
                  const parsed = JSON.parse(trimmed.slice(6));
                  if (parsed.content) fullContent += parsed.content;
                } catch { /* skip */ }
              }
            }
            controller.enqueue(chunk);
          },
          async flush() {
            if (fullContent) {
              try {
                session.messages.push({
                  role: 'assistant',
                  content: fullContent,
                  timestamp: new Date(),
                });
                await session.save();

                // Auto-execute commands if requested
                if (executeCommands) {
                  const commands = parseAiCommands(fullContent);
                  for (const cmd of commands) {
                    await executeServerCommand(cmd);
                  }
                }
              } catch (err) {
                console.error('[Admin AI] Failed to save response:', err);
              }
            }
          },
        });

        const readableStream = aiStream.pipeThrough(transformedStream);

        return new Response(readableStream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        });
      } catch (error) {
        console.error('[Admin AI] Stream error:', error);
      }
    }

    // Non-streaming response
    const aiResponse = await callAiApi({
      messages: aiMessages,
      temperature: 0.5,
      maxTokens: 2048,
    });

    // Parse commands from response
    const commands = parseAiCommands(aiResponse);
    const commandResults: Array<{ action: string; success: boolean; result?: string }> = [];

    // Execute commands if requested
    if (executeCommands && commands.length > 0) {
      for (const cmd of commands) {
        const result = await executeServerCommand(cmd);
        commandResults.push(result);
      }
    }

    // Save assistant response
    session.messages.push({
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date(),
    });
    await session.save();

    return NextResponse.json({
      success: true,
      data: {
        message: aiResponse,
        sessionId: session.sessionId,
        commands: commands.length > 0 ? commands : undefined,
        commandResults: commandResults.length > 0 ? commandResults : undefined,
      },
    });
  } catch (error) {
    console.error('[Admin AI Chat] Error:', error);
    return NextResponse.json(
      { success: false, error: 'AI assistant error' },
      { status: 500 }
    );
  }
}

// ==========================================
// Execute Server Commands
// ==========================================

async function executeServerCommand(cmd: {
  action: string;
  target: string;
  params: Record<string, unknown>;
}): Promise<{ action: string; success: boolean; result?: string }> {
  try {
    switch (cmd.action) {
      case 'server_status': {
        if (cmd.target === 'all') {
          const servers = await getAllServers();
          const statuses = Object.values(servers).map(
            (s) => `${s.id}: ${s.name} ${s.flag} - ${s.online ? 'Online' : 'Offline'} - ${s.enabled ? 'Enabled' : 'Disabled'}`
          );
          return { action: cmd.action, success: true, result: statuses.join('\n') };
        }
        const server = await getServer(cmd.target);
        if (!server) return { action: cmd.action, success: false, result: `Server ${cmd.target} not found` };
        return {
          action: cmd.action,
          success: true,
          result: `${server.name} ${server.flag}: ${server.online ? 'Online' : 'Offline'}, ${server.enabled ? 'Enabled' : 'Disabled'}`,
        };
      }

      case 'server_enable': {
        await connectDB();
        const result = await VpnServerModel.updateOne(
          { serverId: cmd.target },
          { $set: { enabled: true } }
        );
        invalidateServerCache();
        return {
          action: cmd.action,
          success: result.modifiedCount > 0,
          result: result.modifiedCount > 0
            ? `Server ${cmd.target} enabled successfully`
            : `Server ${cmd.target} not found or already enabled`,
        };
      }

      case 'server_disable': {
        await connectDB();
        const result = await VpnServerModel.updateOne(
          { serverId: cmd.target },
          { $set: { enabled: false } }
        );
        invalidateServerCache();
        return {
          action: cmd.action,
          success: result.modifiedCount > 0,
          result: result.modifiedCount > 0
            ? `Server ${cmd.target} disabled successfully`
            : `Server ${cmd.target} not found or already disabled`,
        };
      }

      case 'analytics_summary': {
        await connectDB();
        const now = new Date();
        const todayStart = new Date(now.setHours(0, 0, 0, 0));
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const [todayOrders, weekOrders, pendingOrders, totalRevenue, totalUsers] = await Promise.all([
          Order.countDocuments({ createdAt: { $gte: todayStart } }),
          Order.countDocuments({ createdAt: { $gte: weekAgo } }),
          Order.countDocuments({ status: 'pending' }),
          Order.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } },
          ]),
          User.countDocuments(),
        ]);

        const revenue = totalRevenue[0]?.total || 0;
        return {
          action: cmd.action,
          success: true,
          result: `Today: ${todayOrders} orders | This Week: ${weekOrders} orders | Pending: ${pendingOrders} | Total Revenue: ${revenue.toLocaleString()} MMK | Users: ${totalUsers}`,
        };
      }

      default:
        return { action: cmd.action, success: false, result: `Unknown action: ${cmd.action}` };
    }
  } catch (error) {
    return {
      action: cmd.action,
      success: false,
      result: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
