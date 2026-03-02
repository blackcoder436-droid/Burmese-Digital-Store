// ==========================================
// Referral System Handlers
// ==========================================

import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Referral, { getReferralStats, markReferralPaid, getReferrer } from '@/models/Referral';
import Order from '@/models/Order';
import { getOnlineServers } from '@/lib/vpn-servers';
import { provisionVpnKey } from '@/lib/xui';
import { getFeatureFlag } from '@/models/SiteSettings';
import { sendMessage } from '../api';
import { MSG } from '../messages';
import { referralKeyboard, mainMenuKeyboard } from '../keyboards';
import { findOrCreateTelegramUser } from './commands';
import { createLogger } from '@/lib/logger';
import mongoose from 'mongoose';

const log = createLogger({ module: 'bot-referral' });

const REFERRAL_BONUS_DAYS = 5;
const FREE_MONTH_THRESHOLD = 3; // 3 paid referrals to claim free month

/**
 * Handle referral callback — show referral menu
 */
export async function handleReferral(
  chatId: number,
  telegramId: number,
  firstName: string,
  username?: string
): Promise<void> {
  const enabled = await getFeatureFlag('referral_system');
  if (!enabled) {
    await sendMessage(chatId, MSG.referralDisabled, {
      replyMarkup: mainMenuKeyboard(),
    });
    return;
  }

  try {
    await connectDB();
    const user = await findOrCreateTelegramUser(telegramId, firstName, undefined, username);

    // Ensure user has a referral code
    if (!user.referralCode) {
      const crypto = await import('crypto');
      user.referralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      await user.save();
    }

    const stats = await getReferralStats(user._id);

    const canClaimFreeMonth =
      stats.paidReferrals >= FREE_MONTH_THRESHOLD &&
      stats.paidReferrals % FREE_MONTH_THRESHOLD === 0;

    await sendMessage(
      chatId,
      MSG.referralInfo({
        referralCode: user.referralCode,
        totalReferred: stats.totalReferred,
        paidReferrals: stats.paidReferrals,
        bonusDays: user.referralBonusDays || 0,
        canClaimFreeMonth,
      }),
      { replyMarkup: referralKeyboard(canClaimFreeMonth) }
    );
  } catch (error) {
    log.error('Referral info error', {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendMessage(chatId, MSG.error);
  }
}

/**
 * Handle my_referral_link callback
 */
export async function handleMyReferralLink(
  chatId: number,
  telegramId: number,
  firstName: string,
  username?: string
): Promise<void> {
  try {
    await connectDB();
    const user = await findOrCreateTelegramUser(telegramId, firstName, undefined, username);

    if (!user.referralCode) {
      const crypto = await import('crypto');
      user.referralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      await user.save();
    }

    const link = `https://t.me/BurmeseDigitalStore_bot?start=REF_${user.referralCode}`;

    await sendMessage(
      chatId,
      `🔗 <b>Your Referral Link:</b>\n\n<code>${link}</code>\n\n` +
        `👆 Link ကို copy ပြီး သူငယ်ချင်းတွေကို share ပါ!\n` +
        `သူတို့ key ဝယ်ရင် သင် +${REFERRAL_BONUS_DAYS} ရက် bonus ရမယ်! 🎉`,
      { replyMarkup: mainMenuKeyboard() }
    );
  } catch (error) {
    log.error('Referral link error', {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendMessage(chatId, MSG.error);
  }
}

/**
 * Handle referral_stats callback
 */
export async function handleReferralStats(
  chatId: number,
  telegramId: number,
  firstName: string,
  username?: string
): Promise<void> {
  try {
    await connectDB();
    const user = await findOrCreateTelegramUser(telegramId, firstName, undefined, username);

    const stats = await getReferralStats(user._id);

    // Get referred users details
    const referrals = await Referral.find({ referrer: user._id })
      .populate('referred', 'name telegramUsername createdAt')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    let text =
      `📊 <b>Referral Statistics</b>\n\n` +
      `👥 စုစုပေါင်း Refer: ${stats.totalReferred}\n` +
      `✅ ဝယ်ယူပြီး: ${stats.paidReferrals}\n` +
      `📅 Bonus ရက်: ${user.referralBonusDays || 0}\n\n`;

    if (referrals.length > 0) {
      text += `📋 <b>Referred Users:</b>\n`;
      for (const ref of referrals) {
        const referred = ref.referred as unknown as { name?: string; telegramUsername?: string };
        const name = referred?.telegramUsername
          ? `@${referred.telegramUsername}`
          : referred?.name || 'Unknown';
        const status = ref.isPaid ? '✅' : '⏳';
        text += `${status} ${name}\n`;
      }
    }

    await sendMessage(chatId, text, { replyMarkup: mainMenuKeyboard() });
  } catch (error) {
    log.error('Referral stats error', {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendMessage(chatId, MSG.error);
  }
}

/**
 * Handle claim_free_month callback
 */
export async function handleClaimFreeMonth(
  chatId: number,
  telegramId: number,
  firstName: string,
  username?: string
): Promise<void> {
  try {
    await connectDB();
    const user = await findOrCreateTelegramUser(telegramId, firstName, undefined, username);

    const stats = await getReferralStats(user._id);

    if (stats.paidReferrals < FREE_MONTH_THRESHOLD) {
      await sendMessage(
        chatId,
        `❌ Free Month ရယူရန် အနည်းဆုံး ${FREE_MONTH_THRESHOLD} ယောက်ဝယ်ပေးရပါမည်\n` +
          `လက်ရှိ: ${stats.paidReferrals}/${FREE_MONTH_THRESHOLD}`,
        { replyMarkup: mainMenuKeyboard() }
      );
      return;
    }

    // Get first online server
    const servers = await getOnlineServers();
    if (servers.length === 0) {
      await sendMessage(chatId, '❌ Server များ မရနိုင်ပါ');
      return;
    }

    const server = servers[0];

    // Create free month key (1 device, trojan, 30 days)
    const result = await provisionVpnKey({
      serverId: server.id,
      username: username || firstName,
      userId: user._id.toString(),
      devices: 1,
      expiryDays: 30,
      dataLimitGB: 0,
      protocol: 'trojan',
    });

    if (!result) {
      await sendMessage(chatId, '❌ Key ဖန်တီးရာတွင် အမှားဖြစ်ပါသည်');
      return;
    }

    // Create order record for the free month
    await Order.create({
      user: user._id,
      orderType: 'vpn',
      quantity: 1,
      totalAmount: 0,
      paymentMethod: 'kpay',
      paymentScreenshot: 'referral_reward',
      transactionId: `REF-REWARD-${Date.now()}`,
      status: 'completed',
      vpnPlan: {
        serverId: server.id,
        planId: '1dev_1month',
        devices: 1,
        months: 1,
        protocol: 'trojan',
      },
      vpnKey: {
        clientEmail: result.clientEmail,
        clientUUID: result.clientUUID,
        subId: result.subId,
        subLink: result.subLink,
        configLink: result.configLink,
        protocol: result.protocol,
        expiryTime: result.expiryTime,
        provisionedAt: new Date(),
      },
      vpnProvisionStatus: 'provisioned',
      adminNote: 'Referral reward - Free Month Key',
    });

    const expiryDate = new Date(result.expiryTime).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    await sendMessage(
      chatId,
      `🎉 <b>Free Month Key ရရှိပါပြီ!</b>\n\n` +
        MSG.keyGenerated({
          planName: '1 Device - 1 Month (Referral Reward)',
          serverName: `${server.flag} ${server.name}`,
          protocol: 'trojan',
          expiryDate,
          subLink: result.subLink,
          configLink: result.configLink,
        }),
      { replyMarkup: mainMenuKeyboard() }
    );

    log.info('Referral free month claimed', { telegramId, paidReferrals: stats.paidReferrals });
  } catch (error) {
    log.error('Claim free month error', {
      error: error instanceof Error ? error.message : String(error),
    });
    await sendMessage(chatId, MSG.error);
  }
}

/**
 * Process referral reward when a referred user makes a purchase.
 * Called from payment handler after order completion.
 */
export async function processReferralReward(
  userId: mongoose.Types.ObjectId,
  orderId: mongoose.Types.ObjectId
): Promise<void> {
  try {
    await connectDB();

    // Find referral relationship
    const referral = await getReferrer(userId);
    if (!referral || referral.isPaid) return;

    // Mark referral as paid
    await markReferralPaid(userId, orderId);

    // Add bonus days to referrer
    const referrer = await User.findById(referral.referrer);
    if (!referrer) return;

    referrer.referralBonusDays = (referrer.referralBonusDays || 0) + REFERRAL_BONUS_DAYS;
    await referrer.save();

    // Extend all active keys by bonus days
    const activeOrders = await Order.find({
      user: referrer._id,
      orderType: 'vpn',
      vpnProvisionStatus: 'provisioned',
      'vpnKey.expiryTime': { $gt: Date.now() },
    });

    for (const order of activeOrders) {
      if (order.vpnKey) {
        order.vpnKey.expiryTime += REFERRAL_BONUS_DAYS * 24 * 60 * 60 * 1000;
        await order.save();
      }
    }

    // Notify referrer if they have telegramId
    if (referrer.telegramId) {
      await sendMessage(
        referrer.telegramId,
        MSG.referralRewardEarned(referrer.name, REFERRAL_BONUS_DAYS)
      );
    }

    log.info('Referral reward processed', {
      referrerId: referrer._id,
      referredId: userId,
      bonusDays: REFERRAL_BONUS_DAYS,
    });
  } catch (error) {
    log.error('Process referral reward error', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
