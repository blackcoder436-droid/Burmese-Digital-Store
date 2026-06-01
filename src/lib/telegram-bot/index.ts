// ==========================================
// Telegram Bot Update Router
// Burmese Digital Store - Integrated Bot
//
// Main entry point for processing Telegram updates.
// Routes messages, commands, callbacks, and photos
// to the appropriate handlers.
// ==========================================

import { createLogger } from '@/lib/logger';
import { approveOrder, rejectOrder } from '@/lib/order-actions';
import { extractSupportScreenshotText, MAX_SUPPORT_IMAGE_BYTES } from '@/lib/support-screenshot';
import { answerCallback, downloadFile, editMessageCaption, editMessageText, sendMessage } from './api';
import { getSession, clearSession } from './session';
import type { TelegramCallbackQuery, TelegramUpdate, BotContext, TelegramPhotoSize } from './types';

// Command handlers
import {
  handleStart,
  handleHelp,
  handleContact,
  handleMainMenu,
} from './handlers/commands';

// Purchase flow
import {
  handleBuyKey,
  handleServerSelect,
  handleProtocolSelect,
  handleDeviceSelect,
  handlePlanSelect,
  handleSendScreenshot,
} from './handlers/purchase';

import { handleVPSCategory, handleVPSSelect, handleVPSBuy } from './handlers/vps';

// Payment
import {
  handlePaymentScreenshot,
  handleBotApprove,
  handleBotReject,
} from './handlers/payment';

// Free test
import {
  handleFreeTest,
  handleFreeTestVerify,
  handleFreeServerSelect,
  handleFreeProtocolSelect,
} from './handlers/free-test';

// Keys
import {
  handleMyKeys,
  handleViewKey,
  handleCheckUsage,
} from './handlers/keys';

// Referral
import {
  handleReferral,
  handleMyReferralLink,
  handleReferralStats,
  handleClaimFreeMonth,
} from './handlers/referral';

// Shop
import {
  handleShopCategories,
  handleShopCategory,
  handleShopProduct,
  handleShopBuy,
} from './handlers/shop';

// Admin
import {
  isAdmin,
  isApproveChannel,
  handleAdmin,
  handleAdminBack,
  handleAdminSales,
  handleAdminStats,
  handleStatsPeriod,
  handleStatsTopUsers,
  handleAdminPending,
  handleAdminUsers,
  handleAdminServers,
  handleToggleServer,
  handleAdminFeatures,
  handleToggleFeature,
  handleAdminBans,
  handleBanUserStart,
  handleUnbanUserStart,
  handleBanList,
  processBanUser,
  processUnbanUser,
  handleBroadcast,
  handleBanCommand,
  handleUnbanCommand,
  handleAdminCreateKey,
  handleAdminKeyType,
  handleAdminKeyServer,
  handleAdminKeyProtocol,
  handleAdminKeyDevice,
  handleAdminKeyDuration,
} from './handlers/admin';

const log = createLogger({ module: 'telegram-bot-router' });

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function toTelegramPlainText(markdown: string): string {
  return markdown
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1: $2')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function pickSupportPhoto(photos?: TelegramPhotoSize[]): TelegramPhotoSize | undefined {
  if (!photos?.length) return undefined;

  const sorted = [...photos].sort((a, b) => (b.width * b.height) - (a.width * a.height));
  return sorted.find((photo) => !photo.file_size || photo.file_size <= MAX_SUPPORT_IMAGE_BYTES) || sorted[0];
}

async function handleSupportScreenshot(
  ctx: BotContext,
  photos?: TelegramPhotoSize[],
  caption?: string
): Promise<void> {
  const { generateCustomerAgentReply } = await import('@/modules/ai-ops/service');
  const supportMessage = caption?.trim() || 'Screenshot ပို့ထားပါတယ်။';
  const photo = pickSupportPhoto(photos);
  const fileBuffer = photo ? await downloadFile(photo.file_id) : null;
  const textHint = fileBuffer
    ? await extractSupportScreenshotText(fileBuffer, 'image/jpeg')
    : undefined;

  const result = await generateCustomerAgentReply({
    channel: 'telegram',
    sessionId: `telegram:${ctx.userId}`,
    message: supportMessage,
    externalUserId: String(ctx.userId),
    page: 'telegram-bot',
    metadata: {
      username: ctx.username,
      firstName: ctx.firstName,
      hasPhoto: true,
      caption: caption || undefined,
      supportOcrText: Boolean(textHint),
      supportScreenshot: true,
    },
    supportAttachment: {
      type: 'support-image',
      source: 'telegram',
      mimeType: 'image/jpeg',
      sizeBytes: fileBuffer?.length || photo?.file_size,
      textHint,
    },
    maxTokens: 220,
  });

  await sendMessage(ctx.chatId, escapeHtml(toTelegramPlainText(result.reply)), {
    parseMode: 'HTML',
    disableWebPagePreview: true,
  });
}

