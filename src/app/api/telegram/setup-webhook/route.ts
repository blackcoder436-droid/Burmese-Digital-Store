import { NextRequest, NextResponse } from 'next/server';
import { setWebhook, deleteWebhook, getWebhookInfo } from '@/lib/telegram-bot/api';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/telegram/setup-webhook' });

/**
 * GET /api/telegram/setup-webhook
 * Check current webhook status
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const info = await getWebhookInfo();
    return NextResponse.json({ ok: true, webhook: info });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

/**
 * POST /api/telegram/setup-webhook
 * Set or delete the webhook
 *
 * Body:
 *   { "action": "set" }    → sets webhook to {APP_URL}/api/telegram/webhook
 *   { "action": "delete" } → deletes webhook
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const action = body.action || 'set';

    if (action === 'delete') {
      const result = await deleteWebhook();
      log.info('Webhook deleted', { result });
      return NextResponse.json({ ok: true, action: 'deleted', result });
    }

    // Set webhook
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
    if (!appUrl) {
      return NextResponse.json(
        { ok: false, error: 'APP_URL or NEXT_PUBLIC_APP_URL not configured' },
        { status: 400 }
      );
    }

    const webhookUrl = `${appUrl}/api/telegram/bot/webhook`;
    const webhookSecret = process.env.TELEGRAM_VPN_WEBHOOK_SECRET || process.env.TELEGRAM_WEBHOOK_SECRET;

    const result = await setWebhook(webhookUrl, webhookSecret);

    log.info('Webhook set', { webhookUrl, result });
    return NextResponse.json({ ok: true, action: 'set', webhookUrl, result });
  } catch (error) {
    log.error('Setup webhook error', { error: String(error) });
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
