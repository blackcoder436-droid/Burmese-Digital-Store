import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import User from '@/models/User';
import { createNotification } from '@/models/Notification';
import { provisionVpnKey } from '@/lib/xui';
import { getPlan } from '@/lib/vpn-plans';
import { getServer } from '@/lib/vpn-servers';
import { releaseFromQuarantine } from '@/lib/quarantine';
import { logActivity } from '@/models/ActivityLog';
import { answerCallbackQuery, editTelegramMessage } from '@/lib/telegram';
import { webhookLimiter } from '@/lib/rateLimit';
import { createLogger } from '@/lib/logger';

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

// POST /api/telegram/webhook — Telegram Bot callback handler
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
      // Not a callback query — ignore other update types
      return NextResponse.json({ ok: true });
    }

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
      // ---- APPROVE ORDER ----
      const newStatus = 'completed';

      // VPN ORDER: provision key
      if (order.orderType === 'vpn' && order.vpnPlan) {
        if (order.vpnProvisionStatus === 'provisioned' && order.vpnKey?.clientUUID) {
          // Already provisioned
          order.status = newStatus;
          await order.save();
        } else {
          const plan = getPlan(order.vpnPlan.planId);
          const server = await getServer(order.vpnPlan.serverId);

          if (!plan || !server) {
            await answerCallbackQuery(callbackQueryId, '❌ Invalid VPN plan or server');
            return NextResponse.json({ ok: true });
          }

          const user = await User.findById(order.user).select('name email').lean() as { name?: string; email?: string } | null;
          const username = user?.name || user?.email?.split('@')[0] || '';

          const result = await provisionVpnKey({
            serverId: order.vpnPlan.serverId,
            username,
            userId: order.user.toString(),
            devices: plan.devices,
            expiryDays: plan.expiryDays,
            dataLimitGB: plan.dataLimitGB,
            protocol: order.vpnPlan.protocol || 'trojan',
          });

          if (!result) {
            await answerCallbackQuery(callbackQueryId, '❌ VPN provisioning failed! Check server.');
            order.vpnProvisionStatus = 'failed';
            await order.save();
            return NextResponse.json({ ok: true });
          }

          order.vpnKey = {
            clientEmail: result.clientEmail,
            clientUUID: result.clientUUID,
            subId: result.subId,
            subLink: result.subLink,
            configLink: result.configLink,
            protocol: result.protocol,
            expiryTime: result.expiryTime,
            provisionedAt: new Date(),
          };
          order.vpnProvisionStatus = 'provisioned';
          order.status = newStatus;
          await order.save();
        }
      } else {
        // PRODUCT ORDER: deliver keys from stock
        const product = await Product.findById(order.product);
        if (!product) {
          await answerCallbackQuery(callbackQueryId, '❌ Product not found');
          return NextResponse.json({ ok: true });
        }

        const keysToDeliver = product.details
          .filter((d: { sold: boolean }) => !d.sold)
          .slice(0, order.quantity);

        if (keysToDeliver.length < order.quantity) {
          await answerCallbackQuery(callbackQueryId, `❌ Not enough stock (${keysToDeliver.length}/${order.quantity})`);
          return NextResponse.json({ ok: true });
        }

        for (const key of keysToDeliver) {
          key.sold = true;
          key.soldTo = order.user;
          key.soldAt = new Date();
        }
        await product.save();

        await Product.findByIdAndUpdate(product._id, {
          stock: product.details.filter((d: { sold: boolean }) => !d.sold).length,
        });

        order.deliveredKeys = keysToDeliver.map((k: { serialKey?: string; loginEmail?: string; loginPassword?: string; additionalInfo?: string }) => ({
          serialKey: k.serialKey,
          loginEmail: k.loginEmail,
          loginPassword: k.loginPassword,
          additionalInfo: k.additionalInfo,
        }));
        order.status = newStatus;
        await order.save();
      }

      // Release quarantined screenshot
      if (order.paymentScreenshot) {
        const screenshotRelPath = order.paymentScreenshot.startsWith('/')
          ? order.paymentScreenshot.slice(1)
          : order.paymentScreenshot;
        await releaseFromQuarantine(screenshotRelPath);
      }

      // Notify user
      try {
        await createNotification({
          user: order.user,
          type: 'order_completed',
          title: 'Order completed',
          message: `Your order ${order.orderNumber} has been completed.`,
          orderId: order._id,
        });
      } catch { /* non-blocking */ }

      // Log activity
      try {
        await logActivity({
          admin: 'telegram',
          action: 'order_approved',
          target: `Order #${order.orderNumber}`,
          details: `Approved via Telegram by ${telegramUser}`,
          metadata: { orderId: order._id, amount: order.totalAmount },
        });
      } catch { /* non-blocking */ }

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
      // ---- REJECT ORDER ----
      order.status = 'rejected';
      order.rejectReason = `Rejected via Telegram by ${telegramUser}`;
      await order.save();

      // Notify user
      try {
        await createNotification({
          user: order.user,
          type: 'order_rejected',
          title: 'Order rejected',
          message: `Your order ${order.orderNumber} was rejected.`,
          orderId: order._id,
        });
      } catch { /* non-blocking */ }

      // Log activity
      try {
        await logActivity({
          admin: 'telegram',
          action: 'order_rejected',
          target: `Order #${order.orderNumber}`,
          details: `Rejected via Telegram by ${telegramUser}`,
          metadata: { orderId: order._id },
        });
      } catch { /* non-blocking */ }

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
  } catch (error) {
    log.error('Telegram webhook error', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Always return 200 to Telegram to prevent retries
    return NextResponse.json({ ok: true });
  }
}
