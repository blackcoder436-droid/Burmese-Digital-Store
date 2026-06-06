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
import { provisionVpnKey, revokeVpnKey, type CreateClientResult } from '@/lib/xui';
import { getPlan } from '@/lib/vpn-plans';
import { getServer, getEnabledServers } from '@/lib/vpn-servers';
import { releaseFromQuarantine, deleteFromQuarantine } from '@/lib/quarantine';
import { logActivity, type ActivityAction } from '@/models/ActivityLog';
import { createLogger } from '@/lib/logger';
import { editTelegramCaption, editTelegramMessage } from '@/lib/telegram';
import { getAvailableProductStock, getProductFulfillmentMode } from '@/lib/product-stock';
import { Types } from 'mongoose';

const log = createLogger({ module: 'order-actions' });

// VPN bot token (for sending messages to bot users)
const VPN_BOT_TOKEN = process.env.TELEGRAM_VPN_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;

/**
 * Send a message via the VPN bot to a Telegram user
 * (Standalone helper so this module doesn't import from telegram-bot/api which uses different module scope)
 */
async function sendBotMessage(chatId: number | string, text: string): Promise<boolean> {
  if (!VPN_BOT_TOKEN) {
    log.warn('VPN bot token missing; cannot notify Telegram user', { chatId });
    return false;
  }
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
    if (!data.ok) {
      log.warn('Telegram sendBotMessage failed', { chatId, error: data.description });
      return false;
    }
    return true;
  } catch (error) {
    log.error('Telegram sendBotMessage error', {
      chatId,
      error: error instanceof Error ? error.message : String(error),
    });
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
  /** Optional manual delivery text shown to the customer for non-VPN orders */
  deliveryMessage?: string;
  /** Optional verification checklist (web admin) */
  verificationChecklist?: Record<string, boolean>;
}