function parseTwoPartCallback(data: string, colonPrefix: string, underscorePrefix: string): {
  first: string;
  second: string;
} | null {
  if (data.startsWith(`${colonPrefix}:`)) {
    const body = data.substring(colonPrefix.length + 1);
    const sep = body.indexOf(':');
    if (sep === -1) return null;
    return {
      first: body.substring(0, sep),
      second: body.substring(sep + 1),
    };
  }

  if (data.startsWith(`${underscorePrefix}_`)) {
    const body = data.substring(underscorePrefix.length + 1);
    const sep = body.indexOf('_');
    if (sep === -1) return null;
    return {
      first: body.substring(0, sep),
      second: body.substring(sep + 1),
    };
  }

  return null;
}

function parseThreePartCallback(
  data: string,
  colonPrefix: string,
  underscorePrefix: string
): { first: string; second: string; third: string } | null {
  if (data.startsWith(`${colonPrefix}:`)) {
    const body = data.substring(colonPrefix.length + 1);
    const firstSep = body.indexOf(':');
    const secondSep = body.lastIndexOf(':');
    if (firstSep === -1 || secondSep === -1 || firstSep === secondSep) return null;
    return {
      first: body.substring(0, firstSep),
      second: body.substring(firstSep + 1, secondSep),
      third: body.substring(secondSep + 1),
    };
  }

  if (data.startsWith(`${underscorePrefix}_`)) {
    const body = data.substring(underscorePrefix.length + 1);
    const firstSep = body.indexOf('_');
    const secondSep = body.lastIndexOf('_');
    if (firstSep === -1 || secondSep === -1 || firstSep === secondSep) return null;
    return {
      first: body.substring(0, firstSep),
      second: body.substring(firstSep + 1, secondSep),
      third: body.substring(secondSep + 1),
    };
  }

  return null;
}

async function updateOrderActionMessage(
  ctx: BotContext,
  callback: TelegramCallbackQuery,
  statusLine: string
): Promise<void> {
  if (!ctx.messageId) return;

  const originalText = callback.message?.caption || callback.message?.text || '';
  const nextText = `${originalText.trim()}\n\n${statusLine}`.trim();
  const hasCaption = Boolean(callback.message?.caption || callback.message?.photo?.length);
  const edited = hasCaption
    ? await editMessageCaption(ctx.chatId, ctx.messageId, nextText)
    : await editMessageText(ctx.chatId, ctx.messageId, nextText);

  if (!edited) {
    log.warn('Unable to update Telegram order action message', {
      chatId: ctx.chatId,
      messageId: ctx.messageId,
    });
  }
}

async function handleWebOrderActionCallback(
  ctx: BotContext,
  callback: TelegramCallbackQuery,
  action: 'approve_order' | 'reject_order',
  orderId: string
): Promise<void> {
  if (!ctx.isAdmin && !isApproveChannel(ctx.chatId)) {
    await answerCallback(ctx.callbackQueryId!, 'Admin only');
    return;
  }

  const adminName = ctx.firstName || 'Telegram Admin';

  if (action === 'approve_order') {
    const result = await approveOrder(orderId, {
      adminId: String(ctx.userId),
      adminName,
      source: 'noti-bot',
    });

    if (!result.success) {
      await answerCallback(ctx.callbackQueryId!, result.error || 'Approval failed');
      return;
    }

    const status = result.error === 'Order already completed' ? 'Already completed' : 'APPROVED';
    await updateOrderActionMessage(ctx, callback, `<b>${status}</b> by ${escapeHtml(adminName)}`);
    await answerCallback(ctx.callbackQueryId!, status);
    return;
  }

  const result = await rejectOrder(orderId, {
    adminId: String(ctx.userId),
    adminName,
    source: 'noti-bot',
    rejectReason: `Rejected via Telegram by ${adminName}`,
  });

  if (!result.success) {
    await answerCallback(ctx.callbackQueryId!, result.error || 'Rejection failed');
    return;
  }

  await updateOrderActionMessage(ctx, callback, `<b>REJECTED</b> by ${escapeHtml(adminName)}`);
  await answerCallback(ctx.callbackQueryId!, 'Rejected');
}

