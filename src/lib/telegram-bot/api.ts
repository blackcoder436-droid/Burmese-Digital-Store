// ==========================================
// Telegram Bot API Wrapper
// Burmese Digital Store - Integrated Bot
// ==========================================

import { createLogger } from '@/lib/logger';
import type { InlineKeyboardMarkup, TelegramChatMember } from './types';

const log = createLogger({ module: 'telegram-bot-api' });

// VPN bot uses its own token, separate from the notification bot
const BOT_TOKEN = process.env.TELEGRAM_VPN_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ---- Core API Methods ----

/**
 * Send a text message to a specific chat
 */
export async function sendMessage(
  chatId: number | string,
  text: string,
  options?: {
    parseMode?: 'HTML' | 'Markdown';
    replyMarkup?: InlineKeyboardMarkup;
    disableWebPagePreview?: boolean;
  }
): Promise<{ ok: boolean; messageId?: number }> {
  if (!BOT_TOKEN) {
    log.warn('BOT_TOKEN not configured');
    return { ok: false };
  }

  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: options?.parseMode || 'HTML',
    };

    if (options?.replyMarkup) {
      body.reply_markup = options.replyMarkup;
    }

    if (options?.disableWebPagePreview) {
      body.disable_web_page_preview = true;
    }

    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!data.ok) {
      log.error('sendMessage failed', { chatId, error: data.description });
      return { ok: false };
    }

    return { ok: true, messageId: data.result.message_id };
  } catch (error) {
    log.error('sendMessage error', {
      chatId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false };
  }
}

/**
 * Edit an existing message
 */
export async function editMessageText(
  chatId: number | string,
  messageId: number,
  text: string,
  options?: {
    parseMode?: 'HTML' | 'Markdown';
    replyMarkup?: InlineKeyboardMarkup;
  }
): Promise<boolean> {
  if (!BOT_TOKEN) return false;

  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: options?.parseMode || 'HTML',
    };

    if (options?.replyMarkup) {
      body.reply_markup = options.replyMarkup;
    } else {
      // Remove inline keyboard
      body.reply_markup = JSON.stringify({ inline_keyboard: [] });
    }

    const res = await fetch(`${TELEGRAM_API}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

/**
 * Answer a callback query (dismiss loading spinner)
 */
export async function answerCallback(
  callbackQueryId: string,
  text: string,
  showAlert = true
): Promise<boolean> {
  if (!BOT_TOKEN) return false;

  try {
    const res = await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: showAlert,
      }),
    });
    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

/**
 * Send a photo to a chat
 */
export async function sendPhoto(
  chatId: number | string,
  photo: string | Buffer,
  options?: {
    caption?: string;
    parseMode?: 'HTML' | 'Markdown';
    replyMarkup?: InlineKeyboardMarkup;
    filename?: string;
  }
): Promise<{ ok: boolean; messageId?: number }> {
  if (!BOT_TOKEN) return { ok: false };

  try {
    const formData = new FormData();
    formData.append('chat_id', String(chatId));

    if (typeof photo === 'string') {
      // file_id or URL
      formData.append('photo', photo);
    } else {
      formData.append(
        'photo',
        new Blob([new Uint8Array(photo)]),
        options?.filename || 'photo.jpg'
      );
    }

    if (options?.caption) {
      formData.append('caption', options.caption);
    }
    formData.append('parse_mode', options?.parseMode || 'HTML');

    if (options?.replyMarkup) {
      formData.append('reply_markup', JSON.stringify(options.replyMarkup));
    }

    const res = await fetch(`${TELEGRAM_API}/sendPhoto`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    if (!data.ok) {
      log.error('sendPhoto failed', { chatId, error: data.description });
      return { ok: false };
    }

    return { ok: true, messageId: data.result.message_id };
  } catch (error) {
    log.error('sendPhoto error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false };
  }
}

/**
 * Send a document to a chat
 */
export async function sendDocument(
  chatId: number | string,
  document: Buffer,
  filename: string,
  caption?: string
): Promise<boolean> {
  if (!BOT_TOKEN) return false;

  try {
    const formData = new FormData();
    formData.append('chat_id', String(chatId));
    formData.append(
      'document',
      new Blob([new Uint8Array(document)]),
      filename
    );
    if (caption) {
      formData.append('caption', caption);
      formData.append('parse_mode', 'HTML');
    }

    const res = await fetch(`${TELEGRAM_API}/sendDocument`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

/**
 * Get file download URL from Telegram
 */
export async function getFileUrl(fileId: string): Promise<string | null> {
  if (!BOT_TOKEN) return null;

  try {
    const res = await fetch(`${TELEGRAM_API}/getFile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId }),
    });

    const data = await res.json();
    if (!data.ok) return null;

    return `https://api.telegram.org/file/bot${BOT_TOKEN}/${data.result.file_path}`;
  } catch {
    return null;
  }
}

/**
 * Download a file from Telegram as Buffer
 */
export async function downloadFile(fileId: string): Promise<Buffer | null> {
  const url = await getFileUrl(fileId);
  if (!url) return null;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

/**
 * Check if user is a member of a channel
 */
export async function getChatMember(
  chatId: number | string,
  userId: number
): Promise<TelegramChatMember | null> {
  if (!BOT_TOKEN) return null;

  try {
    const res = await fetch(`${TELEGRAM_API}/getChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, user_id: userId }),
    });

    const data = await res.json();
    if (!data.ok) return null;

    return data.result as TelegramChatMember;
  } catch {
    return null;
  }
}

/**
 * Set webhook URL for the bot
 */
export async function setWebhook(
  url: string,
  secretToken?: string
): Promise<boolean> {
  if (!BOT_TOKEN) return false;

  try {
    const body: Record<string, unknown> = {
      url,
      allowed_updates: ['message', 'callback_query'],
      max_connections: 40,
    };

    if (secretToken) {
      body.secret_token = secretToken;
    }

    const res = await fetch(`${TELEGRAM_API}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!data.ok) {
      log.error('setWebhook failed', { error: data.description });
      return false;
    }

    log.info('Webhook set successfully', { url });
    return true;
  } catch (error) {
    log.error('setWebhook error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Delete webhook (switch back to polling)
 */
export async function deleteWebhook(): Promise<boolean> {
  if (!BOT_TOKEN) return false;

  try {
    const res = await fetch(`${TELEGRAM_API}/deleteWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop_pending_updates: false }),
    });
    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

/**
 * Get current webhook info
 */
export async function getWebhookInfo(): Promise<Record<string, unknown> | null> {
  if (!BOT_TOKEN) return null;

  try {
    const res = await fetch(`${TELEGRAM_API}/getWebhookInfo`);
    const data = await res.json();
    return data.ok ? data.result : null;
  } catch {
    return null;
  }
}