async function getTelegramUserId(orderUserId: unknown): Promise<number | null> {
  try {
    const user = await User.findById(orderUserId).select('telegramId').lean() as { telegramId?: number } | null;
    return user?.telegramId || null;
  } catch {
    return null;
  }
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
      const hasMultiServerKey = Boolean(
        order.multiSubToken &&
        Array.isArray(order.vpnKeys) &&
        order.vpnKeys.length >= 1
      );

      if (order.vpnProvisionStatus === 'provisioned' && order.vpnKey?.clientUUID && hasMultiServerKey) {
        log.warn('VPN already provisioned, skipping duplicate', { orderId: order._id });
        order.status = 'completed';
        if (ctx.adminNote) order.adminNote = ctx.adminNote;
        await order.save();
      } else {
        const legacySingleKey =
          order.vpnProvisionStatus === 'provisioned' &&
          !hasMultiServerKey &&
          order.vpnKey?.clientEmail &&
          order.vpnPlan?.serverId
            ? { serverId: order.vpnPlan.serverId, clientEmail: order.vpnKey.clientEmail }
            : null;

        const plan = getPlan(order.vpnPlan.planId);
        const server = await getServer(order.vpnPlan.serverId); // fallback/primary server
        const requestedProtocol = order.vpnPlan.protocol || 'trojan';
        const enabledServers = (await getEnabledServers())
          .filter((srv) => srv.enabledProtocols.includes(requestedProtocol));

        if (!plan || !server || enabledServers.length === 0) {
          return { success: false, error: 'Invalid VPN plan or no enabled servers' };
        }

        if (enabledServers.length === 0) {
          return {
            success: false,
            error: `Multi-server VPN requires at least 1 enabled server with ${requestedProtocol.toUpperCase()} support.`,
          };
        }

        const user = await User.findById(order.user)
          .select('name email telegramUsername')
          .lean() as { name?: string; email?: string; telegramUsername?: string } | null;
        const username = user?.telegramUsername || user?.name || user?.email?.split('@')[0] || '';

        log.info('Provisioning VPN key across multiple servers', {
          orderId: order._id,
          primaryServer: order.vpnPlan.serverId,
          servers: enabledServers.map((s) => s.id),
          protocol: requestedProtocol,
          source: ctx.source,
        });

        const vpnKeysArr: Array<{
          serverId: string;
          clientEmail: string;
          clientUUID: string;
          subId: string;
          subLink: string;
          configLink: string;
          protocol: string;
        }> = [];
        let firstResult: CreateClientResult | null = null;
        let anySuccess = false;

        for (const srv of enabledServers) {
          try {
            const result = await provisionVpnKey({
              serverId: srv.id,
              username,
              userId: order.user.toString(),
              devices: plan.devices,
              expiryDays: plan.expiryDays,
              dataLimitGB: plan.dataLimitGB,
              protocol: requestedProtocol,
            });

            if (result) {
              anySuccess = true;
              if (!firstResult) firstResult = result;
              vpnKeysArr.push({
                serverId: srv.id,
                clientEmail: result.clientEmail,
                clientUUID: result.clientUUID,
                subId: result.subId,
                subLink: result.subLink,
                configLink: result.configLink,
                protocol: result.protocol,
              });
            }
          } catch (err) {
            log.error(`Failed to provision VPN on server ${srv.id}`, { orderId: order._id, err });
          }
        }

        if (!anySuccess || !firstResult || vpnKeysArr.length < 2) {
          for (const key of vpnKeysArr) {
            try {
              await revokeVpnKey(key.serverId, key.clientEmail);
            } catch (revokeErr) {
              log.warn('Failed to clean up partial multi-server key', {
                orderId: order._id,
                serverId: key.serverId,
                error: revokeErr instanceof Error ? revokeErr.message : String(revokeErr),
              });
            }
          }

          order.vpnProvisionStatus = 'failed';
          await order.save();

          logActivitySafe(ctx.adminId, 'vpn_provision_failed', `VPN Order #${order._id.toString().slice(-8)}`, {
            details: `Failed to provision multi-server key (${ctx.source})`,
            metadata: { orderId: order._id, successCount: vpnKeysArr.length, targetCount: enabledServers.length },
          });

          return {
            success: false,
            error: 'VPN key provisioning failed to create a multi-server key. At least 2 servers must succeed.',
          };
        }

        // Generate a cryptographically random token for the multi-server subscription link
        const crypto = await import('crypto');
        const token = crypto.randomBytes(16).toString('hex');

        order.vpnKey = {
          clientEmail: firstResult.clientEmail,
          clientUUID: firstResult.clientUUID,
          subId: firstResult.subId,
          subLink: firstResult.subLink,
          configLink: firstResult.configLink,
          protocol: firstResult.protocol,
          expiryTime: firstResult.expiryTime,
          provisionedAt: new Date(),
        };
        order.vpnKeys = vpnKeysArr;
        order.multiSubToken = token;
        order.vpnProvisionStatus = 'provisioned';
        order.status = 'completed';
        if (ctx.adminNote) order.adminNote = ctx.adminNote;
        await order.save();

        if (legacySingleKey) {
          revokeVpnKey(legacySingleKey.serverId, legacySingleKey.clientEmail).catch((revokeErr) => {
            log.warn('Failed to revoke legacy single-server key after multi-server reprovision', {
              orderId: order._id,
              serverId: legacySingleKey.serverId,
              error: revokeErr instanceof Error ? revokeErr.message : String(revokeErr),
            });
          });
        }
      }

    } else {
      // ── PRODUCT ORDER ──
      const product = await Product.findById(order.product);
      if (!product) {
        return { success: false, error: 'Product not found' };
      }

      const manualDeliveryMessage = ctx.deliveryMessage?.trim();
      const fulfillmentMode = getProductFulfillmentMode(product);
      const productDetails = Array.isArray(product.details) ? product.details : [];
      const availableKeys = productDetails
        .filter((d: { sold: boolean }) => !d.sold);

      if (fulfillmentMode === 'manual') {
        if (!manualDeliveryMessage) {
          return { success: false, error: 'Delivery info is required for this manual-fulfillment product' };
        }

        const availableStock = getAvailableProductStock(product);
        if (availableStock < order.quantity) {
          return { success: false, error: `Not enough stock (${availableStock}/${order.quantity})` };
        }

        product.stock = Math.max(0, availableStock - order.quantity);
        await product.save();
        order.deliveredKeys = [{
          additionalInfo: manualDeliveryMessage,
        }];
      } else {
        const keysToDeliver = availableKeys.slice(0, order.quantity);

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
          stock: productDetails.filter((d: { sold: boolean }) => !d.sold).length,
        });

        order.deliveredKeys = keysToDeliver.map((k: { serialKey?: string; loginEmail?: string; loginPassword?: string; additionalInfo?: string }) => ({
          serialKey: k.serialKey,
          loginEmail: k.loginEmail,
          loginPassword: k.loginPassword,
          additionalInfo: k.additionalInfo,
        }));
      }
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

      // 2b. Telegram admin/channel message for website order approval flow
      finalizeTelegramOrderMessage(order, 'approved', ctx.adminName),

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
    if (order.orderType === 'vpn' && order.vpnProvisionStatus === 'provisioned') {
      try {
        if (order.vpnKeys && order.vpnKeys.length > 0) {
          // Multi-server revoke
          let anyRevoked = false;
          for (const key of order.vpnKeys) {
            try {
              const success = await revokeVpnKey(key.serverId, key.clientEmail || order.vpnKey!.clientEmail);
              if (success) anyRevoked = true;
            } catch (err) {
              log.error(`Failed to revoke VPN key on ${key.serverId}`, { orderId: order._id, err });
            }
          }
          if (anyRevoked) {
            order.vpnProvisionStatus = 'revoked';
          }
        } else if (order.vpnKey?.clientEmail && order.vpnPlan?.serverId) {
          // Fallback traditional single-server revoke
          const revoked = await revokeVpnKey(order.vpnPlan.serverId, order.vpnKey.clientEmail);
          if (revoked) {
            order.vpnProvisionStatus = 'revoked';
            log.info('VPN key revoked on reject', { orderId: order._id, clientEmail: order.vpnKey.clientEmail });
          }
        }
      } catch (err) {
        log.error('Failed to revoke VPN keys', {
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

      // 2b. Telegram admin/channel message for website order rejection flow
      finalizeTelegramOrderMessage(order, 'rejected', ctx.adminName, ctx.rejectReason),

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
export async function notifyBotUser(
  order: InstanceType<typeof Order>,
  action: 'approved' | 'rejected' | 'pending' | 'verifying'
): Promise<void> {
  try {
    const telegramId = await getTelegramUserId(order.user);
    if (!telegramId) return;

    if (action === 'approved') {
      const typeText = order.orderType === 'vpn' ? 'VPN Key' : 'Product Keys';
      await sendBotMessage(
        telegramId,
        `✅ Order ${order.orderNumber} အတည်ပြုပြီးပါပြီ!\n\n🔑 ${typeText} ကို အောက်မှာ ကြည့်ပါ 👇`
      );

      // Send key details if VPN order
      if (order.vpnKey && order.vpnPlan) {
        const plan = getPlan(order.vpnPlan.planId);
        const server = await getServer(order.vpnPlan.serverId);
        const expiryDate = new Date(order.vpnKey.expiryTime).toLocaleDateString('en-GB', {
          year: 'numeric', month: 'short', day: 'numeric',
        });
          
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://burmesedigital.store';
          const multiSubUrl = order.multiSubToken ? `${appUrl}/api/vpn/sub/${order.multiSubToken}` : order.vpnKey.subLink;
          const subLabel = order.multiSubToken ? 'Subscription Link (Multi-Server)' : 'Subscription Link';

          const keyMsg =
            `🔑 <b>${plan?.name || 'VPN Key'}</b>\n\n` +
            `🌐 Server: ${order.multiSubToken ? 'All Enabled Servers' : (server ? `${server.flag} ${server.name}` : 'Unknown')}\n` +
            `⚙️ Protocol: ${order.vpnKey.protocol?.toUpperCase()}\n` +
            `📅 Expires: ${expiryDate}\n\n` +
            `📋 <b>${subLabel}:</b>\n<code>${multiSubUrl}</code>\n\n` +
            `📲 V2RayNG/Hiddify app မှာ Sub Link ကို add ပါ`;
          await sendBotMessage(telegramId, keyMsg);
        } else if (order.deliveredKeys?.length > 0) {
          let keyMsg = `🔑 <b>Your Product Keys</b>\n\n`;
        for (const key of order.deliveredKeys) {
          if (key.serialKey) keyMsg += `Serial: <code>${key.serialKey}</code>\n`;
          if (key.loginEmail) keyMsg += `Email: <code>${key.loginEmail}</code>\n`;
          if (key.loginPassword) keyMsg += `Password: <code>${key.loginPassword}</code>\n`;
          if (key.additionalInfo) keyMsg += `Info: ${key.additionalInfo}\n`;
          keyMsg += `\n`;
        }
        await sendBotMessage(telegramId, keyMsg);
      }
    } else if (action === 'pending' || action === 'verifying') {
      const message =
        action === 'pending'
          ? `⏳ Order ${order.orderNumber} က pending review အခြေအနေမှာ ရှိနေပါသေးတယ်။\n\nသင့် payment မပြီးသေးရင် အခုဘဲ ငွေလွှဲပြီး screenshot ပို့ပေးပါ။\nပြီးသွားပြီးသားဆိုရင် admin စစ်ဆေးနေပါပြီ — ခဏစောင့်ပေးပါ။`
          : `⏳ Order ${order.orderNumber} ကို payment verify လုပ်နေဆဲပါ။\n\nPayment မပြီးသေးရင် အခုဘဲ ငွေလွှဲပြီး screenshot ပို့ပေးပါ။\nပြီးသွားပြီးသားဆိုရင် review ပြီးတာနဲ့ ဆက်လက်လုပ်ပေးပါမယ်။`;
      await sendBotMessage(telegramId, message);
    } else {
      await sendBotMessage(
        telegramId,
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
 * Update the Telegram admin/channel message for web orders so buttons disappear after action.
 */
async function finalizeTelegramOrderMessage(
  order: InstanceType<typeof Order>,
  action: 'approved' | 'rejected',
  adminName: string,
  rejectReason?: string
): Promise<void> {
  try {
    if (!order.telegramMessageId) return;

    const statusText =
      action === 'approved'
        ? `✅ <b>APPROVED</b> by ${adminName}`
        : `❌ <b>REJECTED</b> by ${adminName}${rejectReason ? `\n\n📝 ${rejectReason}` : ''}`;

    const photoEdited = await editTelegramCaption(order.telegramMessageId, statusText);
    if (photoEdited) return;

    await editTelegramMessage(order.telegramMessageId, statusText);
  } catch (err) {
    log.warn('Failed to finalize Telegram order message', {
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
