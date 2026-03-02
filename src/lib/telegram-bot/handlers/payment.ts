// ==========================================
// Payment Screenshot & Auto-Approve Handlers
// Screenshot verification, OCR, auto-approve timer
// ==========================================

import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import User from '@/models/User';
import { sendMessage, sendPhoto, downloadFile, editMessageText } from '../api';
import { MSG } from '../messages';
import { approveRejectKeyboard, mainMenuKeyboard } from '../keyboards';
import { getSession, clearSession } from '../session';
import { provisionVpnKey } from '@/lib/xui';
import { getPlan } from '@/lib/vpn-plans';
import { getServer } from '@/lib/vpn-servers';
import { computeScreenshotHash, isDuplicateScreenshot } from '@/lib/fraud-detection';
import { extractPaymentInfo, verifyAmount } from '@/lib/ocr';
import { getSiteSettings, getFeatureFlag } from '@/models/SiteSettings';
import { processReferralReward } from './referral';
import { createLogger } from '@/lib/logger';
import type { TelegramPhotoSize } from '../types';
import path from 'path';
import fs from 'fs/promises';

const log = createLogger({ module: 'bot-payment' });

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

// Auto-approve timers (in-memory, keyed by orderId)
const autoApproveTimers = new Map<string, NodeJS.Timeout>();

/**
 * Handle photo message (payment screenshot)
 */
