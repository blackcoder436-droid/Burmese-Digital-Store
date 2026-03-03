// ==========================================
// Payment Screenshot & Auto-Approve Handlers
// Screenshot verification, OCR, auto-approve timer
// ==========================================

import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import { sendMessage, sendPhoto, downloadFile, editMessageText, editMessageCaption } from '../api';
import { MSG } from '../messages';
import { approveRejectKeyboard, mainMenuKeyboard } from '../keyboards';
import { getSession, clearSession } from '../session';
import { computeScreenshotHash, isDuplicateScreenshot } from '@/lib/fraud-detection';
import { extractPaymentInfo, verifyAmount } from '@/lib/ocr';
import { getSiteSettings, getFeatureFlag } from '@/models/SiteSettings';
import { createLogger } from '@/lib/logger';
import { approveOrder, rejectOrder } from '@/lib/order-actions';
import { getPlan } from '@/lib/vpn-plans';
import { getServer } from '@/lib/vpn-servers';
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

        log.info('OCR result for order', {
          orderId: order._id,
          extractedAmount: ocrResult.amount,
          expectedAmount: order.totalAmount,
          confidence: ocrResult.confidence,
          transactionId: ocrResult.transactionId,
          amountMatch,
          rawTextPreview: ocrResult.rawText?.substring(0, 300),
        });
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
      const photoResult = await sendPhoto(targetChat, largest.file_id, {
        caption: adminMessage,
        replyMarkup: approveRejectKeyboard(order._id.toString(), telegramId),
      });

      // Save message ID so auto-approve/reject can edit the message later
      if (photoResult.messageId) {
        order.telegramMessageId = photoResult.messageId;
        await order.save();
      }
    }

    // Tell user order is under review
    await sendMessage(chatId, MSG.orderPending, {
      replyMarkup: mainMenuKeyboard(),
    });

    // Auto-approve only if OCR amount matches and feature enabled
    const autoApproveEnabled = await getFeatureFlag('auto_approve');
    if (ocrMatch && autoApproveEnabled && !order.requiresManualReview) {
      const delay = settings.autoApproveDelaySeconds || 100;
      scheduleAutoApprove(order._id.toString(), telegramId, delay, ocrMatch);
    } else {
      log.info('Auto-approve skipped', {
        orderId: order._id,
        ocrMatch,
        autoApproveEnabled,
        requiresManualReview: order.requiresManualReview,
      });
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
  delaySeconds: number,
  ocrMatch: boolean = false
): void {
  // Cancel existing timer if any
  cancelAutoApprove(orderId);

  const timer = setTimeout(async () => {
    autoApproveTimers.delete(orderId);
    await executeAutoApprove(orderId, userId, ocrMatch);
  }, delaySeconds * 1000);

  autoApproveTimers.set(orderId, timer);
  log.info('Auto-approve scheduled', { orderId, delaySeconds, ocrMatch });
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
 * Execute auto-approve: uses shared approveOrder
 */
async function executeAutoApprove(orderId: string, userId: number, ocrMatch: boolean = false): Promise<void> {
  try {
    // Re-check order status before approving (admin may have already acted)
    await connectDB();
    const checkOrder = await Order.findById(orderId);
    if (!checkOrder || checkOrder.status !== 'verifying') {
      log.info('Auto-approve skipped — order already processed', { orderId, status: checkOrder?.status });
      return;
    }

    const result = await approveOrder(orderId, {
      adminId: 'bot-auto',
      adminName: ocrMatch ? 'Auto-Approve (OCR ✅)' : 'Auto-Approve (Timer)',
      source: 'auto-approve',
    });

    if (!result.success) {
      log.error('Auto-approve failed', { orderId, error: result.error });
      return;
    }

    // Update admin message in channel
    const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
    const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
    const targetChat = CHANNEL_ID || ADMIN_CHAT_ID;

    const order = result.order;
    if (targetChat && order?.telegramMessageId) {
      const approveLabel = ocrMatch ? 'OCR match ✅' : 'Timer ⏱';
      const autoApproveText = `🤖 <b>AUTO-APPROVED</b> (${approveLabel})\n\nOrder ${order.orderNumber} auto-approved`;
      const captionOk = await editMessageCaption(
        targetChat,
        order.telegramMessageId,
        autoApproveText
      );
      // Fallback to editMessageText in case it was a text message
      if (!captionOk) {
        await editMessageText(
          targetChat,
          order.telegramMessageId,
          autoApproveText
        );
      }
    }

    log.info('Order auto-approved', { orderId, userId, ocrMatch });
  } catch (error) {
    log.error('Auto-approve error', {
      orderId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle admin approve from bot callback — uses shared approveOrder
 */
export async function handleBotApprove(
  callbackQueryId: string,
  orderId: string,
  userId: number,
  adminName: string
): Promise<void> {
  cancelAutoApprove(orderId);

  try {
    const result = await approveOrder(orderId, {
      adminId: 'telegram-bot',
      adminName,
      source: 'vpn-bot',
    });

    if (!result.success) {
      log.warn('Bot approve failed', { orderId, error: result.error });
      return;
    }

    log.info('Bot order approved by admin', { orderId, adminName });
  } catch (error) {
    log.error('Bot approve error', {
      orderId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle admin reject from bot callback — uses shared rejectOrder
 */
export async function handleBotReject(
  callbackQueryId: string,
  orderId: string,
  userId: number,
  adminName: string
): Promise<void> {
  cancelAutoApprove(orderId);

  try {
    const result = await rejectOrder(orderId, {
      adminId: 'telegram-bot',
      adminName,
      source: 'vpn-bot',
      rejectReason: `Rejected via Bot by ${adminName}`,
    });

    if (!result.success) {
      log.warn('Bot reject failed', { orderId, error: result.error });
      return;
    }

    log.info('Bot order rejected by admin', { orderId, adminName });
  } catch (error) {
    log.error('Bot reject error', {
      orderId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
