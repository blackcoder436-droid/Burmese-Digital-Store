// ==========================================
// Bot Command Handlers
// /start, /help, /contact, main_menu
// ==========================================

import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { addReferral } from '@/models/Referral';
import { sendMessage } from '../api';
import { MSG } from '../messages';
import { mainMenuKeyboard } from '../keyboards';
import { clearSession } from '../session';
import { createLogger } from '@/lib/logger';
import crypto from 'crypto';

const log = createLogger({ module: 'bot-commands' });

/**
 * Generate a unique referral code for a user
 */
function generateReferralCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Find or create a user document from Telegram user info.
 * Telegram users don't have email/password, so we create a placeholder.
 */
export async function findOrCreateTelegramUser(
  telegramId: number,
  firstName: string,
  lastName?: string,
  username?: string
): Promise<InstanceType<typeof User>> {
  await connectDB();

  // Try to find by telegramId
  let user = await User.findOne({ telegramId });
  if (user) {
    // Update username/name if changed
    const updates: Record<string, unknown> = {};
    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    if (user.telegramUsername !== username) updates.telegramUsername = username || null;
    if (user.name !== fullName && fullName) updates.name = fullName;

    if (Object.keys(updates).length > 0) {
      await User.updateOne({ _id: user._id }, { $set: updates });
    }
    return user;
  }

  // Create new user for Telegram
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || `TG_${telegramId}`;
  const placeholderEmail = `tg_${telegramId}@telegram.bot`;
  const referralCode = generateReferralCode();

  // Use a random password placeholder (they won't login via web with this)
  const placeholderPassword = crypto.randomBytes(32).toString('hex');

  user = await User.create({
    name: fullName,
    email: placeholderEmail,
    password: placeholderPassword,
    telegramId,
    telegramUsername: username || null,
    referralCode,
    emailVerified: false,
  });

  log.info('New Telegram user created', { telegramId, name: fullName });
  return user;
}

/**
 * Handle /start command (with optional referral deep link)
 */
export async function handleStart(
  chatId: number,
  telegramId: number,
  firstName: string,
  lastName?: string,
  username?: string,
  startParam?: string // e.g. "REF_ABCD1234"
): Promise<void> {
  clearSession(telegramId);

  const user = await findOrCreateTelegramUser(telegramId, firstName, lastName, username);

  // Check ban
  if (user.isBanned) {
    const reason = user.banReason || 'No reason provided';
    await sendMessage(chatId, MSG.banned + reason);
    return;
  }

  // Handle referral deep link
  if (startParam?.startsWith('REF_')) {
    const refCode = startParam.substring(4);
    await processReferralLink(user, refCode, telegramId);
  }

  // Ensure user has a referral code
  if (!user.referralCode) {
    user.referralCode = generateReferralCode();
    await user.save();
  }

  await sendMessage(chatId, MSG.welcome(firstName), {
    replyMarkup: mainMenuKeyboard(),
  });
}

/**
 * Process a referral link
 */
async function processReferralLink(
  referredUser: InstanceType<typeof User>,
  referralCode: string,
  referredTelegramId: number
): Promise<void> {
  try {
    await connectDB();
    const referrer = await User.findOne({ referralCode: referralCode });
    if (!referrer) return;

    // Don't self-refer
    if (referrer._id.toString() === referredUser._id.toString()) return;

    await addReferral(
      referrer._id,
      referredUser._id,
      referrer.telegramId,
      referredTelegramId
    );

    log.info('Referral recorded', {
      referrer: referrer.telegramId,
      referred: referredTelegramId,
    });
  } catch (error) {
    log.error('Referral processing error', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle help callback/command
 */
export async function handleHelp(chatId: number): Promise<void> {
  await sendMessage(chatId, MSG.help, {
    replyMarkup: mainMenuKeyboard(),
  });
}

/**
 * Handle contact callback
 */
export async function handleContact(chatId: number): Promise<void> {
  await sendMessage(chatId, MSG.contact, {
    replyMarkup: mainMenuKeyboard(),
  });
}

/**
 * Handle main_menu callback - show the main menu
 */
export async function handleMainMenu(
  chatId: number,
  telegramId: number
): Promise<void> {
  clearSession(telegramId);
  await sendMessage(chatId, `🏠 Main Menu`, {
    replyMarkup: mainMenuKeyboard(),
  });
}
