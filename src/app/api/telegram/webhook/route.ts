import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import { answerCallbackQuery, editTelegramMessage } from '@/lib/telegram';
import { webhookLimiter } from '@/lib/rateLimit';
import { createLogger } from '@/lib/logger';
import { approveOrder, rejectOrder } from '@/lib/order-actions';

const log = createLogger({ route: '/api/telegram/webhook' });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * Verify that the webhook request is from Telegram
 * Uses a secret token set when registering the webhook
 */
function verifyTelegramRequest(request: NextRequest): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    // If no secret configured, verify by checking bot token presence
    return !!BOT_TOKEN;
  }
  const headerSecret = request.headers.get('x-telegram-bot-api-secret-token');
  return headerSecret === secret;
}

// POST /api/telegram/webhook — Noti bot callback handler (web order approve/reject)
export async function POST(request: NextRequest) {
  // Rate limit to prevent brute-force or replay attacks
  const limited = await webhookLimiter(request);
  if (limited) return limited;

  if (!verifyTelegramRequest(request)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  try {
    const body = await request.json();

    // Handle callback_query (inline keyboard button presses)
    const callbackQuery = body.callback_query;
    if (!callbackQuery) {
      return NextResponse.json({ ok: true });
    }

    const callbackData: string = callbackQuery.data || '';
    if (!callbackData.startsWith('approve_order:') && !callbackData.startsWith('reject_order:')) {
      await answerCallbackQuery(callbackQuery.id, '❓ Unknown action');
      return NextResponse.json({ ok: true });
    }

    return handleWebOrderCallback(callbackQuery);
  } catch (error) {
    log.error('Telegram webhook error', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Always return 200 to Telegram to prevent retries
    return NextResponse.json({ ok: true });
  }
}

// ─────────────────────────────────────────────
// Web-order approve/reject handler (unchanged)
// ─────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleWebOrderCallback(callbackQuery: any) {
  const callbackData: string = callbackQuery.data || '';
  const callbackQueryId: string = callbackQuery.id;
  const messageId: number = callbackQuery.message?.message_id;
  const originalText: string = callbackQuery.message?.text || '';
  const telegramUser = callbackQuery.from?.first_name || 'Admin';

  // Parse callback data
  const [action, orderId] = callbackData.split(':');

  if (!orderId || (action !== 'approve_order' && action !== 'reject_order')) {
    await answerCallbackQuery(callbackQueryId, '❓ Unknown action');
    return NextResponse.json({ ok: true });
  }

  await connectDB();

  const order = await Order.findById(orderId);
  if (!order) {
    await answerCallbackQuery(callbackQueryId, '❌ Order not found');
    return NextResponse.json({ ok: true });
  }

  // Check if already processed
  if (order.status === 'completed' || order.status === 'rejected') {
    await answerCallbackQuery(callbackQueryId, `⚠️ Order already ${order.status}`);
    if (messageId) {
      await editTelegramMessage(messageId, originalText + `\n\n⚠️ Already ${order.status}`);
    }
    return NextResponse.json({ ok: true });
  }

  if (action === 'approve_order') {
    const result = await approveOrder(orderId, {
      adminId: 'telegram',
      adminName: telegramUser,
      source: 'noti-bot',
    });

    if (!result.success) {
      await answerCallbackQuery(callbackQueryId, `❌ ${result.error}`);
      return NextResponse.json({ ok: true });
    }

    // Update Telegram message
    if (messageId) {
      const updatedText = originalText.replace('⏳ Awaiting approval...', '').trim();
      await editTelegramMessage(
        messageId,
        updatedText + `\n\n✅ <b>APPROVED</b> by ${telegramUser}`
      );
    }

    await answerCallbackQuery(callbackQueryId, `✅ Order ${order.orderNumber} approved!`);
    log.info('Order approved via Telegram', { orderId: order._id, orderNumber: order.orderNumber });

  } else if (action === 'reject_order') {
    const result = await rejectOrder(orderId, {
      adminId: 'telegram',
      adminName: telegramUser,
      source: 'noti-bot',
      rejectReason: `Rejected via Telegram by ${telegramUser}`,
    });

    if (!result.success) {
      await answerCallbackQuery(callbackQueryId, `❌ ${result.error}`);
      return NextResponse.json({ ok: true });
    }

    // Update Telegram message
    if (messageId) {
      const updatedText = originalText.replace('⏳ Awaiting approval...', '').trim();
      await editTelegramMessage(
        messageId,
        updatedText + `\n\n❌ <b>REJECTED</b> by ${telegramUser}`
      );
    }

    await answerCallbackQuery(callbackQueryId, `❌ Order ${order.orderNumber} rejected`);
    log.info('Order rejected via Telegram', { orderId: order._id, orderNumber: order.orderNumber });
  }

  return NextResponse.json({ ok: true });
}
