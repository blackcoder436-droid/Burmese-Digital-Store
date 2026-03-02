import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { webhookLimiter } from '@/lib/rateLimit';
import { createLogger } from '@/lib/logger';
import { processUpdate } from '@/lib/telegram-bot';

const log = createLogger({ route: '/api/telegram/bot/webhook' });

/**
 * Verify that the webhook request is from Telegram
 */
function verifyRequest(request: NextRequest): boolean {
  const secret = process.env.TELEGRAM_VPN_WEBHOOK_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    // If no secret configured, verify by checking bot token presence
    return !!(process.env.TELEGRAM_VPN_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN);
  }
  const headerSecret = request.headers.get('x-telegram-bot-api-secret-token');
  return headerSecret === secret;
}

// POST /api/telegram/bot/webhook — VPN Bot webhook handler
export async function POST(request: NextRequest) {
  const limited = await webhookLimiter(request);
  if (limited) return limited;

  if (!verifyRequest(request)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  try {
    const body = await request.json();

    await connectDB();
    await processUpdate(body);

    return NextResponse.json({ ok: true });
  } catch (error) {
    log.error('VPN bot webhook error', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Always return 200 to prevent Telegram retries
    return NextResponse.json({ ok: true });
  }
}