export async function handlePaymentScreenshot(
  chatId: number,
  telegramId: number,
  photo: TelegramPhotoSize[],
  firstName: string,
  username?: string
): Promise<void> {
  const session = getSession(telegramId);

  if (!session?.waitingScreenshot || !session.orderId) {
    await sendMessage(chatId, '📷 Screenshot ပို့ရန် အရင်ဆုံး Order တစ်ခုဖန်တီးပါ', {
      replyMarkup: mainMenuKeyboard(),
    });
    return;
  }

  await connectDB();

  const order = await Order.findById(session.orderId);
  if (!order || order.status !== 'pending') {
    await sendMessage(chatId, '❌ Order မတွေ့ပါ သို့မဟုတ် ပြီးဆုံးသွားပါပြီ');
    clearSession(telegramId);
    return;
  }

  await sendMessage(chatId, MSG.screenshotReceived);

  try {
    // Get largest photo
    const largest = photo[photo.length - 1];
    const fileBuffer = await downloadFile(largest.file_id);

    if (!fileBuffer) {
      await sendMessage(chatId, '❌ Screenshot ဒေါင်းလုဒ် မအောင်မြင်ပါ။ ပြန်လည်ပို့ပေးပါ');
      return;
    }

    // Compute screenshot hash for fraud detection
    const screenshotHash = computeScreenshotHash(fileBuffer);

    // Check duplicate screenshot
    const isDuplicate = await isDuplicateScreenshot(screenshotHash, order._id.toString());
    if (isDuplicate) {
      order.fraudFlags.push('duplicate_screenshot');
      order.requiresManualReview = true;
      order.reviewReason = 'Duplicate screenshot detected';
    }

    // Save screenshot temporarily for OCR
    const tempDir = path.join(process.cwd(), 'public', 'uploads', 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    const tempPath = path.join(tempDir, `bot_${telegramId}_${Date.now()}.jpg`);
    await fs.writeFile(tempPath, fileBuffer);

    // Run OCR
    let ocrMatch = false;
    const settings = await getSiteSettings();

    if (settings.ocrEnabled) {
      try {
        const ocrResult = await extractPaymentInfo(tempPath);
        const amountMatch = verifyAmount(ocrResult.amount, order.totalAmount, 100);

        order.ocrVerified = amountMatch;
        order.ocrExtractedData = {
          amount: ocrResult.amount || undefined,
          transactionId: ocrResult.transactionId || undefined,
          confidence: ocrResult.confidence,
        };

        ocrMatch = amountMatch;
      } catch (ocrError) {
        log.warn('OCR failed for bot screenshot', {
          error: ocrError instanceof Error ? ocrError.message : String(ocrError),
        });
      }
    }

    // Clean up temp file
    fs.unlink(tempPath).catch(() => {});

    // Update order with screenshot info
    order.paymentScreenshot = `telegram:${largest.file_id}`;
    order.telegramFileId = largest.file_id;
    order.screenshotHash = screenshotHash;
    order.status = 'verifying';
    await order.save();

    // Get plan and server info for admin notification
    const plan = getPlan(order.vpnPlan?.planId || '');
    const server = await getServer(order.vpnPlan?.serverId || '');

    // Send screenshot + notification to admin/channel
    const adminMessage = MSG.adminNewOrder({
      orderNumber: order.orderNumber,
      userName: `${firstName}${username ? ` (@${username})` : ''}`,
      planName: plan?.name || 'Unknown Plan',
      serverName: server ? `${server.flag} ${server.name}` : 'Unknown',
      protocol: order.vpnPlan?.protocol || 'trojan',
      amount: order.totalAmount,
      telegramId,
      ocrMatch,
    });

    const targetChat = CHANNEL_ID || ADMIN_CHAT_ID;
    if (targetChat) {
      // Send screenshot photo with admin buttons
      await sendPhoto(targetChat, largest.file_id, {
        caption: adminMessage,
        replyMarkup: approveRejectKeyboard(order._id.toString(), telegramId),
      });
    }

    // Tell user order is under review
    await sendMessage(chatId, MSG.orderPending, {
      replyMarkup: mainMenuKeyboard(),
    });

    // Auto-approve if OCR matched and feature enabled
    const autoApproveEnabled = await getFeatureFlag('auto_approve');
    if (ocrMatch && autoApproveEnabled && !order.requiresManualReview) {
      const delay = settings.autoApproveDelaySeconds || 100;
      scheduleAutoApprove(order._id.toString(), telegramId, delay);
    }

    clearSession(telegramId);

    log.info('Bot payment screenshot processed', {
      orderId: order._id,
      telegramId,
      ocrMatch,
      hasFraudFlags: order.fraudFlags.length > 0,
    });
  } catch (error) {
    log.error('Error processing payment screenshot', {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendMessage(chatId, MSG.error);
  }
}

/**
 * Schedule auto-approve for an order
 */
function scheduleAutoApprove(
  orderId: string,
  userId: number,
  delaySeconds: number
): void {
  // Cancel existing timer if any
  cancelAutoApprove(orderId);

  const timer = setTimeout(async () => {
    autoApproveTimers.delete(orderId);
    await executeAutoApprove(orderId, userId);
  }, delaySeconds * 1000);

  autoApproveTimers.set(orderId, timer);
  log.info('Auto-approve scheduled', { orderId, delaySeconds });
}

/**
 * Cancel auto-approve timer for an order
 */
export function cancelAutoApprove(orderId: string): void {
  const timer = autoApproveTimers.get(orderId);
  if (timer) {
    clearTimeout(timer);
    autoApproveTimers.delete(orderId);
  }
}

/**
 * Execute auto-approve: provision VPN key and notify user
 */
async function executeAutoApprove(orderId: string, userId: number): Promise<void> {
  try {
    await connectDB();

    // Atomic check — only approve if still verifying
    const order = await Order.findOneAndUpdate(
      { _id: orderId, status: 'verifying' },
      { $set: { status: 'completed' } },
      { new: true }
    );

    if (!order) {
      log.info('Auto-approve skipped (already processed)', { orderId });
      return;
    }

    // Provision VPN key
    const result = await provisionVpnKeyForOrder(order);
    if (!result) {
      // Revert status on failure
      await Order.updateOne({ _id: orderId }, { $set: { status: 'verifying' } });
      log.error('Auto-approve VPN provisioning failed', { orderId });
      return;
    }

    // Process referral reward
    await processReferralReward(order.user, order._id);

    // Notify user
    await sendMessage(userId, MSG.orderApproved(order.orderNumber));
    await sendVpnKeyToUser(userId, order);

    // Update admin message
    const targetChat = CHANNEL_ID || ADMIN_CHAT_ID;
    if (targetChat && order.telegramMessageId) {
      await editMessageText(
        targetChat,
        order.telegramMessageId,
        `🤖 <b>AUTO-APPROVED</b>\n\nOrder ${order.orderNumber} auto-approved (OCR match)`
      );
    }

    log.info('Order auto-approved', { orderId, userId });
  } catch (error) {
    log.error('Auto-approve error', {
      orderId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle admin approve from bot callback
 */
export async function handleBotApprove(
  callbackQueryId: string,
  orderId: string,
  userId: number,
  adminName: string
): Promise<void> {
  cancelAutoApprove(orderId);

  try {
    await connectDB();

    const order = await Order.findById(orderId);
    if (!order) {
      return;
    }

    if (order.status === 'completed' || order.status === 'rejected') {
      return;
    }

    // Provision VPN key
    const result = await provisionVpnKeyForOrder(order);
    if (!result) {
      await sendMessage(
        ADMIN_CHAT_ID || '',
        `❌ VPN provisioning failed for order ${order.orderNumber}`
      );
      return;
    }

    order.status = 'completed';
    await order.save();

    // Process referral reward
    await processReferralReward(order.user, order._id);

    // Notify user
    await sendMessage(userId, MSG.orderApproved(order.orderNumber));
    await sendVpnKeyToUser(userId, order);

    log.info('Bot order approved by admin', { orderId, adminName });
  } catch (error) {
    log.error('Bot approve error', {
      orderId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle admin reject from bot callback
 */
export async function handleBotReject(
  callbackQueryId: string,
  orderId: string,
  userId: number,
  adminName: string
): Promise<void> {
  cancelAutoApprove(orderId);

  try {
    await connectDB();

    const order = await Order.findById(orderId);
    if (!order || order.status === 'completed' || order.status === 'rejected') {
      return;
    }

    order.status = 'rejected';
    order.rejectReason = `Rejected via Bot by ${adminName}`;
    await order.save();

    // Notify user
    await sendMessage(userId, MSG.orderRejected(order.orderNumber));

    log.info('Bot order rejected by admin', { orderId, adminName });
  } catch (error) {
    log.error('Bot reject error', {
      orderId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Provision VPN key for an order (shared logic)
 */
async function provisionVpnKeyForOrder(
  order: InstanceType<typeof Order>
): Promise<boolean> {
  if (!order.vpnPlan) return false;

  const plan = getPlan(order.vpnPlan.planId);
  const server = await getServer(order.vpnPlan.serverId);

  if (!plan || !server) return false;

  const user = await User.findById(order.user).select('name email telegramUsername').lean() as
    | { name?: string; email?: string; telegramUsername?: string }
    | null;
  const username = user?.telegramUsername || user?.name || user?.email?.split('@')[0] || '';

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
    return false;
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
  await order.save();

  return true;
}

/**
 * Send VPN key details to user
 */
async function sendVpnKeyToUser(
  chatId: number,
  order: InstanceType<typeof Order>
): Promise<void> {
  if (!order.vpnKey || !order.vpnPlan) return;

  const plan = getPlan(order.vpnPlan.planId);
  const server = await getServer(order.vpnPlan.serverId);

  const expiryDate = new Date(order.vpnKey.expiryTime).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  await sendMessage(
    chatId,
    MSG.keyGenerated({
      planName: plan?.name || 'VPN Key',
      serverName: server ? `${server.flag} ${server.name}` : 'Unknown',
      protocol: order.vpnKey.protocol,
      expiryDate,
      subLink: order.vpnKey.subLink,
      configLink: order.vpnKey.configLink,
    }),
    { replyMarkup: mainMenuKeyboard() }
  );
}
