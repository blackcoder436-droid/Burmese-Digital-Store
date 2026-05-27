// ==========================================
// My Keys & Protocol Exchange Handlers
// ==========================================

import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import User from '@/models/User';
import { getServer } from '@/lib/vpn-servers';
import { getPlan } from '@/lib/vpn-plans';
import { provisionVpnKey, revokeVpnKey } from '@/lib/xui';
import { MSG } from '../messages';
import {
  mainMenuKeyboard,
  markup,
} from '../keyboards';
import { findOrCreateTelegramUser } from './commands';
import { createLogger } from '@/lib/logger';
import { getCustomerVpnSubLink } from '@/lib/order-sanitize';
import type { InlineKeyboard } from '../types';

const log = createLogger({ module: 'bot-keys' });

async function reply(chatId: any, messageId: any, text: any, options?: any) {
  if (messageId) {
    const api = await import('../api');
    await api.editMessageText(chatId, messageId, text, options);
  } else {
    const api = await import('../api');
    await api.sendMessage(chatId, text, options);
  }
}


/**
 * Handle my_keys callback — show user's active VPN keys
 */
export async function handleMyKeys(
  chatId: number,
  telegramId: number,
  firstName: string,
  username?: string,
  messageId?: number
): Promise<void> {
  try {
    await connectDB();

    const user = await findOrCreateTelegramUser(telegramId, firstName, undefined, username);

    const orders = await Order.find({
      user: user._id,
      orderType: 'vpn',
      vpnProvisionStatus: 'provisioned',
      'vpnKey.expiryTime': { $gt: Date.now() },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    if (orders.length === 0) {
      await reply(chatId, messageId, MSG.noKeys, {
        replyMarkup: mainMenuKeyboard(),
      });
      return;
    }

    let text = `🔑 <b>Your VPN Keys</b>\n\n`;

    const keyboard: InlineKeyboard = [];

    for (const order of orders) {
      if (!order.vpnKey || !order.vpnPlan) continue;

      const server = await getServer(order.vpnPlan.serverId);
      const expiryDate = new Date(order.vpnKey.expiryTime).toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      const daysLeft = Math.ceil(
        (order.vpnKey.expiryTime - Date.now()) / (24 * 60 * 60 * 1000)
      );

      const statusIcon = daysLeft <= 3 ? '🔴' : daysLeft <= 7 ? '🟡' : '🟢';
      
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://burmesedigital.store';
      const displaySubLink = order.multiSubToken ? `${appUrl}/api/vpn/sub/${order.multiSubToken}` : order.vpnKey.subLink;

      text += `${statusIcon} <b>${order.multiSubToken ? 'All Enabled Servers' : (server?.flag || '' + ' ' + (server?.name || 'Unknown'))}</b>\n`;
      text += `⚙️ ${order.vpnKey.protocol.toUpperCase()} | 📱 ${order.vpnPlan.devices}D\n`;
      text += `📅 ${expiryDate} (${daysLeft} ရက်ကျန်)\n`;
      text += `🔗 Sub: <code>${displaySubLink}</code>\n\n`;

      keyboard.push([
        {
          text: `📋 ${server?.name || 'Key'} - Details`,
          callback_data: `view_key_${order._id}`,
        },
      ]);
    }

    keyboard.push([{ text: '🏠 Main Menu', callback_data: 'main_menu' }]);

    await reply(chatId, messageId, text, { replyMarkup: markup(keyboard) });
  } catch (error) {
    log.error('Error loading keys', {
      error: error instanceof Error ? error.message : String(error),
    });
    await reply(chatId, messageId, MSG.error);
  }
}

/**
 * Handle view_key_{id} callback — show detailed key info
 */
export async function handleViewKey(
  chatId: number,
  telegramId: number,
  orderId: string,
  messageId?: number
): Promise<void> {
  try {
    await connectDB();

    const order = await Order.findById(orderId);
    if (!order || !order.vpnKey || !order.vpnPlan) {
      await reply(chatId, messageId, '❌ Key မတွေ့ပါ');
      return;
    }

    const server = await getServer(order.vpnPlan.serverId);
    const plan = getPlan(order.vpnPlan.planId);
    const displaySubLink = getCustomerVpnSubLink(order.multiSubToken, order.vpnKey.subLink);
    const serverLabel = order.multiSubToken
      ? 'All Enabled Servers'
      : `${server?.flag || ''} ${server?.name || 'Unknown'}`;
    const subLabel = order.multiSubToken ? 'Multi-Server Subscription Link' : 'Subscription Link';

    const expiryDate = new Date(order.vpnKey.expiryTime).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const text =
      `🔑 <b>Key Details</b>\n\n` +
      `📦 Order: ${order.orderNumber}\n` +
      `📋 Plan: ${plan?.name || order.vpnPlan.planId}\n` +
      `🌐 Server: ${serverLabel}\n` +
      `⚙️ Protocol: ${order.vpnKey.protocol.toUpperCase()}\n` +
      `📱 Devices: ${order.vpnPlan.devices}\n` +
      `📅 Expiry: ${expiryDate}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🔗 <b>${subLabel}:</b>\n` +
      `<code>${displaySubLink}</code>\n` +
      `━━━━━━━━━━━━━━━━━━`;

    const keyboard: InlineKeyboard = [];
    keyboard.push([{ text: '◀️ My Keys', callback_data: 'my_keys' }]);
    keyboard.push([{ text: '🏠 Main Menu', callback_data: 'main_menu' }]);

    await reply(chatId, messageId, text, { replyMarkup: markup(keyboard) });
  } catch (error) {
    log.error('Error viewing key', {
      error: error instanceof Error ? error.message : String(error),
    });
    await reply(chatId, messageId, MSG.error);
  }
}

/**
 * Handle check_usage callback — show usage for active keys
 */
export async function handleCheckUsage(
  chatId: number,
  telegramId: number,
  firstName: string,
  username?: string,
  messageId?: number
): Promise<void> {
  try {
    await connectDB();
    const user = await findOrCreateTelegramUser(telegramId, firstName, undefined, username);

    const orders = await Order.find({
      user: user._id,
      orderType: 'vpn',
      vpnProvisionStatus: 'provisioned',
      'vpnKey.expiryTime': { $gt: Date.now() },
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    if (orders.length === 0) {
      await reply(chatId, messageId, MSG.noKeys, {
        replyMarkup: mainMenuKeyboard(),
      });
      return;
    }

    let text = `📊 <b>Usage Report</b>\n\n`;

    for (const order of orders) {
      if (!order.vpnKey || !order.vpnPlan) continue;

      const server = await getServer(order.vpnPlan.serverId);
      const daysLeft = Math.ceil(
        (order.vpnKey.expiryTime - Date.now()) / (24 * 60 * 60 * 1000)
      );

      text += `${server?.flag || ''} <b>${server?.name || 'Unknown'}</b>\n`;
      text += `⚙️ ${order.vpnKey.protocol.toUpperCase()} | 📅 ${daysLeft} ရက်ကျန်\n\n`;
    }

    await reply(chatId, messageId, text, { replyMarkup: mainMenuKeyboard() });
  } catch (error) {
    log.error('Check usage error', {
      error: error instanceof Error ? error.message : String(error),
    });
    await reply(chatId, messageId, MSG.error);
  }
}
