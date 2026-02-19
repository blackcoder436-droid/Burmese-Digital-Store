import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/admin/telegram-webhook' });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

// GET /api/admin/telegram-webhook — Check current webhook status
export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();

    if (!BOT_TOKEN) {
      return NextResponse.json({ success: false, error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 400 });
    }

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const data = await res.json();

    if (!data.ok) {
      return NextResponse.json({ success: false, error: data.description }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        url: data.result.url || null,
        hasCustomCertificate: data.result.has_custom_certificate,
        pendingUpdateCount: data.result.pending_update_count,
        lastErrorDate: data.result.last_error_date ? new Date(data.result.last_error_date * 1000).toISOString() : null,
        lastErrorMessage: data.result.last_error_message || null,
      },
    });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: 'Failed to check webhook' }, { status: 500 });
  }
}

// POST /api/admin/telegram-webhook — Register/update Telegram webhook
export async function POST(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();

    if (!BOT_TOKEN) {
      return NextResponse.json({ success: false, error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 400 });
    }
    if (!APP_URL) {
      return NextResponse.json({ success: false, error: 'NEXT_PUBLIC_APP_URL not configured' }, { status: 400 });
    }

    const webhookUrl = `${APP_URL}/api/telegram/webhook`;

    const body: Record<string, unknown> = {
      url: webhookUrl,
      allowed_updates: ['callback_query'],
      drop_pending_updates: true,
    };

    if (WEBHOOK_SECRET) {
      body.secret_token = WEBHOOK_SECRET;
    }

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!data.ok) {
      log.error('Failed to set Telegram webhook', { error: data.description });
      return NextResponse.json({ success: false, error: data.description }, { status: 500 });
    }

    log.info('Telegram webhook set', { url: webhookUrl });

    return NextResponse.json({
      success: true,
      data: { webhookUrl },
      message: 'Webhook registered successfully',
    });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    log.error('Set webhook error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false, error: 'Failed to set webhook' }, { status: 500 });
  }
}

// DELETE /api/admin/telegram-webhook — Remove Telegram webhook
export async function DELETE(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();

    if (!BOT_TOKEN) {
      return NextResponse.json({ success: false, error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 400 });
    }

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: '', drop_pending_updates: true }),
    });

    const data = await res.json();

    if (!data.ok) {
      return NextResponse.json({ success: false, error: data.description }, { status: 500 });
    }

    log.info('Telegram webhook removed');
    return NextResponse.json({ success: true, message: 'Webhook removed' });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: 'Failed to remove webhook' }, { status: 500 });
  }
}
