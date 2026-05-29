import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import logger from '@/lib/logger';
import { sanitizeString } from '@/lib/security';
import {
  callAiApi,
  detectPromptInjection,
  getCustomerSystemPrompt,
  matchFaqReply,
  type AiMessage,
} from '@/lib/ai-chat';
import {
  DEFAULT_FACEBOOK_GRAPH_VERSION,
  getMessengerEventText,
  hasMessengerAttachment,
  sendMessengerSenderAction,
  sendMessengerText,
  splitMessengerText,
  verifyMetaSignature,
  type MessengerMessagingEvent,
  type MessengerWebhookPayload,
} from '@/lib/facebook-messenger';
import AiChatSession from '@/models/AiChatSession';
import {
  forwardExternalAttachmentToTelegram,
  generateCustomerAgentReply,
  getPaymentAttachmentReply,
} from '@/modules/ai-ops/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fbLogger = logger.child({ module: 'facebook-messenger-webhook' });

const AI_FALLBACK_REPLY =
  'ခဏလောက် technical issue ဖြစ်နေပါတယ်။ Telegram Bot @BurmeseDigitalStore_bot ကနေ ဆက်သွယ်ပေးပါ။ Admin က စစ်ပေးပါမယ်။';

function isMessengerEnabled(): boolean {
  return process.env.FACEBOOK_MESSENGER_ENABLED === 'true';
}

function shouldRequireSignature(): boolean {
  if (process.env.FACEBOOK_REQUIRE_SIGNATURE === 'true') return true;
  if (process.env.FACEBOOK_REQUIRE_SIGNATURE === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

function getConfiguredPageId(entryPageId?: string): string {
  return process.env.FACEBOOK_PAGE_ID || entryPageId || '';
}

function buildChannelSystemPrompt(basePrompt: string): string {
  return `${basePrompt}

## Facebook Messenger Channel Rules
- You are replying inside Burmese Digital Store's Facebook Page Messenger inbox.
- Keep replies short enough for Messenger: usually 1-5 short lines.
- Do not approve payments, orders, refunds, or VPN key delivery from chat alone.
- If a customer sends a payment slip, say admin will manually verify it.
- Never ask for passwords, OTP codes, or private payment account logins.
- If the question is unclear, ask one short follow-up question.`;
}

async function getOrCreateFacebookSession(senderId: string, pageId: string) {
  await connectDB();

  const sessionId = `facebook:${pageId}:${senderId}`;
  let session = await AiChatSession.findOne({ sessionId });

  if (!session) {
    session = new AiChatSession({
      sessionId,
      context: 'customer',
      messages: [],
      metadata: {
        userAgent: 'facebook-messenger',
        page: 'facebook-messenger',
        channel: 'facebook',
        externalId: senderId,
        pageId,
      },
    });
  }

  if (session.messages.length >= 96) {
    session.messages = session.messages.slice(-40);
  }

  return session;
}

async function buildAiReply(session: Awaited<ReturnType<typeof getOrCreateFacebookSession>>): Promise<string> {
  const systemPrompt = buildChannelSystemPrompt(await getCustomerSystemPrompt());
  const aiMessages: AiMessage[] = [{ role: 'system', content: systemPrompt }];

  for (const msg of session.messages.slice(-20)) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      aiMessages.push({ role: msg.role, content: msg.content });
    }
  }

  return callAiApi({
    messages: aiMessages,
    temperature: 0.55,
    maxTokens: 700,
  });
}

async function sendReply(pageId: string, senderId: string, text: string): Promise<void> {
  const pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!pageAccessToken) {
    throw new Error('FACEBOOK_PAGE_ACCESS_TOKEN is not configured');
  }

  const graphVersion = process.env.FACEBOOK_GRAPH_API_VERSION || DEFAULT_FACEBOOK_GRAPH_VERSION;
  const parts = splitMessengerText(text);

  for (const part of parts) {
    await sendMessengerText({
      pageId,
      recipientId: senderId,
      pageAccessToken,
      graphVersion,
      text: part,
    });
  }
}

