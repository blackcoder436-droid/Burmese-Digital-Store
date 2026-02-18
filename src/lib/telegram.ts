import { createLogger } from '@/lib/logger';

// ==========================================
// Telegram Bot Integration
// Burmese Digital Store
//
// Payment screenshots → Telegram channel
// Order notifications → Telegram channel
// No local file storage needed for screenshots
// ==========================================

const log = createLogger({ module: 'telegram' });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID; // e.g. -1001234567890

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

interface TelegramPhotoResult {
  ok: boolean;
  fileId: string;
  fileUniqueId: string;
  messageId: number;
}

/**
 * Send a payment screenshot to Telegram channel and get file reference
 */
export async function sendPaymentScreenshot(
  buffer: Buffer,
  filename: string,
  caption: string
): Promise<TelegramPhotoResult | null> {
  if (!BOT_TOKEN || !CHANNEL_ID) {
    log.warn('Telegram not configured — BOT_TOKEN or CHANNEL_ID missing');
    return null;
  }

  try {
    const formData = new FormData();
    formData.append('chat_id', CHANNEL_ID);
    formData.append('photo', new Blob([new Uint8Array(buffer)]), filename);
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');

    const res = await fetch(`${TELEGRAM_API}/sendPhoto`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();

    if (!data.ok) {
      log.error('Telegram sendPhoto failed', { error: data.description });
      return null;
    }

    // Get the largest photo size (last in array)
    const photos = data.result.photo;
    const largest = photos[photos.length - 1];

    log.info('Screenshot sent to Telegram', {
      messageId: data.result.message_id,
      fileId: largest.file_id,
    });

    return {
      ok: true,
      fileId: largest.file_id,
      fileUniqueId: largest.file_unique_id,
      messageId: data.result.message_id,
    };
  } catch (error) {
    log.error('Telegram sendPhoto error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Send order notification to Telegram channel
 */
export async function sendOrderNotification(message: string): Promise<boolean> {
  if (!BOT_TOKEN || !CHANNEL_ID) {
    return false;
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHANNEL_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      log.error('Telegram sendMessage failed', { error: data.description });
      return false;
    }
    return true;
  } catch (error) {
    log.error('Telegram sendMessage error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Get file download URL from Telegram (for admin viewing)
 */
export async function getTelegramFileUrl(fileId: string): Promise<string | null> {
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
 * Build order notification caption for screenshot
 */
export function buildScreenshotCaption(params: {
  orderNumber: string;
  userName: string;
  productName: string;
  amount: number;
  paymentMethod: string;
  transactionId?: string;
}): string {
  const lines = [
    `📦 <b>New Order: ${params.orderNumber}</b>`,
    `👤 ${params.userName}`,
    `🛒 ${params.productName}`,
    `💰 ${params.amount.toLocaleString()} Ks`,
    `💳 ${params.paymentMethod.toUpperCase()}`,
  ];
  if (params.transactionId) {
    lines.push(`🔖 TxID: <code>${params.transactionId}</code>`);
  }
  return lines.join('\n');
}
