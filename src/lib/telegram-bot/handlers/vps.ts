// src/lib/telegram-bot/handlers/vps.ts
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import { findOrCreateTelegramUser } from './commands';
import { createLogger } from '@/lib/logger';
import { BotContext } from '../types';
import { markup, sendScreenshotKeyboard } from '../keyboards';
import { MSG } from '../messages';
import { getSession, setSession } from '../session';

const log = createLogger({ module: 'bot-vps' });

async function reply(
  ctx: BotContext,
  text: string,
  options?: any
) {
  if (ctx.messageId) {
    const { editMessageText } = await import('../api');
    await editMessageText(ctx.chatId, ctx.messageId, text, options);
  } else {
    const { sendMessage } = await import('../api');
    await sendMessage(ctx.chatId, text, options);
  }
}

export async function handleVPSCategory(ctx: BotContext) {
  const { vpsPlans } = await import('@/lib/vps-plans');

  const message = `💻 <b>Cloud VPS Plans</b>\n\nမိမိဝယ်ယူလိုသော VPS Plan ကို အောက်ပါ Button များမှ ရွေးချယ်ပါ 👇`;

  const buttons = vpsPlans.map(plan => [
    { text: `🔹 ${plan.name} - ${plan.price.toLocaleString()} MMK`, callback_data: `vps_select_${plan.id}` }
  ]);
  
  buttons.push([{ text: '🔙 Back to Shop', callback_data: 'shop_categories' }]);

  await reply(ctx, message, {
    replyMarkup: markup(buttons)
  });
}

export async function handleVPSSelect(ctx: BotContext, vpsId: string) {
  const { vpsPlans } = await import('@/lib/vps-plans');
  const plan = vpsPlans.find(p => p.id === vpsId);
  if (!plan) {
    if (ctx.callbackQueryId) {
      const { answerCallback } = await import('../api');
      await answerCallback(ctx.callbackQueryId, 'VPS Plan not found');
    }
    return;
  }
  
  const specText = plan.specs.map(s => `▪️ <b>${s.label}:</b> ${s.value}`).join('\n');

  const text = `💻 <b>VPS: ${plan.name}</b>\n\n` +
               `💰 Price: ${plan.price.toLocaleString()} MMK / month\n\n` +
               `🔧 <b>Specifications</b>\n${specText}\n\n` +
               `Do you want to proceed with purchasing this VPS?`;
  
  const keyboard = markup([
    [
      { text: '❌ Cancel', callback_data: 'shop_cat_vps' },
      { text: '✅ Purchase', callback_data: `vps_buy_${plan.id}` }
    ]
  ]);

  await reply(ctx, text, {
    replyMarkup: keyboard
  });
}

export async function handleVPSBuy(ctx: BotContext, vpsId: string) {
  const { vpsPlans } = await import('@/lib/vps-plans');
  const plan = vpsPlans.find((p) => p.id === vpsId);
  if (!plan) return;

  try {
    await connectDB();

    const telegramId = ctx.userId;
    const firstName = ctx.firstName;
    const username = ctx.username;
    
    // Find or create the user
    const user = await findOrCreateTelegramUser(telegramId, firstName, undefined, username);

    if (user.isBanned) {
      await reply(ctx, MSG.banned + (user.banReason || 'No reason'));
      return;
    }

    // Create order with pending status
    const order = await Order.create({
      user: user._id,
      orderType: 'vps',
      quantity: 1,
      totalAmount: plan.price,
      paymentMethod: 'kpay', // default or wait for screenshot
      paymentScreenshot: 'pending',
      transactionId: `BOT-VPS-${Date.now()}`,
      status: 'pending',
      vpsPlan: plan,
      paymentExpiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
    });

    // Save order info in session
    setSession(telegramId, {
      ...getSession(telegramId),
      orderId: order._id.toString(),
      amount: plan.price,
    });

    const paymentInfo = `🛒 <b>Order #: ${order.orderNumber}</b>\n` +
      `📦 Item: VPS - ${plan.name}\n` +
      `💰 Amount: ${plan.price.toLocaleString()} MMK\n\n` +
      `📝 Please transfer the amount to our KPay/WavePay account and upload the screenshot.`;

    await reply(ctx, paymentInfo, {
      replyMarkup: sendScreenshotKeyboard(order._id.toString())
    });

    // Notify admin
    const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
    const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
    const targetChat = CHANNEL_ID || ADMIN_CHAT_ID;
    if (targetChat) {
      const { sendMessage } = await import('../api');
      const orderNotice = [
        `📦 <b>New VPS Bot Order: ${order.orderNumber}</b>`,
        ``,
        `👤 ${firstName}${username ? ` (@${username})` : ''} [${telegramId}]`,
        `🛒 VPS ${plan.name}`,
        `💰 <b>${plan.price.toLocaleString()} Ks</b>`,
        ``,
        `⏳ <i>Waiting for payment screenshot...</i>`,
      ].join('\n');
      await sendMessage(Number(targetChat), orderNotice).catch(() => {});
    }

  } catch (error) {
    log.error('Error creating VPS bot order', { error });
    await reply(ctx, MSG.error);
  }
}

