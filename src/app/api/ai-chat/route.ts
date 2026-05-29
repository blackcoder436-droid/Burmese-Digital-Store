import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { getAuthUser } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';
import { sanitizeString } from '@/lib/security';
import { generateCustomerAgentReply } from '@/modules/ai-ops/service';
import AiChatSession from '@/models/AiChatSession';

function mapAiError(error: unknown): { status: number; message: string } {
  const message = error instanceof Error ? error.message : String(error || 'Unknown error');

  if (message.includes('AI_API_KEY is not configured')) {
    return {
      status: 503,
      message: 'AI assistant is not configured. Please contact support.',
    };
  }

  if (message.includes('AI API error (429)')) {
    return {
      status: 429,
      message: 'AI service quota reached. Please try again in a minute.',
    };
  }

  if (message.includes('AI API error (401)') || message.includes('AI API error (403)')) {
    return {
      status: 503,
      message: 'AI assistant authentication failed. Please contact support.',
    };
  }

  return {
    status: 500,
    message: 'AI assistant is temporarily unavailable. Please try again later.',
  };
}

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

    const result = await generateCustomerAgentReply({
      channel: 'website',
      sessionId,
      message,
      userId,
      page,
      metadata: {
        userAgent: request.headers.get('user-agent')?.slice(0, 500),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        message: result.reply,
        sessionId: result.sessionId,
        source: result.source,
      },
    });
  } catch (error) {
    console.error('[AI Chat] Error:', error);
    const mapped = mapAiError(error);
    return NextResponse.json(
      {
        success: false,
        error: mapped.message,
      },
      { status: mapped.status }
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
