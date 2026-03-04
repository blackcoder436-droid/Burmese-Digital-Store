// ==========================================
// Admin Bot Command Handlers
// Admin panel, stats, bans, servers, features, broadcast, create key
// ==========================================

import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Order from '@/models/Order';
import { getAllServers, getServer, invalidateServerCache } from '@/lib/vpn-servers';
import VpnServerModel from '@/models/VpnServer';
import {
  getSiteSettings,
  getAllFeatureFlags,
  setFeatureFlag,
} from '@/models/SiteSettings';
import { sendMessage, editMessageText } from '../api';
import { MSG } from '../messages';
import {
  adminPanelKeyboard,
  adminServersKeyboard,
  adminFeaturesKeyboard,
  adminBansKeyboard,
  adminCreateKeyTypeKeyboard,
  adminCreateKeyServerKeyboard,
  adminCreateKeyProtocolKeyboard,
  adminCreateKeyDeviceKeyboard,
  adminCreateKeyDurationKeyboard,
  statsKeyboard,
  mainMenuKeyboard,
} from '../keyboards';
import { setSession, getSession, clearSession } from '../session';
import { provisionVpnKey } from '@/lib/xui';
import { createLogger } from '@/lib/logger';

const log = createLogger({ module: 'bot-admin' });

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID;