/**
 * Process a Telegram update — main dispatch function.
 * Called from the webhook route.
 */
export async function processUpdate(update: TelegramUpdate): Promise<void> {
  try {
    if (update.callback_query) {
      await handleCallbackQuery(update);
    } else if (update.message) {
      await handleMessage(update);
    }
  } catch (error) {
    log.error('Error processing update', {
      updateId: update.update_id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle incoming messages (text commands, photos)
 */
async function handleMessage(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  if (!message?.from || !message.chat) return;

    let userLang: 'en' | 'my' = 'my';
    try {
      const { default: User } = await import('@/models/User');
      const user = await User.findOne({ telegramId: message.from.id }).select('language');
      if (user && user.language) userLang = user.language;
    } catch (e) {}

    const ctx: BotContext = {
      chatId: message.chat.id,
      userId: message.from.id,
      username: message.from.username,
      firstName: message.from.first_name,
      lastName: message.from.last_name,
      messageId: message.message_id,
      text: message.text,
      photo: message.photo,
      isAdmin: isAdmin(message.from.id),
      lang: userLang,
    };

  // Only handle private messages
  if (message.chat.type !== 'private') return;

  // Handle photo messages. Only route to payment flow when the user is
  // actively waiting to upload a payment screenshot for an order.
  if (ctx.photo && ctx.photo.length > 0) {
    const session = getSession(ctx.userId);
    if (session?.waitingScreenshot && session.orderId) {
      await handlePaymentScreenshot(
        ctx.chatId,
        ctx.userId,
        ctx.photo,
        ctx.firstName,
        ctx.username
      );
    } else {
      await handleSupportScreenshot(ctx, ctx.photo, message.caption);
    }
    return;
  }

  // Handle text messages
  if (!ctx.text) return;

  // Check for admin text input (ban/unban actions)
  const session = getSession(ctx.userId);
  if (session?.action && ctx.isAdmin) {
    if (session.action === 'ban_user') {
      clearSession(ctx.userId);
      await processBanUser(ctx.chatId, ctx.text);
      return;
    }
    if (session.action === 'unban_user') {
      clearSession(ctx.userId);
      await processUnbanUser(ctx.chatId, ctx.text);
      return;
    }
  }

  // Parse command
  const trimmed = ctx.text.trim();
  if (!trimmed.startsWith('/')) {
    const { generateCustomerAgentReply } = await import('@/modules/ai-ops/service');
    const result = await generateCustomerAgentReply({
      channel: 'telegram',
      sessionId: `telegram:${ctx.userId}`,
      message: trimmed,
      externalUserId: String(ctx.userId),
      page: 'telegram-bot',
      metadata: {
        username: ctx.username,
        firstName: ctx.firstName,
      },
    });
    await sendMessage(ctx.chatId, escapeHtml(toTelegramPlainText(result.reply)), {
      parseMode: 'HTML',
      disableWebPagePreview: true,
    });
    return;
  }

  const parts = trimmed.split(/\s+/);
  const command = parts[0].toLowerCase().split('@')[0]; // handle /command@botname
  const args = parts.slice(1).join(' ');

  switch (command) {
    case '/start':
      await handleStart(
        ctx.chatId,
        ctx.userId,
        ctx.firstName,
        ctx.lastName,
        ctx.username,
        args || undefined // referral param
      );
      break;

    case '/help':
      await handleHelp(ctx.chatId, ctx.userId);
      break;

    case '/language':
      const { handleSettingsLanguage } = await import('./handlers/commands');
      await handleSettingsLanguage(ctx.chatId, ctx.userId);
      break;

    // Admin commands
    case '/admin':
      if (ctx.isAdmin) {
        await handleAdmin(ctx.chatId);
      } else {
        await handleHelp(ctx.chatId, ctx.userId);
      }
      break;

    case '/broadcast':
      if (ctx.isAdmin) {
        await handleBroadcast(ctx.chatId, args);
      }
      break;

    case '/ban':
      if (ctx.isAdmin) {
        await handleBanCommand(ctx.chatId, args);
      }
      break;

    case '/unban':
      if (ctx.isAdmin) {
        await handleUnbanCommand(ctx.chatId, args);
      }
      break;

    default:
      // Unknown command — ignore
      break;
  }
}

/**
 * Handle callback queries (inline keyboard button presses)
 */
async function handleCallbackQuery(update: TelegramUpdate): Promise<void> {
  const callback = update.callback_query;
  if (!callback?.from || !callback.data) return;

  let userLang: 'en' | 'my' = 'my';
  try {
    const { default: User } = await import('@/models/User');
    const user = await User.findOne({ telegramId: callback.from.id }).select('language');
    if (user && user.language) userLang = user.language;
  } catch (e) {}

  const ctx: BotContext = {
    chatId: callback.message?.chat.id || callback.from.id,
    userId: callback.from.id,
    username: callback.from.username,
    firstName: callback.from.first_name,
    lastName: callback.from.last_name,
    messageId: callback.message?.message_id,
    callbackQueryId: callback.id,
    callbackData: callback.data,
    isAdmin: isAdmin(callback.from.id),
    lang: userLang,
  };

  const data = callback.data;

  try {
    // ---- Main Menu ----
    if (data === 'main_menu') {
      await handleMainMenu(ctx.chatId, ctx.userId, ctx.messageId);
    }
    // ---- Shop ----
    else if (data === 'shop_categories') {
      await handleShopCategories(ctx.chatId, ctx.messageId);
    } else if (data.startsWith('shop_cat_')) {
      const category = data.substring(9);
      if (category === 'vps') {
        const { handleVPSCategory } = await import('./handlers/vps');
        await handleVPSCategory(ctx);
      } else if (category === 'vpn') {
        await handleBuyKey(ctx.chatId, ctx.userId, ctx.messageId);
      } else {
        await handleShopCategory(ctx.chatId, category, ctx.messageId!);
      }
    } else if (data.startsWith('vps_select_')) {
      const { handleVPSSelect } = await import('./handlers/vps');
      const vpsId = data.replace('vps_select_', '');
      await handleVPSSelect(ctx, vpsId);
    } else if (data.startsWith('vps_buy_')) {
      const { handleVPSBuy } = await import('./handlers/vps');
      const vpsId = data.replace('vps_buy_', '');
      await handleVPSBuy(ctx, vpsId);
    } else if (data === 'settings_language') {
      const { handleSettingsLanguage } = await import('./handlers/commands');
      await handleSettingsLanguage(ctx.chatId, ctx.userId, ctx.messageId);
    } else if (data.startsWith('setlang_')) {
      const lang = data.replace('setlang_', '');
      log.info('Language selection callback', { data, lang, userId: ctx.userId, messageId: ctx.messageId });
      const { handleChangeLanguage } = await import('./handlers/commands');
      await handleChangeLanguage(ctx.chatId, ctx.userId, lang as any, ctx.messageId);
    } else if (data.startsWith('shop_prod_')) {
      const productId = data.substring(10);
      await handleShopProduct(ctx.chatId, productId, ctx.messageId!);
    } else if (data.startsWith('shop_buy_')) {
      const productId = data.substring(9);
      await handleShopBuy(ctx.chatId, ctx.userId, ctx.firstName, ctx.username, productId, ctx.messageId!);
    }
    // ---- Help / Contact ----
    else if (data === 'help') {
      await handleHelp(ctx.chatId, ctx.userId, ctx.messageId);
    } else if (data === 'contact') {
      await handleContact(ctx.chatId, ctx.userId, ctx.messageId);
    }
    // ---- Buy VPN Key Flow ----
    else if (data === 'buy_key') {
      await handleBuyKey(ctx.chatId, ctx.userId, ctx.messageId);
    } else if (data.startsWith('server_')) {
      const serverId = data.substring(7);
      await handleServerSelect(ctx.chatId, ctx.userId, serverId, ctx.messageId);
    }
    else if (data.startsWith('proto_') || data.startsWith('proto:')) {
      const parsed = parseTwoPartCallback(data, 'proto', 'proto');
      if (!parsed) return;
      const serverId = parsed.first;
      const protocol = parsed.second;
      await handleProtocolSelect(ctx.chatId, ctx.userId, serverId, protocol, ctx.messageId);
    } else if (data.startsWith('device_') || data.startsWith('device:')) {
      const parsed = parseTwoPartCallback(data, 'device', 'device');
      if (!parsed) return;
      const serverId = parsed.first;
      const count = parseInt(parsed.second, 10);
      if (Number.isNaN(count)) return;
      await handleDeviceSelect(ctx.chatId, ctx.userId, serverId, count, ctx.messageId);
    } else if (data.startsWith('plan_') || data.startsWith('plan:')) {
      const parsed = parseTwoPartCallback(data, 'plan', 'plan');
      if (!parsed) return;
      const serverId = parsed.first;
      const planId = parsed.second;
      await handlePlanSelect(
        ctx.chatId,
        ctx.userId,
        ctx.firstName,
        ctx.username,
        serverId,
        planId,
        ctx.messageId
      );
    } else if (data.startsWith('send_screenshot_')) {
      const orderId = data.substring(16);
      await handleSendScreenshot(ctx.chatId, ctx.userId, orderId, ctx.messageId);
    }
    // ---- Free Test ----
    else if (data === 'free_test') {
      await handleFreeTest(ctx.chatId, ctx.userId, ctx.firstName, ctx.username, ctx.messageId);
    } else if (data === 'free_test_verify') {
      await handleFreeTestVerify(ctx.chatId, ctx.userId, ctx.firstName, ctx.username, ctx.messageId);
    } else if (data.startsWith('free_server_')) {
      const serverId = data.substring(12);
      await handleFreeServerSelect(ctx.chatId, ctx.userId, serverId, ctx.messageId);
    } else if (data.startsWith('free_proto_') || data.startsWith('free_proto:')) {
      const parsed = parseTwoPartCallback(data, 'free_proto', 'free_proto');
      if (!parsed) return;
      const serverId = parsed.first;
      const protocol = parsed.second;
      await handleFreeProtocolSelect(
        ctx.chatId,
        ctx.userId,
        ctx.firstName,
        ctx.username,
        serverId,
        protocol,
        ctx.messageId
      );
    }
    // ---- My Keys ----
    else if (data === 'my_keys') {
      await handleMyKeys(ctx.chatId, ctx.userId, ctx.firstName, ctx.username, ctx.messageId);
    } else if (data.startsWith('view_key_')) {
      const orderId = data.substring(9);
      await handleViewKey(ctx.chatId, ctx.userId, orderId, ctx.messageId);
    } else if (data === 'check_usage') {
      await handleCheckUsage(ctx.chatId, ctx.userId, ctx.firstName, ctx.username, ctx.messageId);
    }
    // ---- Referral ----
    else if (data === 'referral') {
      await handleReferral(ctx.chatId, ctx.userId, ctx.firstName, ctx.username, ctx.messageId);
    } else if (data === 'my_referral_link') {
      await handleMyReferralLink(ctx.chatId, ctx.userId, ctx.firstName, ctx.username, ctx.messageId);
    } else if (data === 'referral_stats') {
      await handleReferralStats(ctx.chatId, ctx.userId, ctx.firstName, ctx.username, ctx.messageId);
    } else if (data === 'claim_free_month') {
      await handleClaimFreeMonth(ctx.chatId, ctx.userId, ctx.firstName, ctx.username, ctx.messageId);
    }
    // ---- Admin Approve/Reject (from payment channel) ----
    else if (data.startsWith('bot_approve_')) {
      if (!ctx.isAdmin) {
        await answerCallback(ctx.callbackQueryId!, '❌ Admin only');
        return;
      }
      const parts = data.substring(12).split('_');
      const orderId = parts[0];
      const userId = parseInt(parts[1], 10);
      const result = await handleBotApprove(
        ctx.callbackQueryId!,
        orderId,
        userId,
        ctx.firstName
      );
      await answerCallback(ctx.callbackQueryId!, result.success ? '✅ Order approved' : `❌ ${result.error || 'Approval failed'}`);

      // Update the admin message (photo messages need editMessageCaption)
      if (ctx.messageId) {
        const { editMessageText, editMessageCaption } = await import('./api');
        const isPhoto = !!callback.message?.photo;
        const statusLine = `\n\n✅ <b>APPROVED</b> by ${ctx.firstName}`;
        if (isPhoto) {
          await editMessageCaption(
            ctx.chatId,
            ctx.messageId,
            (callback.message?.caption || '') + statusLine
          );
        } else {
          await editMessageText(
            ctx.chatId,
            ctx.messageId,
            (callback.message?.text || '') + statusLine
          );
        }
      }
    } else if (data.startsWith('bot_reject_')) {
      if (!ctx.isAdmin) {
        await answerCallback(ctx.callbackQueryId!, '❌ Admin only');
        return;
      }
      const parts = data.substring(11).split('_');
      const orderId = parts[0];
      const userId = parseInt(parts[1], 10);
      const result = await handleBotReject(
        ctx.callbackQueryId!,
        orderId,
        userId,
        ctx.firstName
      );
      await answerCallback(ctx.callbackQueryId!, result.success ? '❌ Order rejected' : `❌ ${result.error || 'Rejection failed'}`);

      // Update the admin message (photo messages need editMessageCaption)
      if (ctx.messageId) {
        const { editMessageText, editMessageCaption } = await import('./api');
        const isPhoto = !!callback.message?.photo;
        const statusLine = `\n\n❌ <b>REJECTED</b> by ${ctx.firstName}`;
        if (isPhoto) {
          await editMessageCaption(
            ctx.chatId,
            ctx.messageId,
            (callback.message?.caption || '') + statusLine
          );
        } else {
          await editMessageText(
            ctx.chatId,
            ctx.messageId,
            (callback.message?.text || '') + statusLine
          );
        }
      }
    }
    // ---- Admin Panel ----
    else if (data === 'admin_back') {
      if (ctx.isAdmin) await handleAdminBack(ctx.chatId);
    } else if (data === 'admin_sales') {
      if (ctx.isAdmin) await handleAdminSales(ctx.chatId);
    } else if (data === 'admin_stats') {
      if (ctx.isAdmin) await handleAdminStats(ctx.chatId);
    } else if (data.startsWith('stats_')) {
      if (!ctx.isAdmin) return;
      const stat = data.substring(6);
      if (stat === 'top_users') {
        await handleStatsTopUsers(ctx.chatId);
      } else if (stat === 'revenue') {
        // Same as stats_all for now
        await handleStatsPeriod(ctx.chatId, 'all');
      } else {
        await handleStatsPeriod(ctx.chatId, stat as 'today' | 'week' | 'month' | 'all');
      }
    } else if (data === 'admin_pending') {
      if (ctx.isAdmin) await handleAdminPending(ctx.chatId);
    } else if (data === 'admin_users') {
      if (ctx.isAdmin) await handleAdminUsers(ctx.chatId);
    } else if (data === 'admin_servers') {
      if (ctx.isAdmin) await handleAdminServers(ctx.chatId);
    } else if (data.startsWith('toggle_server_')) {
      if (ctx.isAdmin) {
        const serverId = data.substring(14);
        await handleToggleServer(ctx.chatId, serverId);
      }
    } else if (data === 'admin_features') {
      if (ctx.isAdmin) await handleAdminFeatures(ctx.chatId);
    } else if (data.startsWith('toggle_feature_')) {
      if (ctx.isAdmin) {
        const featureName = data.substring(15);
        await handleToggleFeature(ctx.chatId, featureName, ctx.firstName);
      }
    } else if (data === 'admin_bans') {
      if (ctx.isAdmin) await handleAdminBans(ctx.chatId);
    } else if (data === 'ban_user_start') {
      if (ctx.isAdmin) await handleBanUserStart(ctx.chatId, ctx.userId);
    } else if (data === 'unban_user_start') {
      if (ctx.isAdmin) await handleUnbanUserStart(ctx.chatId, ctx.userId);
    } else if (data === 'ban_list') {
      if (ctx.isAdmin) await handleBanList(ctx.chatId);
    } else if (data === 'admin_backup') {
      if (ctx.isAdmin) {
        await answerCallback(ctx.callbackQueryId!, 'ℹ️ Backup ကို Admin Dashboard မှ ပြုလုပ်ပါ');
      }
    }
    // ---- Admin Create Key Flow ----
    else if (data === 'admin_create_key') {
      if (ctx.isAdmin) await handleAdminCreateKey(ctx.chatId, ctx.messageId);
    } else if (data.startsWith('akey_type_')) {
      if (ctx.isAdmin) {
        const keyType = data.substring(10); // 'test' or 'sell'
        await handleAdminKeyType(ctx.chatId, keyType, ctx.messageId);
      }
    } else if (data.startsWith('akey_srv_') || data.startsWith('akey_srv:')) {
      if (ctx.isAdmin) {
        const parsed = parseTwoPartCallback(data, 'akey_srv', 'akey_srv');
        if (!parsed) return;
        const keyType = parsed.first;
        const serverId = parsed.second;
        await handleAdminKeyServer(ctx.chatId, keyType, serverId, ctx.messageId);
      }
    } else if (data.startsWith('akey_proto_') || data.startsWith('akey_proto:')) {
      if (ctx.isAdmin) {
        const parsed = parseThreePartCallback(data, 'akey_proto', 'akey_proto');
        if (!parsed) return;
        const keyType = parsed.first;
        const serverId = parsed.second;
        const protocol = parsed.third;
        await handleAdminKeyProtocol(ctx.chatId, keyType, serverId, protocol, ctx.messageId);
      }
    } else if (data.startsWith('akey_dev_') || data.startsWith('akey_dev:')) {
      if (ctx.isAdmin) {
        const isColon = data.startsWith('akey_dev:');
        const rest = data.substring(9);
        const parts = isColon ? rest.split(':') : rest.split('_');
        if (parts.length < 4) return;

        const keyType = parts[0];
        const devices = parseInt(parts[parts.length - 1], 10);
        const protocol = parts[parts.length - 2];
        const serverId = parts.slice(1, parts.length - 2).join(isColon ? ':' : '_');
        if (Number.isNaN(devices)) return;
        await handleAdminKeyDevice(ctx.chatId, keyType, serverId, protocol, devices, ctx.messageId);
      }
    } else if (data.startsWith('akey_dur_') || data.startsWith('akey_dur:')) {
      if (ctx.isAdmin) {
        const isColon = data.startsWith('akey_dur:');
        const sep = isColon ? ':' : '_';
        const rest = data.substring(9);
        const parts = isColon ? rest.split(':') : rest.split('_');
        if (parts.length < 5) return;

        const keyType = parts[0];
        const expiryDays = parseInt(parts[parts.length - 1], 10);
        const devices = parseInt(parts[parts.length - 2], 10);
        const protocol = parts[parts.length - 3];
        const serverId = parts.slice(1, parts.length - 3).join(sep);
        if (Number.isNaN(devices) || Number.isNaN(expiryDays)) return;
        await handleAdminKeyDuration(ctx.chatId, keyType, serverId, protocol, devices, expiryDays, ctx.messageId);
      }
    }
    // ---- Existing web order approve/reject (unified webhook) ----
    else if (data.startsWith('approve_order:') || data.startsWith('reject_order:')) {
      const [action, orderId] = data.split(':') as ['approve_order' | 'reject_order', string];
      if (!orderId) {
        await answerCallback(ctx.callbackQueryId!, 'Invalid order action');
        return;
      }
      await handleWebOrderActionCallback(ctx, callback, action, orderId);
      return;
    }
    // ---- Unknown ----
    else {
      log.warn('Unknown callback data', { data, userId: ctx.userId });
    }

    // Answer callback to dismiss loading spinner
    if (ctx.callbackQueryId && !data.startsWith('bot_approve_') && !data.startsWith('bot_reject_')) {
      await answerCallback(ctx.callbackQueryId, '', false);
    }
  } catch (error) {
    log.error('Callback handler error', {
      data,
      userId: ctx.userId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (ctx.callbackQueryId) {
      await answerCallback(ctx.callbackQueryId, '❌ Error occurred');
    }
  }
}
