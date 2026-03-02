// ==========================================
// My Keys & Protocol Exchange Handlers
// ==========================================

import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import User from '@/models/User';
import { getServer } from '@/lib/vpn-servers';
import { getPlan } from '@/lib/vpn-plans';
import { provisionVpnKey, revokeVpnKey } from '@/lib/xui';
import { getFeatureFlag } from '@/models/SiteSettings';
import { sendMessage } from '../api';
import { MSG } from '../messages';
import {
  mainMenuKeyboard,
  exchangeProtocolKeyboard,
  markup,
} from '../keyboards';
import { setSession, getSession, clearSession } from '../session';
import { findOrCreateTelegramUser } from './commands';
import { createLogger } from '@/lib/logger';
import type { InlineKeyboard } from '../types';

const log = createLogger({ module: 'bot-keys' });

/**
 * Handle my_keys callback — show user's active VPN keys
 */
export async function handleMyKeys(
  chatId: number,
  telegramId: number,
  firstName: string,
  username?: string
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
      await sendMessage(chatId, MSG.noKeys, {
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

      text += `${statusIcon} <b>${server?.flag || ''} ${server?.name || 'Unknown'}</b>\n`;
      text += `⚙️ ${order.vpnKey.protocol.toUpperCase()} | 📱 ${order.vpnPlan.devices}D\n`;
      text += `📅 ${expiryDate} (${daysLeft} ရက်ကျန်)\n`;
      text += `🔗 Sub: <code>${order.vpnKey.subLink}</code>\n\n`;

      keyboard.push([
        {
          text: `📋 ${server?.name || 'Key'} - Details`,
          callback_data: `view_key_${order._id}`,
        },
      ]);
    }

    keyboard.push([{ text: '🏠 Main Menu', callback_data: 'main_menu' }]);

    await sendMessage(chatId, text, { replyMarkup: markup(keyboard) });
  } catch (error) {
    log.error('Error loading keys', {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendMessage(chatId, MSG.error);
  }
}

/**
 * Handle view_key_{id} callback — show detailed key info
 */
export async function handleViewKey(
  chatId: number,
  telegramId: number,
  orderId: string
): Promise<void> {
  try {
    await connectDB();

    const order = await Order.findById(orderId);
    if (!order || !order.vpnKey || !order.vpnPlan) {
      await sendMessage(chatId, '❌ Key မတွေ့ပါ');
      return;
    }

    const server = await getServer(order.vpnPlan.serverId);
    const plan = getPlan(order.vpnPlan.planId);

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
      `🌐 Server: ${server?.flag || ''} ${server?.name || 'Unknown'}\n` +
      `⚙️ Protocol: ${order.vpnKey.protocol.toUpperCase()}\n` +
      `📱 Devices: ${order.vpnPlan.devices}\n` +
      `📅 Expiry: ${expiryDate}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🔗 <b>Subscription Link:</b>\n` +
      `<code>${order.vpnKey.subLink}</code>\n\n` +
      `🔑 <b>Config Link:</b>\n` +
      `<code>${order.vpnKey.configLink}</code>\n` +
      `━━━━━━━━━━━━━━━━━━`;

    const keyboard: InlineKeyboard = [
      [{ text: '🔄 Protocol ပြောင်း', callback_data: `exkey_${orderId}` }],
      [{ text: '◀️ My Keys', callback_data: 'my_keys' }],
      [{ text: '🏠 Main Menu', callback_data: 'main_menu' }],
    ];

    await sendMessage(chatId, text, { replyMarkup: markup(keyboard) });
  } catch (error) {
    log.error('Error viewing key', {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendMessage(chatId, MSG.error);
  }
}

/**
 * Handle exchange_key callback — show active keys for exchange
 */
export async function handleExchangeKey(
  chatId: number,
  telegramId: number,
  firstName: string,
  username?: string
): Promise<void> {
  // Check feature flag
  const enabled = await getFeatureFlag('protocol_change');
  if (!enabled) {
    await sendMessage(chatId, MSG.exchangeDisabled, {
      replyMarkup: mainMenuKeyboard(),
    });
    return;
  }

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
      await sendMessage(chatId, MSG.exchangeNoKeys, {
        replyMarkup: mainMenuKeyboard(),
      });
      return;
    }

    let text = `🔄 <b>Protocol ပြောင်းမည့် Key ကိုရွေးပါ</b>\n\n`;
    const keyboard: InlineKeyboard = [];

    for (const order of orders) {
      if (!order.vpnKey || !order.vpnPlan) continue;
      const server = await getServer(order.vpnPlan.serverId);

      text += `• ${server?.flag || ''} ${server?.name || ''} - ${order.vpnKey.protocol.toUpperCase()}\n`;

      keyboard.push([
        {
          text: `🔄 ${server?.name || ''} (${order.vpnKey.protocol.toUpperCase()})`,
          callback_data: `exkey_${order._id}`,
        },
      ]);
    }

    keyboard.push([{ text: '🏠 Main Menu', callback_data: 'main_menu' }]);

    await sendMessage(chatId, text, { replyMarkup: markup(keyboard) });
  } catch (error) {
    log.error('Exchange key list error', {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendMessage(chatId, MSG.error);
  }
}

/**
 * Handle exkey_{orderId} callback — show protocol selection for exchange
 */
export async function handleExKeySelect(
  chatId: number,
  telegramId: number,
  orderId: string
): Promise<void> {
  try {
    await connectDB();
    const order = await Order.findById(orderId);

    if (!order?.vpnKey || !order.vpnPlan) {
      await sendMessage(chatId, '❌ Key မတွေ့ပါ');
      return;
    }

    const server = await getServer(order.vpnPlan.serverId);
    if (!server) {
      await sendMessage(chatId, MSG.error);
      return;
    }

    setSession(telegramId, {
      exchangeKeyId: orderId,
      exchangeServerId: order.vpnPlan.serverId,
    });

    await sendMessage(
      chatId,
      MSG.exchangeSelectProtocol(order.vpnKey.protocol),
      {
        replyMarkup: exchangeProtocolKeyboard(
          orderId,
          server.enabledProtocols,
          order.vpnKey.protocol
        ),
      }
    );
  } catch (error) {
    log.error('Exchange key select error', {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendMessage(chatId, MSG.error);
  }
}

/**
 * Handle expro_{orderId}_{protocol} callback — execute protocol exchange
 */
export async function handleExProtoSelect(
  chatId: number,
  telegramId: number,
  firstName: string,
  username: string | undefined,
  orderId: string,
  newProtocol: string
): Promise<void> {
  try {
    await connectDB();

    const order = await Order.findById(orderId);
    if (!order?.vpnKey || !order.vpnPlan) {
      await sendMessage(chatId, MSG.exchangeFailed);
      return;
    }

    const server = await getServer(order.vpnPlan.serverId);
    if (!server) {
      await sendMessage(chatId, MSG.exchangeFailed);
      return;
    }

    const oldClientEmail = order.vpnKey.clientEmail;

    // Calculate remaining days
    const remainingMs = order.vpnKey.expiryTime - Date.now();
    const remainingDays = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));

    // Create new key with new protocol (same expiry)
    const user = await findOrCreateTelegramUser(telegramId, firstName, undefined, username);
    const result = await provisionVpnKey({
      serverId: order.vpnPlan.serverId,
      username: username || firstName,
      userId: user._id.toString(),
      devices: order.vpnPlan.devices,
      expiryDays: remainingDays,
      dataLimitGB: 0,
      protocol: newProtocol,
    });

    if (!result) {
      await sendMessage(chatId, MSG.exchangeFailed);
      return;
    }

    // Delete old key from panel (3 retries)
    let deleted = false;
    for (let i = 0; i < 3; i++) {
      deleted = await revokeVpnKey(order.vpnPlan.serverId, oldClientEmail);
      if (deleted) break;
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!deleted) {
      log.warn('Failed to delete old key during exchange', {
        orderId,
        oldClientEmail,
      });
    }

    // Update order with new key
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
    order.vpnPlan.protocol = newProtocol;
    await order.save();

    clearSession(telegramId);

    // Send success + new key
    await sendMessage(chatId, MSG.exchangeSuccess(newProtocol));

    const expiryDate = new Date(result.expiryTime).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    const plan = getPlan(order.vpnPlan.planId);
    await sendMessage(
      chatId,
      MSG.keyGenerated({
        planName: plan?.name || 'VPN Key',
        serverName: `${server.flag} ${server.name}`,
        protocol: newProtocol,
        expiryDate,
        subLink: result.subLink,
        configLink: result.configLink,
      }),
      { replyMarkup: mainMenuKeyboard() }
    );

    log.info('Protocol exchange completed', {
      orderId,
      oldProtocol: order.vpnKey.protocol,
      newProtocol,
    });
  } catch (error) {
    log.error('Protocol exchange error', {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendMessage(chatId, MSG.exchangeFailed);
  }
}

/**
 * Handle check_usage callback — show usage for active keys
 */
export async function handleCheckUsage(
  chatId: number,
  telegramId: number,
  firstName: string,
  username?: string
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
      await sendMessage(chatId, MSG.noKeys, {
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

    await sendMessage(chatId, text, { replyMarkup: mainMenuKeyboard() });
  } catch (error) {
    log.error('Check usage error', {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendMessage(chatId, MSG.error);
  }
}
