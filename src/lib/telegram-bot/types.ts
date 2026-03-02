// ==========================================
// Telegram Bot Types
// Burmese Digital Store - Integrated Bot
// ==========================================

// --- Telegram API Types ---

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  photo?: TelegramPhotoSize[];
  caption?: string;
  reply_to_message?: TelegramMessage;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramChatMember {
  status: 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked';
  user: TelegramUser;
}

// --- Inline Keyboard Types ---

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export type InlineKeyboard = InlineKeyboardButton[][];

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboard;
}

// --- Bot Session Types ---

export interface BotSession {
  telegramId: number;
  serverId?: string;
  planId?: string;
  amount?: number;
  orderId?: string;
  protocol?: string;
  waitingScreenshot?: boolean;
  isFree?: boolean;
  deviceCount?: number;
  action?: string; // admin actions
  exchangeKeyId?: string;
  exchangeServerId?: string;
  createdAt: number;
}

// --- Handler Context ---

export interface BotContext {
  chatId: number;
  userId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  messageId?: number;
  text?: string;
  photo?: TelegramPhotoSize[];
  callbackQueryId?: string;
  callbackData?: string;
  isAdmin: boolean;
}
