import { createHmac, timingSafeEqual } from 'crypto';

export const DEFAULT_FACEBOOK_GRAPH_VERSION = 'v25.0';
export const MESSENGER_TEXT_LIMIT = 1800;

export interface MessengerAttachment {
  type?: string;
  payload?: {
    url?: string;
    sticker_id?: number;
  };
}

export interface MessengerMessage {
  mid?: string;
  text?: string;
  is_echo?: boolean;
  quick_reply?: {
    payload?: string;
  };
  attachments?: MessengerAttachment[];
}

export interface MessengerPostback {
  mid?: string;
  title?: string;
  payload?: string;
}

export interface MessengerMessagingEvent {
  sender?: {
    id?: string;
  };
  recipient?: {
    id?: string;
  };
  timestamp?: number;
  message?: MessengerMessage;
  postback?: MessengerPostback;
  read?: unknown;
  delivery?: unknown;
  reaction?: unknown;
}

export interface MessengerWebhookEntry {
  id?: string;
  time?: number;
  messaging?: MessengerMessagingEvent[];
}

export interface MessengerWebhookPayload {
  object?: string;
  entry?: MessengerWebhookEntry[];
}

export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;

  const suppliedHex = signatureHeader.slice('sha256='.length);
  if (!/^[a-f0-9]+$/i.test(suppliedHex)) return false;

  const expectedHex = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  const supplied = Buffer.from(suppliedHex, 'hex');
  const expected = Buffer.from(expectedHex, 'hex');

  if (supplied.length !== expected.length) return false;
  return timingSafeEqual(supplied, expected);
}

export function getMessengerEventText(event: MessengerMessagingEvent): string | null {
  const messageText = event.message?.text?.trim();
  if (messageText) return messageText;

  const postbackTitle = event.postback?.title?.trim();
  if (postbackTitle) return postbackTitle;

  const postbackPayload = event.postback?.payload?.trim();
  if (postbackPayload) return postbackPayload;

  return null;
}

export function hasMessengerAttachment(event: MessengerMessagingEvent): boolean {
  return Array.isArray(event.message?.attachments) && event.message.attachments.length > 0;
}

export function toMessengerPlainText(markdown: string): string {
  return markdown
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1: $2')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function splitMessengerText(
  text: string,
  limit = MESSENGER_TEXT_LIMIT,
  maxParts = 3
): string[] {
  const normalized = toMessengerPlainText(text);
  if (!normalized) return [];
  if (normalized.length <= limit) return [normalized];

  const parts: string[] = [];
  let remaining = normalized;

  while (remaining.length > 0 && parts.length < maxParts) {
    if (remaining.length <= limit) {
      parts.push(remaining.trim());
      break;
    }

    const candidate = remaining.slice(0, limit);
    const breakAt = Math.max(
      candidate.lastIndexOf('\n\n'),
      candidate.lastIndexOf('\n'),
      candidate.lastIndexOf(' ')
    );
    const cut = breakAt > Math.floor(limit * 0.6) ? breakAt : limit;
    parts.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }

  if (remaining.length > 0 && parts.length > 0) {
    const lastIndex = parts.length - 1;
    const suffix = '\n\n...';
    parts[lastIndex] = `${parts[lastIndex].slice(0, limit - suffix.length).trim()}${suffix}`;
  }

  return parts.filter(Boolean);
}

interface SendMessengerMessageOptions {
  pageId: string;
  recipientId: string;
  pageAccessToken: string;
  text: string;
  graphVersion?: string;
}

export async function sendMessengerText({
  pageId,
  recipientId,
  pageAccessToken,
  text,
  graphVersion = DEFAULT_FACEBOOK_GRAPH_VERSION,
}: SendMessengerMessageOptions): Promise<void> {
  const endpoint = `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(pageId)}/messages`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pageAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      messaging_type: 'RESPONSE',
      message: { text },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Messenger Send API error (${response.status}): ${body}`);
  }
}

interface SendMessengerActionOptions {
  pageId: string;
  recipientId: string;
  pageAccessToken: string;
  action: 'typing_on' | 'typing_off' | 'mark_seen';
  graphVersion?: string;
}

export async function sendMessengerSenderAction({
  pageId,
  recipientId,
  pageAccessToken,
  action,
  graphVersion = DEFAULT_FACEBOOK_GRAPH_VERSION,
}: SendMessengerActionOptions): Promise<void> {
  const endpoint = `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(pageId)}/messages`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pageAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      sender_action: action,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Messenger Sender Action error (${response.status}): ${body}`);
  }
}