/** All admin user IDs (comma-separated ADMIN_CHAT_ID support) */
const ADMIN_IDS: string[] = (ADMIN_CHAT_ID || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

/** Channels from which approve/reject is allowed */
const APPROVE_CHANNELS: string[] = [
  process.env.TELEGRAM_CHANNEL_ID,
  ...(process.env.TELEGRAM_APPROVE_CHANNELS || '').split(',').map((id) => id.trim()),
].filter(Boolean) as string[];

/**
 * Check if a telegram user is an admin
 */
export function isAdmin(telegramId: number): boolean {
  return ADMIN_IDS.includes(String(telegramId));
}

/**
 * Check if a chat/channel is in the approved channels list.
 * Used to allow approve/reject from additional channels.
 */
export function isApproveChannel(chatId: number): boolean {
  return APPROVE_CHANNELS.includes(String(chatId));
}

/**
 * Handle /admin command — show admin panel
 */
export async function handleAdmin(chatId: number): Promise<void> {
  await sendMessage(chatId, MSG.adminPanel, {
    replyMarkup: adminPanelKeyboard(),
  });
}

/**
 * Handle admin_back callback
 */
export async function handleAdminBack(chatId: number): Promise<void> {
  await handleAdmin(chatId);
}

/**
 * Handle admin_sales callback — sales report
 */
export async function handleAdminSales(chatId: number): Promise<void> {
  try {
    await connectDB();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalOrders, todayOrders, totalRevenue, todayRevenue, totalUsers, activeKeys, pendingOrders] =
      await Promise.all([
        Order.countDocuments({ status: 'completed' }),
        Order.countDocuments({ status: 'completed', createdAt: { $gte: today } }),
        Order.aggregate([
          { $match: { status: 'completed' } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]),
        Order.aggregate([
          { $match: { status: 'completed', createdAt: { $gte: today } } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]),
        User.countDocuments(),
        Order.countDocuments({
          orderType: 'vpn',
          vpnProvisionStatus: 'provisioned',
          'vpnKey.expiryTime': { $gt: Date.now() },
        }),
        Order.countDocuments({ status: { $in: ['pending', 'verifying'] } }),
      ]);

    const text =
      `📊 <b>Sales Report</b>\n\n` +
      `📦 စုစုပေါင်း Orders: ${totalOrders}\n` +
      `📅 ယနေ့ Orders: ${todayOrders}\n` +
      `💰 စုစုပေါင်း Revenue: ${(totalRevenue[0]?.total || 0).toLocaleString()} Ks\n` +
      `💰 ယနေ့ Revenue: ${(todayRevenue[0]?.total || 0).toLocaleString()} Ks\n` +
      `👥 စုစုပေါင်း Users: ${totalUsers}\n` +
      `🔑 Active Keys: ${activeKeys}\n` +
      `⏳ Pending Orders: ${pendingOrders}`;

    await sendMessage(chatId, text, {
      replyMarkup: adminPanelKeyboard(),
    });
  } catch (error) {
    log.error('Admin sales error', {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendMessage(chatId, MSG.error);
  }
}

/**
 * Handle admin_stats callback — show stats period selection
 */
export async function handleAdminStats(chatId: number): Promise<void> {
  await sendMessage(chatId, `📈 <b>Statistics</b>\n\nကာလရွေးပါ:`, {
    replyMarkup: statsKeyboard(),
  });
}

/**
 * Handle stats period callbacks
 */
export async function handleStatsPeriod(
  chatId: number,
  period: 'today' | 'week' | 'month' | 'all'
): Promise<void> {
  try {
    await connectDB();

    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'today':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
      default:
        startDate = new Date(0);
    }

    const dateFilter = period === 'all' ? {} : { createdAt: { $gte: startDate } };

    const [orders, revenue, users, vpnOrders, productOrders] = await Promise.all([
      Order.countDocuments({ ...dateFilter, status: 'completed' }),
      Order.aggregate([
        { $match: { ...dateFilter, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      User.countDocuments(dateFilter),
      Order.countDocuments({ ...dateFilter, status: 'completed', orderType: 'vpn' }),
      Order.countDocuments({ ...dateFilter, status: 'completed', orderType: 'product' }),
    ]);

    const periodLabels = {
      today: 'ယနေ့',
      week: 'ဤအပတ်',
      month: 'ဤလ',
      all: 'အားလုံး',
    };

    const text =
      `📈 <b>Statistics — ${periodLabels[period]}</b>\n\n` +
      `📦 Orders: ${orders}\n` +
      `💰 Revenue: ${(revenue[0]?.total || 0).toLocaleString()} Ks\n` +
      `👥 New Users: ${users}\n` +
      `🔐 VPN Orders: ${vpnOrders}\n` +
      `🛒 Product Orders: ${productOrders}`;

    await sendMessage(chatId, text, { replyMarkup: statsKeyboard() });
  } catch (error) {
    log.error('Stats period error', {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendMessage(chatId, MSG.error);
  }
}

/**
 * Handle stats_top_users callback
 */
export async function handleStatsTopUsers(chatId: number): Promise<void> {
  try {
    await connectDB();

    const topUsers = await Order.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: '$user',
          totalSpent: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
    ]);

    let text = `👑 <b>Top Users</b>\n\n`;

    for (let i = 0; i < topUsers.length; i++) {
      const u = topUsers[i];
      const name = u.user.telegramUsername
        ? `@${u.user.telegramUsername}`
        : u.user.name;
      text += `${i + 1}. ${name}\n`;
      text += `   💰 ${u.totalSpent.toLocaleString()} Ks | 📦 ${u.orderCount} orders\n\n`;
    }

    await sendMessage(chatId, text, { replyMarkup: statsKeyboard() });
  } catch (error) {
    log.error('Top users error', {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendMessage(chatId, MSG.error);
  }
}

/**
 * Handle admin_pending callback
 */
export async function handleAdminPending(chatId: number): Promise<void> {
  try {
    await connectDB();

    const orders = await Order.find({
      status: { $in: ['pending', 'verifying'] },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('user', 'name telegramUsername telegramId')
      .lean();

    if (orders.length === 0) {
      await sendMessage(chatId, '✅ Pending orders မရှိပါ', {
        replyMarkup: adminPanelKeyboard(),
      });
      return;
    }

    let text = `📋 <b>Pending Orders (${orders.length})</b>\n\n`;

    for (const order of orders) {
      const user = order.user as unknown as {
        name?: string;
        telegramUsername?: string;
        telegramId?: number;
      };
      const name = user?.telegramUsername
        ? `@${user.telegramUsername}`
        : user?.name || 'Unknown';

      text += `📦 ${order.orderNumber} | ${order.status}\n`;
      text += `👤 ${name}\n`;
      text += `💰 ${order.totalAmount.toLocaleString()} Ks\n`;
      text += `📅 ${new Date(order.createdAt).toLocaleString()}\n\n`;
    }

    await sendMessage(chatId, text, { replyMarkup: adminPanelKeyboard() });
  } catch (error) {
    log.error('Admin pending error', {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendMessage(chatId, MSG.error);
  }
}

/**
 * Handle admin_users callback
 */
export async function handleAdminUsers(chatId: number): Promise<void> {
  try {
    await connectDB();

    const [totalUsers, botUsers, webUsers, bannedUsers] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ telegramId: { $ne: null } }),
      User.countDocuments({ telegramId: null }),
      User.countDocuments({ isBanned: true }),
    ]);

    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('name telegramUsername telegramId createdAt')
      .lean();

    let text =
      `👥 <b>Users</b>\n\n` +
      `📊 Total: ${totalUsers}\n` +
      `🤖 Bot Users: ${botUsers}\n` +
      `🌐 Web Users: ${webUsers}\n` +
      `🚫 Banned: ${bannedUsers}\n\n` +
      `📋 <b>Recent Users:</b>\n`;

    for (const u of recentUsers) {
      const name = u.telegramUsername ? `@${u.telegramUsername}` : u.name;
      const source = u.telegramId ? '🤖' : '🌐';
      text += `${source} ${name}\n`;
    }

    await sendMessage(chatId, text, { replyMarkup: adminPanelKeyboard() });
  } catch (error) {
    log.error('Admin users error', {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendMessage(chatId, MSG.error);
  }
}

/**
 * Handle admin_servers callback
 */
export async function handleAdminServers(chatId: number): Promise<void> {
  try {
    const servers = await getAllServers();
    const serverList = Object.values(servers);

    await sendMessage(
      chatId,
      `🖥️ <b>Server Management</b>\n\nServers: ${serverList.length}\n\nServer ကို နှိပ်ပြီး toggle ပါ:`,
      { replyMarkup: adminServersKeyboard(serverList) }
    );
  } catch (error) {
    log.error('Admin servers error', {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendMessage(chatId, MSG.error);
  }
}

/**
 * Handle toggle_server_{id} callback
 */
export async function handleToggleServer(
  chatId: number,
  serverId: string
): Promise<void> {
  try {
    await connectDB();

    const server = await VpnServerModel.findOne({ serverId });
    if (!server) {
      await sendMessage(chatId, '❌ Server မတွေ့ပါ');
      return;
    }

    server.enabled = !server.enabled;
    await server.save();
    invalidateServerCache();

    await sendMessage(
      chatId,
      `${server.enabled ? '🟢' : '🔴'} ${server.name} — ${server.enabled ? 'Enabled' : 'Disabled'}`
    );

    // Refresh server list
    await handleAdminServers(chatId);
  } catch (error) {
    log.error('Toggle server error', {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendMessage(chatId, MSG.error);
  }
}

/**
 * Handle admin_features callback
 */
export async function handleAdminFeatures(chatId: number): Promise<void> {
  try {
    const flags = await getAllFeatureFlags();

    const featureNames: Record<string, string> = {
      referral_system: 'Referral System',
      free_test_key: 'Free Test Key',
      protocol_change: 'Protocol ပြောင်း',
      auto_approve: 'Auto Approve',
    };

    const features = flags.map((f) => ({
      id: f.name,
      name: featureNames[f.name] || f.name,
      enabled: f.enabled,
    }));

    await sendMessage(
      chatId,
      `⚙️ <b>Feature Management</b>\n\nFeature ကို နှိပ်ပြီး toggle ပါ:`,
      { replyMarkup: adminFeaturesKeyboard(features) }
    );
  } catch (error) {
    log.error('Admin features error', {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendMessage(chatId, MSG.error);
  }
}

/**
 * Handle toggle_feature_{name} callback
 */
export async function handleToggleFeature(
  chatId: number,
  featureName: string,
  adminName: string
): Promise<void> {
  try {
    const flags = await getAllFeatureFlags();
    const flag = flags.find((f) => f.name === featureName);
    const newValue = !(flag?.enabled ?? true);

    await setFeatureFlag(featureName, newValue, adminName);

    await sendMessage(
      chatId,
      `${newValue ? '✅' : '❌'} ${featureName} — ${newValue ? 'Enabled' : 'Disabled'}`
    );

    // Refresh features list
    await handleAdminFeatures(chatId);
  } catch (error) {
    log.error('Toggle feature error', {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendMessage(chatId, MSG.error);
  }
}

/**
 * Handle admin_bans callback
 */
export async function handleAdminBans(chatId: number): Promise<void> {
  await sendMessage(chatId, `🚫 <b>Ban Management</b>`, {
    replyMarkup: adminBansKeyboard(),
  });
}

/**
 * Handle ban_user_start — prompt for user ID
 */
export async function handleBanUserStart(
  chatId: number,
  telegramId: number
): Promise<void> {
  setSession(telegramId, { action: 'ban_user' });
  await sendMessage(
    chatId,
    `🚫 Ban ပေးမည့် user ၏ Telegram ID ကို ပို့ပါ:\n\n` +
      `Format: <code>TELEGRAM_ID REASON</code>\n` +
      `Example: <code>123456789 Fraud detected</code>`
  );
}

/**
 * Handle unban_user_start — prompt for user ID
 */
export async function handleUnbanUserStart(
  chatId: number,
  telegramId: number
): Promise<void> {
  setSession(telegramId, { action: 'unban_user' });
  await sendMessage(
    chatId,
    `✅ Unban ပေးမည့် user ၏ Telegram ID ကို ပို့ပါ:`
  );
}

/**
 * Handle ban_list callback
 */
export async function handleBanList(chatId: number): Promise<void> {
  try {
    await connectDB();

    const bannedUsers = await User.find({ isBanned: true })
      .select('name telegramId telegramUsername banReason bannedUntil')
      .limit(20)
      .lean();

    if (bannedUsers.length === 0) {
      await sendMessage(chatId, '✅ Banned users မရှိပါ', {
        replyMarkup: adminBansKeyboard(),
      });
      return;
    }

    let text = `🚫 <b>Banned Users (${bannedUsers.length})</b>\n\n`;

    for (const u of bannedUsers) {
      const name = u.telegramUsername
        ? `@${u.telegramUsername}`
        : u.name;
      text += `• ${name} (ID: ${u.telegramId || 'N/A'})\n`;
      text += `  Reason: ${u.banReason || 'N/A'}\n\n`;
    }

    await sendMessage(chatId, text, { replyMarkup: adminBansKeyboard() });
  } catch (error) {
    log.error('Ban list error', {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendMessage(chatId, MSG.error);
  }
}

/**
 * Process ban user from admin text input
 */
export async function processBanUser(
  chatId: number,
  text: string
): Promise<void> {
  try {
    await connectDB();

    const parts = text.split(' ');
    const targetId = parseInt(parts[0], 10);
    const reason = parts.slice(1).join(' ') || 'Admin ban';

    if (isNaN(targetId)) {
      await sendMessage(chatId, '❌ Invalid Telegram ID');
      return;
    }

    const user = await User.findOne({ telegramId: targetId });
    if (!user) {
      await sendMessage(chatId, '❌ User မတွေ့ပါ');
      return;
    }

    user.isBanned = true;
    user.banReason = reason;
    user.bannedBy = 'admin';
    await user.save();

    await sendMessage(
      chatId,
      `🚫 ${user.name} (ID: ${targetId}) banned\nReason: ${reason}`,
      { replyMarkup: adminBansKeyboard() }
    );

    // Notify banned user
    await sendMessage(
      targetId,
      MSG.banned + reason
    );

    log.info('User banned via bot', { targetId, reason });
  } catch (error) {
    log.error('Ban user error', {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendMessage(chatId, MSG.error);
  }
}

/**
 * Process unban user from admin text input
 */
export async function processUnbanUser(
  chatId: number,
  text: string
): Promise<void> {
  try {
    await connectDB();

    const targetId = parseInt(text.trim(), 10);
    if (isNaN(targetId)) {
      await sendMessage(chatId, '❌ Invalid Telegram ID');
      return;
    }

    const user = await User.findOne({ telegramId: targetId });
    if (!user) {
      await sendMessage(chatId, '❌ User မတွေ့ပါ');
      return;
    }

    user.isBanned = false;
    user.banReason = undefined;
    user.bannedUntil = undefined;
    await user.save();

    await sendMessage(
      chatId,
      `✅ ${user.name} (ID: ${targetId}) unbanned`,
      { replyMarkup: adminBansKeyboard() }
    );

    log.info('User unbanned via bot', { targetId });
  } catch (error) {
    log.error('Unban user error', {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendMessage(chatId, MSG.error);
  }
}

/**
 * Handle /broadcast command
 */
export async function handleBroadcast(
  chatId: number,
  message: string
): Promise<void> {
  if (!message.trim()) {
    await sendMessage(chatId, '❌ Broadcast message ရေးပါ\n\nFormat: /broadcast MESSAGE');
    return;
  }

  try {
    await connectDB();

    const users = await User.find({ telegramId: { $ne: null }, isBanned: false })
      .select('telegramId')
      .lean();

    if (users.length === 0) {
      await sendMessage(chatId, '❌ Bot users မရှိပါ');
      return;
    }

    const broadcastText = `📢 <b>Announcement</b>\n\n${message}`;

    let sent = 0;
    let failed = 0;

    for (const user of users) {
      if (!user.telegramId) continue;
      try {
        const result = await sendMessage(user.telegramId, broadcastText);
        if (result.ok) sent++;
        else failed++;
      } catch {
        failed++;
      }

      // Rate limit: sleep every 25 messages
      if ((sent + failed) % 25 === 0) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    await sendMessage(
      chatId,
      `📢 <b>Broadcast Complete</b>\n\n✅ Sent: ${sent}\n❌ Failed: ${failed}\n📊 Total: ${users.length}`,
      { replyMarkup: adminPanelKeyboard() }
    );

    log.info('Broadcast completed', { sent, failed, total: users.length });
  } catch (error) {
    log.error('Broadcast error', {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendMessage(chatId, MSG.error);
  }
}

/**
 * Handle /ban command
 */
export async function handleBanCommand(
  chatId: number,
  args: string
): Promise<void> {
  if (!args.trim()) {
    await sendMessage(chatId, '❌ Format: /ban TELEGRAM_ID [REASON]');
    return;
  }
  await processBanUser(chatId, args);
}

/**
 * Handle /unban command
 */
export async function handleUnbanCommand(
  chatId: number,
  args: string
): Promise<void> {
  if (!args.trim()) {
    await sendMessage(chatId, '❌ Format: /unban TELEGRAM_ID');
    return;
  }
  await processUnbanUser(chatId, args);
}

// ==========================================
// Admin Create Key Flow
// ==========================================

/**
 * Helper: edit existing message or send new one
 */
async function editOrSend(
  chatId: number,
  messageId: number | undefined,
  text: string,
  replyMarkup?: import('../types').InlineKeyboardMarkup
): Promise<void> {
  if (messageId) {
    const ok = await editMessageText(chatId, messageId, text, { replyMarkup });
    if (ok) return;
  }
  // Fallback: send new message
  await sendMessage(chatId, text, { replyMarkup });
}

/**
 * Show key type selection (test / sell)
 */
export async function handleAdminCreateKey(chatId: number, messageId?: number): Promise<void> {
  await editOrSend(
    chatId,
    messageId,
    '🔑 <b>VPN Key ထုတ်ပေးမည်</b>\n\nKey အမျိုးအစား ရွေးပါ:',
    adminCreateKeyTypeKeyboard()
  );
}

/**
 * Handle key type selection → show server list
 */
export async function handleAdminKeyType(
  chatId: number,
  keyType: string,
  messageId?: number
): Promise<void> {
  const serversMap = await getAllServers();
  const serverList = Object.values(serversMap);
  const label = keyType === 'test' ? '🧪 Test Key' : '🔑 Sell Key';
  await editOrSend(
    chatId,
    messageId,
    `${label}\n\nServer ရွေးပါ:`,
    adminCreateKeyServerKeyboard(serverList, keyType)
  );
}

/**
 * Handle server selection → show protocol list
 */
export async function handleAdminKeyServer(
  chatId: number,
  keyType: string,
  serverId: string,
  messageId?: number
): Promise<void> {
  const server = await getServer(serverId);
  if (!server) {
    await editOrSend(chatId, messageId, '❌ Server မတွေ့ပါ');
    return;
  }

  await editOrSend(
    chatId,
    messageId,
    `📡 ${server.flag} ${server.name}\n\nProtocol ရွေးပါ:`,
    adminCreateKeyProtocolKeyboard(serverId, keyType, server.enabledProtocols)
  );
}

/**
 * Handle protocol selection → show device count (sell) or create immediately (test)
 */
export async function handleAdminKeyProtocol(
  chatId: number,
  keyType: string,
  serverId: string,
  protocol: string,
  messageId?: number
): Promise<void> {
  if (keyType === 'test') {
    // Test key: 1 device, 3 days, 3GB — create immediately
    await createAdminKey(chatId, messageId, keyType, serverId, protocol, 1, 3, 3);
  } else {
    // Sell key: ask device count
    await editOrSend(
      chatId,
      messageId,
      `🔧 Protocol: <b>${protocol.toUpperCase()}</b>\n\nDevice အရေအတွက် ရွေးပါ:`,
      adminCreateKeyDeviceKeyboard(serverId, keyType, protocol)
    );
  }
}

/**
 * Handle device selection → show duration
 */
export async function handleAdminKeyDevice(
  chatId: number,
  keyType: string,
  serverId: string,
  protocol: string,
  devices: number,
  messageId?: number
): Promise<void> {
  await editOrSend(
    chatId,
    messageId,
    `📱 ${devices} Device${devices > 1 ? 's' : ''}\n\nသက်တမ်း ရွေးပါ:`,
    adminCreateKeyDurationKeyboard(serverId, keyType, protocol, devices)
  );
}

/**
 * Handle duration selection → create key
 */
export async function handleAdminKeyDuration(
  chatId: number,
  keyType: string,
  serverId: string,
  protocol: string,
  devices: number,
  expiryDays: number,
  messageId?: number
): Promise<void> {
  await createAdminKey(chatId, messageId, keyType, serverId, protocol, devices, expiryDays, 0);
}

/**
 * Create a VPN key and send the result to admin
 */
async function createAdminKey(
  chatId: number,
  messageId: number | undefined,
  keyType: string,
  serverId: string,
  protocol: string,
  devices: number,
  expiryDays: number,
  dataLimitGB: number
): Promise<void> {
  const server = await getServer(serverId);
  if (!server) {
    await editOrSend(chatId, messageId, '❌ Server မတွေ့ပါ');
    return;
  }

  // Show loading on same message
  await editOrSend(chatId, messageId, '⏳ Key ဖန်တီးနေပါသည်...');

  try {
    const label = keyType === 'test' ? 'test' : 'admin';
    const username = `${label}_${Date.now().toString(36)}`;

    const result = await provisionVpnKey({
      serverId,
      username,
      userId: `admin_bot_${chatId}`,
      devices,
      expiryDays,
      dataLimitGB,
      protocol,
    });

    if (!result) {
      // Result message — send new (can't edit loading to include keyboard reliably)
      await sendMessage(chatId, '❌ Key ဖန်တီးရာတွင် အမှားဖြစ်ပါသည်။ Server ချိတ်ဆက်မှု စစ်ဆေးပါ', {
        replyMarkup: adminPanelKeyboard(),
      });
      return;
    }

    const typeLabel = keyType === 'test' ? '🧪 TEST KEY' : '🔑 SELL KEY';
    const dataLabel = dataLimitGB === 0 ? 'Unlimited' : `${dataLimitGB} GB`;
    const expiryDate = new Date(result.expiryTime).toLocaleDateString('en-GB');

    const resultMsg = [
      `✅ <b>${typeLabel} Created!</b>`,
      '',
      `🖥️ Server: ${server.flag} ${server.name}`,
      `🔧 Protocol: ${protocol.toUpperCase()}`,
      `📱 Devices: ${devices}`,
      `📅 Expiry: ${expiryDays} days (${expiryDate})`,
      `📊 Data: ${dataLabel}`,
      '',
      `📋 <b>Subscription Link:</b>`,
      `<code>${result.subLink}</code>`,
      '',
      `📋 <b>Config Link:</b>`,
      `<code>${result.configLink}</code>`,
      '',
      '👆 Link ကိုနှိပ်ပြီး Copy ယူပါ',
    ].join('\n');

    // Final result: send as new message (links are important, ensure they display)
    await sendMessage(chatId, resultMsg, {
      replyMarkup: adminPanelKeyboard(),
    });

    log.info('Admin created VPN key via bot', {
      keyType,
      serverId,
      protocol,
      devices,
      expiryDays,
      clientEmail: result.clientEmail,
    });
  } catch (error) {
    log.error('Admin create key error', {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendMessage(chatId, '❌ Key ဖန်တီးရာတွင် အမှားဖြစ်ပါသည်', {
      replyMarkup: adminPanelKeyboard(),
    });
  }
}
