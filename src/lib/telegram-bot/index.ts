// ==========================================
// Telegram Bot Update Router
// Burmese Digital Store - Integrated Bot
//
// Main entry point for processing Telegram updates.
// Routes messages, commands, callbacks, and photos
// to the appropriate handlers.
// ==========================================

import { createLogger } from '@/lib/logger';
import { answerCallback } from './api';
import { getSession, clearSession } from './session';
import type { TelegramUpdate, BotContext } from './types';

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
  handleExchangeKey,
  handleExKeySelect,
  handleExProtoSelect,
  handleCheckUsage,
} from './handlers/keys';

// Referral
import {
  handleReferral,
  handleMyReferralLink,
  handleReferralStats,
  handleClaimFreeMonth,
} from './handlers/referral';

// Admin
import {
  isAdmin,
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
} from './handlers/admin';

const log = createLogger({ module: 'telegram-bot-router' });

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
  };

  // Only handle private messages
  if (message.chat.type !== 'private') return;

  // Handle photo messages (payment screenshots)
  if (ctx.photo && ctx.photo.length > 0) {
    await handlePaymentScreenshot(
      ctx.chatId,
      ctx.userId,
      ctx.photo,
      ctx.firstName,
      ctx.username
    );
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
  if (!trimmed.startsWith('/')) return; // Ignore non-command text

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
      await handleHelp(ctx.chatId);
      break;

    // Admin commands
    case '/admin':
      if (ctx.isAdmin) {
        await handleAdmin(ctx.chatId);
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
  };

  const data = callback.data;

  try {
    // ---- Main Menu ----
    if (data === 'main_menu') {
      await handleMainMenu(ctx.chatId, ctx.userId);
    }
    // ---- Help / Contact ----
    else if (data === 'help') {
      await handleHelp(ctx.chatId);
    } else if (data === 'contact') {
      await handleContact(ctx.chatId);
    }
    // ---- Buy VPN Key Flow ----
    else if (data === 'buy_key') {
      await handleBuyKey(ctx.chatId, ctx.userId);
    } else if (data.startsWith('server_')) {
      const serverId = data.substring(7);
      await handleServerSelect(ctx.chatId, ctx.userId, serverId);
    } else if (data.startsWith('proto_')) {
      const parts = data.substring(6).split('_');
      const serverId = parts[0];
      const protocol = parts.slice(1).join('_');
      await handleProtocolSelect(ctx.chatId, ctx.userId, serverId, protocol);
    } else if (data.startsWith('device_')) {
      const parts = data.substring(7).split('_');
      const serverId = parts[0];
      const count = parseInt(parts[1], 10);
      await handleDeviceSelect(ctx.chatId, ctx.userId, serverId, count);
    } else if (data.startsWith('plan_')) {
      const parts = data.substring(5).split('_');
      const serverId = parts[0];
      const planId = parts.slice(1).join('_');
      await handlePlanSelect(
        ctx.chatId,
        ctx.userId,
        ctx.firstName,
        ctx.username,
        serverId,
        planId
      );
    } else if (data.startsWith('send_screenshot_')) {
      const orderId = data.substring(16);
      await handleSendScreenshot(ctx.chatId, ctx.userId, orderId);
    }
    // ---- Free Test ----
    else if (data === 'free_test') {
      await handleFreeTest(ctx.chatId, ctx.userId, ctx.firstName, ctx.username);
    } else if (data === 'free_test_verify') {
      await handleFreeTestVerify(ctx.chatId, ctx.userId, ctx.firstName, ctx.username);
    } else if (data.startsWith('free_server_')) {
      const serverId = data.substring(12);
      await handleFreeServerSelect(ctx.chatId, ctx.userId, serverId);
    } else if (data.startsWith('free_proto_')) {
      const parts = data.substring(11).split('_');
      const serverId = parts[0];
      const protocol = parts.slice(1).join('_');
      await handleFreeProtocolSelect(
        ctx.chatId,
        ctx.userId,
        ctx.firstName,
        ctx.username,
        serverId,
        protocol
      );
    }
    // ---- My Keys ----
    else if (data === 'my_keys') {
      await handleMyKeys(ctx.chatId, ctx.userId, ctx.firstName, ctx.username);
    } else if (data.startsWith('view_key_')) {
      const orderId = data.substring(9);
      await handleViewKey(ctx.chatId, ctx.userId, orderId);
    } else if (data === 'check_usage') {
      await handleCheckUsage(ctx.chatId, ctx.userId, ctx.firstName, ctx.username);
    }
    // ---- Exchange Key ----
    else if (data === 'exchange_key') {
      await handleExchangeKey(ctx.chatId, ctx.userId, ctx.firstName, ctx.username);
    } else if (data.startsWith('exkey_')) {
      const orderId = data.substring(6);
      await handleExKeySelect(ctx.chatId, ctx.userId, orderId);
    } else if (data.startsWith('expro_')) {
      const parts = data.substring(6).split('_');
      const keyId = parts[0];
      const protocol = parts.slice(1).join('_');
      await handleExProtoSelect(
        ctx.chatId,
        ctx.userId,
        ctx.firstName,
        ctx.username,
        keyId,
        protocol
      );
    }
    // ---- Referral ----
    else if (data === 'referral') {
      await handleReferral(ctx.chatId, ctx.userId, ctx.firstName, ctx.username);
    } else if (data === 'my_referral_link') {
      await handleMyReferralLink(ctx.chatId, ctx.userId, ctx.firstName, ctx.username);
    } else if (data === 'referral_stats') {
      await handleReferralStats(ctx.chatId, ctx.userId, ctx.firstName, ctx.username);
    } else if (data === 'claim_free_month') {
      await handleClaimFreeMonth(ctx.chatId, ctx.userId, ctx.firstName, ctx.username);
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
      await handleBotApprove(
        ctx.callbackQueryId!,
        orderId,
        userId,
        ctx.firstName
      );
      await answerCallback(ctx.callbackQueryId!, '✅ Order approved');

      // Update the admin message
      if (ctx.messageId) {
        const { editMessageText } = await import('./api');
        await editMessageText(
          ctx.chatId,
          ctx.messageId,
          (callback.message?.text || '') + `\n\n✅ <b>APPROVED</b> by ${ctx.firstName}`
        );
      }
    } else if (data.startsWith('bot_reject_')) {
      if (!ctx.isAdmin) {
        await answerCallback(ctx.callbackQueryId!, '❌ Admin only');
        return;
      }
      const parts = data.substring(11).split('_');
      const orderId = parts[0];
      const userId = parseInt(parts[1], 10);
      await handleBotReject(
        ctx.callbackQueryId!,
        orderId,
        userId,
        ctx.firstName
      );
      await answerCallback(ctx.callbackQueryId!, '❌ Order rejected');

      if (ctx.messageId) {
        const { editMessageText } = await import('./api');
        await editMessageText(
          ctx.chatId,
          ctx.messageId,
          (callback.message?.text || '') + `\n\n❌ <b>REJECTED</b> by ${ctx.firstName}`
        );
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
    // ---- Existing web order approve/reject (backward compatible) ----
    else if (data.startsWith('approve_order:') || data.startsWith('reject_order:')) {
      // These are handled by the original webhook handler
      // Let them pass through without answering
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
    });

    if (ctx.callbackQueryId) {
      await answerCallback(ctx.callbackQueryId, '❌ Error occurred');
    }
  }
}
