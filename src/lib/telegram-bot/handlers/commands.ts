// ==========================================
// Bot Command Handlers
// /start, /help, /contact, main_menu
// ==========================================

import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { addReferral } from '@/models/Referral';
import { sendMessage, editMessageText, deleteMessage } from '../api';
import { MSG } from '../messages';
import { mainMenuKeyboard } from '../keyboards';
import { clearSession } from '../session';
import { createLogger } from '@/lib/logger';
import crypto from 'crypto';

const log = createLogger({ module: 'bot-commands' });

export async function handleSettingsLanguage(chatId: number, telegramId: number, messageId?: number): Promise<void> {
  const user = await User.findOne({ telegramId });
  const keyboard = {
    inline_keyboard: [
      [
        { text: (user?.language === 'my' ? '✅ ' : '') + 'မြန်မာ', callback_data: 'setlang_my' },
        { text: (user?.language === 'en' ? '✅ ' : '') + 'English', callback_data: 'setlang_en' }
      ]
    ]
  };

  const text = '🌐 Choose your preferred language / မိမိအသုံးပြုလိုသော ဘာသာစကားကို ရွေးချယ်ပါ';

  if (messageId) {
    const edited = await editMessageText(chatId, messageId, text, { replyMarkup: keyboard });
    if (edited) return;
  }

  await sendMessage(chatId, text, { replyMarkup: keyboard });
}