async function handleMessengerEvent(event: MessengerMessagingEvent, entryPageId?: string): Promise<void> {
  const senderId = event.sender?.id;
  const pageId = getConfiguredPageId(entryPageId || event.recipient?.id);

  if (!senderId || !pageId) {
    fbLogger.warn('Skipping Messenger event with missing sender or page id', {
      hasSender: Boolean(senderId),
      hasPageId: Boolean(pageId),
    });
    return;
  }

  if (event.message?.is_echo || event.delivery || event.read || event.reaction) {
    return;
  }

  const configuredPageId = process.env.FACEBOOK_PAGE_ID;
  if (configuredPageId && entryPageId && configuredPageId !== entryPageId) {
    fbLogger.warn('Skipping event for unexpected Facebook Page', { entryPageId });
    return;
  }

  const pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const graphVersion = process.env.FACEBOOK_GRAPH_API_VERSION || DEFAULT_FACEBOOK_GRAPH_VERSION;
  if (pageAccessToken) {
    sendMessengerSenderAction({
      pageId,
      recipientId: senderId,
      pageAccessToken,
      graphVersion,
      action: 'mark_seen',
    }).catch((error) => fbLogger.warn('Unable to mark Messenger message as seen', { error }));

    sendMessengerSenderAction({
      pageId,
      recipientId: senderId,
      pageAccessToken,
      graphVersion,
      action: 'typing_on',
    }).catch((error) => fbLogger.warn('Unable to send Messenger typing action', { error }));
  }

  const rawText = getMessengerEventText(event);
  if (!rawText && hasMessengerAttachment(event)) {
    const reply = await getPaymentAttachmentReply();
    const attachmentUrl = event.message?.attachments?.[0]?.payload?.url;
    forwardExternalAttachmentToTelegram({
      channel: 'facebook',
      attachmentUrl,
      sessionId: `facebook:${pageId}:${senderId}`,
      externalUserId: senderId,
      caption: [
        'Facebook Messenger attachment received',
        `Page: ${pageId}`,
        `Sender: ${senderId}`,
        attachmentUrl ? 'Attachment URL included' : 'No attachment URL',
      ].join('\n'),
      metadata: {
        pageId,
        attachmentType: event.message?.attachments?.[0]?.type,
        messageId: event.message?.mid,
      },
    }).catch((error) => fbLogger.warn('Unable to forward Messenger attachment', { error }));
    await sendReply(pageId, senderId, reply);
    return;
  }

  const message = sanitizeString(rawText || '').slice(0, 2000);
  if (!message) return;

  const result = await generateCustomerAgentReply({
    channel: 'facebook',
    sessionId: `facebook:${pageId}:${senderId}`,
    message,
    externalUserId: senderId,
    page: 'facebook-messenger',
    metadata: {
      pageId,
      messageId: event.message?.mid || event.postback?.mid,
    },
  });

  await sendReply(pageId, senderId, result.reply || AI_FALLBACK_REPLY);
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode');
  const token = request.nextUrl.searchParams.get('hub.verify_token');
  const challenge = request.nextUrl.searchParams.get('hub.challenge');
  const verifyToken = process.env.FACEBOOK_VERIFY_TOKEN;

  if (!isMessengerEnabled()) {
    return NextResponse.json(
      { success: false, error: 'Facebook Messenger bot is not enabled' },
      { status: 503 }
    );
  }

  if (!verifyToken) {
    fbLogger.error('FACEBOOK_VERIFY_TOKEN is not configured');
    return NextResponse.json(
      { success: false, error: 'Facebook webhook verify token is not configured' },
      { status: 503 }
    );
  }

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  fbLogger.warn('Facebook webhook verification failed', { mode });
  return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 403 });
}

export async function POST(request: NextRequest) {
  if (!isMessengerEnabled()) {
    return NextResponse.json(
      { success: false, error: 'Facebook Messenger bot is not enabled' },
      { status: 503 }
    );
  }

  const rawBody = await request.text();

  if (shouldRequireSignature()) {
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appSecret) {
      fbLogger.error('FACEBOOK_APP_SECRET is required for Messenger signature validation');
      return NextResponse.json(
        { success: false, error: 'Facebook app secret is not configured' },
        { status: 503 }
      );
    }

    const isValid = verifyMetaSignature(
      rawBody,
      request.headers.get('x-hub-signature-256'),
      appSecret
    );

    if (!isValid) {
      fbLogger.warn('Rejected Facebook webhook with invalid signature');
      return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 401 });
    }
  }

  let payload: MessengerWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MessengerWebhookPayload;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (payload.object !== 'page') {
    return NextResponse.json({ success: false, error: 'Unsupported webhook object' }, { status: 404 });
  }

  try {
    const tasks: Promise<void>[] = [];

    for (const entry of payload.entry || []) {
      for (const event of entry.messaging || []) {
        tasks.push(handleMessengerEvent(event, entry.id));
      }
    }

    await Promise.all(tasks);
  } catch (error) {
    fbLogger.error('Facebook webhook processing failed', { error });
  }

  return NextResponse.json({ success: true });
}
