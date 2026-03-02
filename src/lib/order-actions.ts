// ==========================================
// Shared Order Actions — Approve / Reject
// Single source of truth for all 3 paths:
//   1. Web admin panel  (/api/admin/orders PATCH)
//   2. Noti bot channel (/api/telegram/webhook approve_order/reject_order)
//   3. VPN bot          (bot_approve_/bot_reject_ callbacks)
//
// Every path calls the same functions so side-effects are identical:
//   ✅ VPN provisioning / product key delivery
//   ✅ Web notification bell (createNotification)
//   ✅ Telegram bot message to buyer
//   ✅ Activity log
//   ✅ Quarantine release/delete
//   ✅ VPN key revocation on reject/refund
//   ✅ Referral reward on approve
// ==========================================

import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import User from '@/models/User';
import { createNotification } from '@/models/Notification';
import { provisionVpnKey, revokeVpnKey } from '@/lib/xui';
import { getPlan } from '@/lib/vpn-plans';
import { getServer } from '@/lib/vpn-servers';
import { releaseFromQuarantine, deleteFromQuarantine } from '@/lib/quarantine';
import { logActivity, type ActivityAction } from '@/models/ActivityLog';
import { createLogger } from '@/lib/logger';
import { Types } from 'mongoose';

const log = createLogger({ module: 'order-actions' });

// VPN bot token (for sending messages to bot users)
const VPN_BOT_TOKEN = process.env.TELEGRAM_VPN_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;

/**
 * Send a message via the VPN bot to a Telegram user
 * (Standalone helper so this module doesn't import from telegram-bot/api which uses different module scope)
 */
async function sendBotMessage(chatId: number | string, text: string): Promise<boolean> {
  if (!VPN_BOT_TOKEN) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${VPN_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });
    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

// ─── Types ──────────────────────────────────────────

export interface ApproveResult {
  success: boolean;
  error?: string;
  order?: InstanceType<typeof Order>;
}

export interface RejectResult {
  success: boolean;
  error?: string;
  order?: InstanceType<typeof Order>;
}

export interface OrderActionContext {
  /** Who performed the action: admin userId, 'telegram', or 'bot-auto' */
  adminId: string;
  /** Human-readable name for logs */
  adminName: string;
  /** Which path triggered this: 'web' | 'noti-bot' | 'vpn-bot' | 'auto-approve' */
  source: 'web' | 'noti-bot' | 'vpn-bot' | 'auto-approve';
  /** Optional admin note */
  adminNote?: string;
  /** Optional verification checklist (web admin) */
  verificationChecklist?: Record<string, boolean>;
}

// ─── APPROVE ────────────────────────────────────────

/**
 * Approve an order — unified handler for all paths.
 * Provisions VPN key or delivers product keys, then fires all side-effects.
 */
