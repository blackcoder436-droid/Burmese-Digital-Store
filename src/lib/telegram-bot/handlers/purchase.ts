// ==========================================
// VPN Purchase Flow Handlers
// Server → Protocol → Device → Plan → Payment
// ==========================================

import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import User from '@/models/User';
import { getOnlineServers, getServer } from '@/lib/vpn-servers';
import { getPlan, getPlansForDevices } from '@/lib/vpn-plans';
import { sendMessage } from '../api';
import { MSG } from '../messages';
import {
  serverKeyboard,
  protocolKeyboard,
  deviceKeyboard,
  planKeyboard,
  sendScreenshotKeyboard,
  mainMenuKeyboard,
} from '../keyboards';
import { setSession, getSession, updateSessionField } from '../session';
import { createLogger } from '@/lib/logger';
import { findOrCreateTelegramUser } from './commands';

const log = createLogger({ module: 'bot-purchase' });

/**
 * Show server selection
 */
export async function handleBuyKey(
  chatId: number,
  telegramId: number
): Promise<void> {
  const servers = await getOnlineServers();

  if (servers.length === 0) {
    await sendMessage(chatId, '❌ Server များ ယာယီပိတ်ထားပါသည်', {
      replyMarkup: mainMenuKeyboard(),
    });
    return;
  }

  // Initialize session
  setSession(telegramId, {});

  await sendMessage(chatId, MSG.selectServer, {
    replyMarkup: serverKeyboard(servers),
  });
}

/**
 * Handle server selection → show protocol selection
 */
export async function handleServerSelect(
  chatId: number,
  telegramId: number,
  serverId: string
): Promise<void> {
  const server = await getServer(serverId);

  if (!server || !server.enabled || !server.online) {
    await sendMessage(chatId, '❌ Server မရနိုင်ပါ', {
      replyMarkup: mainMenuKeyboard(),
    });
    return;
  }

  setSession(telegramId, { serverId });

  await sendMessage(chatId, MSG.selectProtocol(server.name), {
    replyMarkup: protocolKeyboard(serverId, server.enabledProtocols),
  });
}

/**
 * Handle protocol selection → show device count selection
 */
export async function handleProtocolSelect(
  chatId: number,
  telegramId: number,
  serverId: string,
  protocol: string
): Promise<void> {
  const server = await getServer(serverId);
  if (!server) {
    await sendMessage(chatId, MSG.error);
    return;
  }

  updateSessionField(telegramId, 'protocol', protocol);

  await sendMessage(
    chatId,
    MSG.selectDevices(server.name, protocol),
    { replyMarkup: deviceKeyboard(serverId) }
  );
}

/**
 * Handle device count selection → show plan/duration selection
 */
export async function handleDeviceSelect(
  chatId: number,
  telegramId: number,
  serverId: string,
  deviceCount: number
): Promise<void> {
  const server = await getServer(serverId);
  const session = getSession(telegramId);

  if (!server || !session?.protocol) {
    await sendMessage(chatId, MSG.error);
    return;
  }

  updateSessionField(telegramId, 'deviceCount', deviceCount);

  const plans = getPlansForDevices(deviceCount);

  await sendMessage(
    chatId,
    MSG.selectPlan(server.name, session.protocol, deviceCount),
    { replyMarkup: planKeyboard(serverId, plans) }
  );
}

/**
 * Handle plan selection → create order & show payment info
 */
export async function handlePlanSelect(
  chatId: number,
  telegramId: number,
  firstName: string,
  username: string | undefined,
  serverId: string,
  planId: string
): Promise<void> {
  const session = getSession(telegramId);
  const plan = getPlan(planId);
  const server = await getServer(serverId);

  if (!plan || !server || !session?.protocol) {
    await sendMessage(chatId, MSG.error);
    return;
  }

  try {
    await connectDB();

    // Find or create the user
    const user = await findOrCreateTelegramUser(telegramId, firstName, undefined, username);

    // Check ban
    if (user.isBanned) {
      await sendMessage(chatId, MSG.banned + (user.banReason || 'No reason'));
      return;
    }

    // Create order with pending status
    const order = await Order.create({
      user: user._id,
      orderType: 'vpn',
      quantity: 1,
      totalAmount: plan.price,
      paymentMethod: 'kpay', // will be determined by screenshot
      paymentScreenshot: 'pending', // will be updated when screenshot received
      transactionId: `BOT-${Date.now()}`,
      status: 'pending',
      vpnPlan: {
        serverId,
        planId,
        devices: plan.devices,
        months: plan.months,
        protocol: session.protocol,
      },
      vpnProvisionStatus: 'pending',
      paymentExpiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
    });

    // Update session with order details
    setSession(telegramId, {
      ...session,
      orderId: order._id.toString(),
      amount: plan.price,
      planId,
      serverId,
    });

    // Show payment info
    await sendMessage(
      chatId,
      MSG.paymentInfo({
        orderNumber: order.orderNumber,
        planName: plan.name,
        serverName: `${server.flag} ${server.name}`,
        protocol: session.protocol,
        amount: plan.price,
        orderId: order._id.toString(),
      }),
      { replyMarkup: sendScreenshotKeyboard(order._id.toString()) }
    );

    log.info('Bot order created', {
      orderId: order._id,
      telegramId,
      planId,
      serverId,
      amount: plan.price,
    });
  } catch (error) {
    log.error('Error creating bot order', {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendMessage(chatId, MSG.error);
  }
}

/**
 * Handle "Send Screenshot" button → prompt user to upload
 */
export async function handleSendScreenshot(
  chatId: number,
  telegramId: number,
  orderId: string
): Promise<void> {
  setSession(telegramId, {
    ...(getSession(telegramId) || {}),
    orderId,
    waitingScreenshot: true,
  });

  await sendMessage(chatId, MSG.waitingScreenshot);
}