export async function handleChangeLanguage(chatId: number, telegramId: number, lang: string, messageId?: number): Promise<void> {
  await connectDB();
  const normalizedLang = lang === 'en' ? 'en' : 'my';

  const user = await User.findOne({ telegramId });
  if (user) {
    user.language = normalizedLang;
    await user.save();
  }

  const text = normalizedLang === 'en'
    ? '🏠 <b>Main Menu</b>\n\nPlease choose an option from the menu below 👇'
    : '🏠 <b>Main Menu</b>\n\nအောက်ပါ menu မှ ရွေးချယ်ပါ 👇';

  if (messageId) {
    const updated = await editMessageText(chatId, messageId, text, { replyMarkup: mainMenuKeyboard(normalizedLang) });
    if (updated) return;
  }

  await handleMainMenu(chatId, telegramId);
}

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
  
  // Format the name to pass the 'minlength: 2' mongoose validation
  let validName = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (validName.length === 1) validName += '.';
  const fullName = validName || `TG_${telegramId}`;

  if (user) {
    // Update username/name if changed
    const updates: Record<string, unknown> = {};
    if (user.telegramUsername !== username) updates.telegramUsername = username || null;
    if (user.name !== fullName) updates.name = fullName;

    if (Object.keys(updates).length > 0) {
      await User.updateOne({ _id: user._id }, { $set: updates }, { runValidators: true }).catch(err => log.warn('Failed to update TG user info', { err }));
    }
    return user;
  }

  // Create new user for Telegram
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
    await sendMessage(chatId, "Banned: " + reason);
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

  const lang = (user?.language as 'en' | 'my') || 'my';
  const welcomeText = lang === 'en'
    ? `🌟 <b>Burmese Digital Store</b> Welcome!\n\nHello ${firstName}! 👋\n\n🔐 Premium VPN Service\n⚡ Fast Servers\n🛡️ Full Security\n💰 Cheap Prices\n\nPlease choose an option from the menu below 👇`
    : `🌟 <b>Burmese Digital Store</b> မှ ကြိုဆိုပါတယ်!\n\nမင်္ဂလာပါ ${firstName}! 👋\n\n🔐 Premium VPN Service\n⚡ မြန်ဆန်သော Server များ\n🛡️ လုံခြုံမှုအပြည့်\n💰 စျေးနှုန်းသက်သာ\n\nအောက်ပါ menu မှ ရွေးချယ်ပါ 👇`;

  await sendMessage(chatId, welcomeText, {
    replyMarkup: mainMenuKeyboard(lang),
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
export async function handleHelp(chatId: number, telegramId: number, messageId?: number): Promise<void> {
  const user = await User.findOne({ telegramId });
  const lang = (user?.language as 'en' | 'my') || 'my';

  const text = lang === 'en'
    ? `📖 <b>How to use</b>\n\n🔑 <b>Buy VPN Key:</b>\n1️⃣ Click "🛒 Buy VPN"\n2️⃣ Select Server\n3️⃣ Select Protocol\n4️⃣ Select Devices\n5️⃣ Select Plan\n6️⃣ Transfer money & Send Screenshot\n7️⃣ Get your Key\n\n🎁 <b>Free Test Key:</b>\n• Join our channel to get 3GB / 72 hours free test\n\n🔄 <b>Exchange Protocol:</b>\n• Change current key to another protocol\n\n📞 <b>Help:</b>\n• Contact @BurmeseDigitalStore`
    : `📖 <b>အသုံးပြုနည်း</b>\n\n🔑 <b>VPN Key ဝယ်နည်း:</b>\n1️⃣ "🛒 VPN ဝယ်မည်" ကိုနှိပ်ပါ\n2️⃣ Server ရွေးပါ\n3️⃣ Protocol ရွေးပါ\n4️⃣ Device အရေအတွက် ရွေးပါ\n5️⃣ Plan ရွေးပါ\n6️⃣ ငွေလွှဲပြီး Screenshot ပို့ပါ\n7️⃣ Key ရရှိပါမည်\n\n🎁 <b>Free Test Key:</b>\n• Channel join ပြီးရင် 3GB / 72 နာရီ free test ရနိုင်ပါတယ်\n\n🔄 <b>Protocol ပြောင်းခြင်း:</b>\n• လက်ရှိ key ကို တခြား protocol ပြောင်းနိုင်ပါတယ်\n\n📞 <b>အကူအညီ:</b>\n• @BurmeseDigitalStore ကို ဆက်သွယ်ပါ`;

  if (messageId) {
    await editMessageText(chatId, messageId, text, { replyMarkup: mainMenuKeyboard(lang) });
  } else {
    await sendMessage(chatId, text, { replyMarkup: mainMenuKeyboard(lang) });
  }
}

/**
 * Handle contact callback
 */
export async function handleContact(chatId: number, telegramId: number, messageId?: number): Promise<void> {
  const user = await User.findOne({ telegramId });
  const lang = (user?.language as 'en' | 'my') || 'my';

  const text = lang === 'en'
    ? `📞 <b>Contact Support</b>\n\n📱 Telegram: @BurmeseDigitalStore\n🌐 Website: https://burmesedigital.store\n📧 Email: support@burmesedigital.store\n\n⏰ Response Time: 1-12 hours`
    : `📞 <b>ဆက်သွယ်ရန်</b>\n\n📱 Telegram: @BurmeseDigitalStore\n🌐 Website: https://burmesedigital.store\n📧 Email: support@burmesedigital.store\n\n⏰ တုံ့ပြန်ချိန်: 1-12 နာရီအတွင်း`;

  if (messageId) {
    await editMessageText(chatId, messageId, text, { replyMarkup: mainMenuKeyboard(lang) });
  } else {
    await sendMessage(chatId, text, { replyMarkup: mainMenuKeyboard(lang) });
  }
}

/**
 * Handle main_menu callback - show the main menu
 */
export async function handleMainMenu(
  chatId: number,
  telegramId: number,
  messageId?: number
): Promise<void> {
  clearSession(telegramId);
  const user = await User.findOne({ telegramId });
  const lang = (user?.language as 'en' | 'my') || 'my';

  const text = lang === 'en'
    ? `🏠 <b>Main Menu</b>\n\nPlease choose an option from the menu below 👇`
    : `🏠 <b>Main Menu</b>\n\nအောက်ပါ menu မှ ရွေးချယ်ပါ 👇`;

  if (messageId) {
    await editMessageText(chatId, messageId, text, { replyMarkup: mainMenuKeyboard(lang) });
  } else {
    await sendMessage(chatId, text, { replyMarkup: mainMenuKeyboard(lang) });
  }
}