export async function approveOrder(
  orderId: string,
  ctx: OrderActionContext
): Promise<ApproveResult> {
  try {
    await connectDB();

    const order = await Order.findById(orderId);
    if (!order) return { success: false, error: 'Order not found' };

    // Idempotency: already completed
    if (order.status === 'completed') {
      return { success: true, order, error: 'Order already completed' };
    }
    if (order.status === 'rejected') {
      return { success: false, error: 'Order already rejected' };
    }

    // ── VPN ORDER ──
    if (order.orderType === 'vpn' && order.vpnPlan) {
      // Idempotency guard: already provisioned
      if (order.vpnProvisionStatus === 'provisioned' && order.vpnKey?.clientUUID) {
        log.warn('VPN already provisioned, skipping duplicate', { orderId: order._id });
        order.status = 'completed';
        if (ctx.adminNote) order.adminNote = ctx.adminNote;
        await order.save();
      } else {
        const plan = getPlan(order.vpnPlan.planId);
        const server = await getServer(order.vpnPlan.serverId);

        if (!plan || !server) {
          return { success: false, error: 'Invalid VPN plan or server configuration' };
        }

        const user = await User.findById(order.user)
          .select('name email telegramUsername')
          .lean() as { name?: string; email?: string; telegramUsername?: string } | null;
        const username = user?.telegramUsername || user?.name || user?.email?.split('@')[0] || '';

        log.info('Provisioning VPN key', {
          orderId: order._id,
          serverId: order.vpnPlan.serverId,
          source: ctx.source,
        });

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
          order.vpnProvisionStatus = 'failed';
          await order.save();

          logActivitySafe(ctx.adminId, 'vpn_provision_failed', `VPN Order #${order._id.toString().slice(-8)}`, {
            details: `Failed to provision (${ctx.source})`,
            metadata: { orderId: order._id, serverId: order.vpnPlan.serverId },
          });

          return { success: false, error: 'VPN key provisioning failed. Check server connectivity.' };
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
        order.status = 'completed';
        if (ctx.adminNote) order.adminNote = ctx.adminNote;
        await order.save();
      }

    } else {
      // ── PRODUCT ORDER ──
      const product = await Product.findById(order.product);
      if (!product) {
        return { success: false, error: 'Product not found' };
      }

      const keysToDeliver = product.details
        .filter((d: { sold: boolean }) => !d.sold)
        .slice(0, order.quantity);

      if (keysToDeliver.length < order.quantity) {
        return { success: false, error: `Not enough stock (${keysToDeliver.length}/${order.quantity})` };
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
      order.status = 'completed';
      if (ctx.adminNote) order.adminNote = ctx.adminNote;
      await order.save();
    }

    // ── Save verification checklist ──
    if (ctx.verificationChecklist) {
      order.verificationChecklist = {
        ...ctx.verificationChecklist,
        completedAt: new Date(),
        completedBy: Types.ObjectId.isValid(ctx.adminId) ? new Types.ObjectId(ctx.adminId) : undefined,
      };
      await order.save();
    }

    // ── Quarantine: release screenshot ──
    if (order.paymentScreenshot && !order.paymentScreenshot.startsWith('telegram:')) {
      const relPath = order.paymentScreenshot.startsWith('/')
        ? order.paymentScreenshot.slice(1)
        : order.paymentScreenshot;
      await releaseFromQuarantine(relPath).catch(() => {});
    }

    // ── Side-effects (all non-blocking) ──
    await Promise.allSettled([
      // 1. Web notification bell
      createNotification({
        user: order.user,
        type: 'order_completed',
        title: 'Order completed',
        message: `Your order ${order.orderNumber} has been completed.`,
        orderId: order._id,
      }),

      // 2. Telegram bot message to buyer (if user has telegramId)
      notifyBotUser(order, 'approved'),

      // 3. Activity log
      logActivitySafe(ctx.adminId, 'order_approved', `Order #${order.orderNumber}`, {
        details: `Approved via ${ctx.source} by ${ctx.adminName}`,
        metadata: { orderId: order._id, amount: order.totalAmount },
      }),

      // 4. Referral reward
      processReferralRewardSafe(order.user, order._id),
    ]);

    log.info('Order approved', { orderId: order._id, source: ctx.source, adminName: ctx.adminName });
    return { success: true, order };
  } catch (error) {
    log.error('approveOrder error', {
      orderId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: 'Internal error during approval' };
  }
}

// ─── REJECT ─────────────────────────────────────────

/**
 * Reject an order — unified handler for all paths.
 * Revokes VPN key if provisioned, fires all side-effects.
 */
export async function rejectOrder(
  orderId: string,
  ctx: OrderActionContext & { rejectReason?: string }
): Promise<RejectResult> {
  try {
    await connectDB();

    const order = await Order.findById(orderId);
    if (!order) return { success: false, error: 'Order not found' };

    if (order.status === 'completed' || order.status === 'rejected') {
      return { success: false, error: `Order already ${order.status}` };
    }

    // ── Revoke VPN key if provisioned ──
    if (
      order.orderType === 'vpn' &&
      order.vpnProvisionStatus === 'provisioned' &&
      order.vpnKey?.clientEmail &&
      order.vpnPlan?.serverId
    ) {
      try {
        const revoked = await revokeVpnKey(order.vpnPlan.serverId, order.vpnKey.clientEmail);
        if (revoked) {
          order.vpnProvisionStatus = 'revoked';
          log.info('VPN key revoked on reject', { orderId: order._id, clientEmail: order.vpnKey.clientEmail });
        }
      } catch (err) {
        log.error('Failed to revoke VPN key', {
          orderId: order._id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    order.status = 'rejected';
    order.rejectReason = ctx.rejectReason || `Rejected via ${ctx.source} by ${ctx.adminName}`;
    if (ctx.adminNote) order.adminNote = ctx.adminNote;
    await order.save();

    // ── Quarantine: delete screenshot ──
    if (order.paymentScreenshot && !order.paymentScreenshot.startsWith('telegram:')) {
      const relPath = order.paymentScreenshot.startsWith('/')
        ? order.paymentScreenshot.slice(1)
        : order.paymentScreenshot;
      await deleteFromQuarantine(relPath).catch(() => {});
    }

    // ── Side-effects (all non-blocking) ──
    await Promise.allSettled([
      // 1. Web notification bell
      createNotification({
        user: order.user,
        type: 'order_rejected',
        title: 'Order rejected',
        message: `Your order ${order.orderNumber} was rejected.${ctx.rejectReason ? ` Reason: ${ctx.rejectReason}` : ''}`,
        orderId: order._id,
      }),

      // 2. Telegram bot message to buyer
      notifyBotUser(order, 'rejected'),

      // 3. Activity log
      logActivitySafe(ctx.adminId, 'order_rejected', `Order #${order.orderNumber}`, {
        details: `Rejected via ${ctx.source} by ${ctx.adminName}${ctx.rejectReason ? ` — ${ctx.rejectReason}` : ''}`,
        metadata: { orderId: order._id },
      }),
    ]);

    log.info('Order rejected', { orderId: order._id, source: ctx.source, adminName: ctx.adminName });
    return { success: true, order };
  } catch (error) {
    log.error('rejectOrder error', {
      orderId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: 'Internal error during rejection' };
  }
}

// ─── HELPERS ────────────────────────────────────────

/**
 * Notify the buyer via Telegram VPN bot if they have a telegramId
 */
async function notifyBotUser(
  order: InstanceType<typeof Order>,
  action: 'approved' | 'rejected'
): Promise<void> {
  try {
    const user = await User.findById(order.user).select('telegramId').lean() as { telegramId?: number } | null;
    if (!user?.telegramId) return;

    if (action === 'approved') {
      await sendBotMessage(
        user.telegramId,
        `✅ Order ${order.orderNumber} အတည်ပြုပြီးပါပြီ!\n\n🔑 VPN Key ကို အောက်မှာ ကြည့်ပါ 👇`
      );

      // Send key details if VPN order
      if (order.vpnKey && order.vpnPlan) {
        const plan = getPlan(order.vpnPlan.planId);
        const server = await getServer(order.vpnPlan.serverId);
        const expiryDate = new Date(order.vpnKey.expiryTime).toLocaleDateString('en-GB', {
          year: 'numeric', month: 'short', day: 'numeric',
        });

        const keyMsg =
          `🔑 <b>${plan?.name || 'VPN Key'}</b>\n\n` +
          `🌐 Server: ${server ? `${server.flag} ${server.name}` : 'Unknown'}\n` +
          `⚙️ Protocol: ${order.vpnKey.protocol?.toUpperCase()}\n` +
          `📅 Expires: ${expiryDate}\n\n` +
          `📋 <b>Subscription Link:</b>\n<code>${order.vpnKey.subLink}</code>\n\n` +
          `⚙️ <b>Config Link:</b>\n<code>${order.vpnKey.configLink}</code>\n\n` +
          `📲 V2RayNG/Hiddify app မှာ Sub Link ကို add ပါ`;

        await sendBotMessage(user.telegramId, keyMsg);
      }

      // Send product keys if product order
      if (order.deliveredKeys && order.deliveredKeys.length > 0) {
        let keyMsg = `🔑 <b>Your Product Keys</b>\n\n`;
        for (const key of order.deliveredKeys) {
          if (key.serialKey) keyMsg += `Serial: <code>${key.serialKey}</code>\n`;
          if (key.loginEmail) keyMsg += `Email: <code>${key.loginEmail}</code>\n`;
          if (key.loginPassword) keyMsg += `Password: <code>${key.loginPassword}</code>\n`;
          if (key.additionalInfo) keyMsg += `Info: ${key.additionalInfo}\n`;
          keyMsg += `\n`;
        }
        await sendBotMessage(user.telegramId, keyMsg);
      }
    } else {
      await sendBotMessage(
        user.telegramId,
        `❌ Order ${order.orderNumber} ကို ငြင်းပယ်ပါပြီ\n\n` +
        (order.rejectReason ? `📝 အကြောင်းပြချက်: ${order.rejectReason}\n\n` : '') +
        `📞 ပြဿနာရှိပါက @BurmeseDigitalStore သို့ ဆက်သွယ်ပါ`
      );
    }
  } catch (err) {
    log.warn('Failed to notify bot user', {
      orderId: order._id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Safe activity logger — never throws
 */
async function logActivitySafe(
  adminId: string,
  action: ActivityAction,
  target: string,
  opts?: { details?: string; metadata?: Record<string, unknown> }
): Promise<void> {
  try {
    await logActivity({
      admin: adminId,
      action,
      target,
      details: opts?.details,
      metadata: opts?.metadata,
    });
  } catch {
    // non-blocking
  }
}

/**
 * Safe referral reward processor — never throws
 */
async function processReferralRewardSafe(
  userId: unknown,
  orderId: unknown
): Promise<void> {
  try {
    const { processReferralReward } = await import('@/lib/telegram-bot/handlers/referral');
    await processReferralReward(userId as Types.ObjectId, orderId as Types.ObjectId);
  } catch {
    // non-blocking — referral module may not be loaded
  }
}
