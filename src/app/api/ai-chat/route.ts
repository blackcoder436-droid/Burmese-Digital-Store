import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { getAuthUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';
import { sanitizeString } from '@/lib/security';
import { callAiApiStream, callAiApi, getCustomerSystemPrompt } from '@/lib/ai-chat';
import AiChatSession from '@/models/AiChatSession';
import type { AiMessage } from '@/lib/ai-chat';

// Rate limit: 20 messages per minute per IP
const chatLimiter = rateLimit({ windowMs: 60000, maxRequests: 20, prefix: 'ai-chat' });

// ==========================================
// POST /api/ai-chat — Customer AI Chat
// ==========================================

export async function POST(request: NextRequest) {
  // Check if AI chat is enabled
  if (process.env.AI_CHAT_ENABLED !== 'true') {
    return NextResponse.json(
      { success: false, error: 'AI chat is not enabled' },
      { status: 503 }
    );
  }

  // Rate limit
  const limited = await chatLimiter(request);
  if (limited) return limited;

  try {
    const body = await request.json();
    const message = sanitizeString(body.message || '').slice(0, 2000);
    const sessionId = sanitizeString(body.sessionId || '').slice(0, 64);
    const stream = body.stream === true;
    const page = sanitizeString(body.page || '').slice(0, 200);

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

    // Optional auth (chat works for guests too)
    const user = await getAuthUser();
    const userId = user?.userId || null;

    await connectDB();

    // Find or create session
    let session = await AiChatSession.findOne({ sessionId });

    if (!session) {
      session = new AiChatSession({
        sessionId,
        user: userId,
        context: 'customer',
        messages: [],
        metadata: {
          userAgent: request.headers.get('user-agent')?.slice(0, 500),
          page,
        },
      });
    }

    // Check message limit
    if (session.messages.length >= 96) {
      return NextResponse.json(
        { success: false, error: 'Chat session limit reached. Please start a new conversation.' },
        { status: 400 }
      );
    }

    // Add user message
    session.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date(),
    });

    // Build conversation for AI
    const systemPrompt = getCustomerSystemPrompt();
    const aiMessages: AiMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Include last 20 messages for context (to keep tokens manageable)
    const recentMessages = session.messages.slice(-20);
    for (const msg of recentMessages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        aiMessages.push({ role: msg.role, content: msg.content });
      }
    }

    if (stream) {
      // Streaming response
      try {
        const aiStream = await callAiApiStream({
          messages: aiMessages,
          temperature: 0.7,
          maxTokens: 1024,
        });

        // Collect streamed content for saving to DB
        let fullContent = '';
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        const transformedStream = new TransformStream({
          transform(chunk, controller) {
            const text = decoder.decode(chunk, { stream: true });
            // Extract content from SSE data
            const lines = text.split('\n');
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
                try {
                  const parsed = JSON.parse(trimmed.slice(6));
                  if (parsed.content) {
                    fullContent += parsed.content;
                  }
                } catch {
                  // skip
                }
              }
            }
            controller.enqueue(chunk);
          },
          async flush() {
            // Save assistant response to DB after stream completes
            if (fullContent) {
              try {
                session.messages.push({
                  role: 'assistant',
                  content: fullContent,
                  timestamp: new Date(),
                });
                await session.save();
              } catch (err) {
                console.error('[AI Chat] Failed to save streamed response:', err);
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
        console.error('[AI Chat] Stream error:', error);
        // Fallback to non-streaming
      }
    }

    // Non-streaming response
    const aiResponse = await callAiApi({
      messages: aiMessages,
      temperature: 0.7,
      maxTokens: 1024,
    });

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
      },
    });
  } catch (error) {
    console.error('[AI Chat] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'AI assistant is temporarily unavailable. Please try again later.',
      },
      { status: 500 }
    );
  }
}

// ==========================================
// GET /api/ai-chat — Get chat history
// ==========================================

export async function GET(request: NextRequest) {
  if (process.env.AI_CHAT_ENABLED !== 'true') {
    return NextResponse.json(
      { success: false, error: 'AI chat is not enabled' },
      { status: 503 }
    );
  }

  const sessionId = request.nextUrl.searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json(
      { success: false, error: 'Session ID is required' },
      { status: 400 }
    );
  }

  await connectDB();

  const session = await AiChatSession.findOne({
    sessionId: sanitizeString(sessionId).slice(0, 64),
  }).select('messages sessionId context createdAt');

  if (!session) {
    return NextResponse.json({
      success: true,
      data: { messages: [], sessionId },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      messages: session.messages.map((m: { role: string; content: string; timestamp: Date }) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      })),
      sessionId: session.sessionId,
    },
  });
}
