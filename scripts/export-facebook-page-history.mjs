#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const GRAPH_VERSION = process.env.FACEBOOK_GRAPH_API_VERSION || 'v25.0';
const PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const OUT_DIR = process.env.FACEBOOK_HISTORY_OUT_DIR || 'exports/facebook-page-history';
const LIMIT = Number(process.env.FACEBOOK_HISTORY_LIMIT || 100);

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?:\+?95|\+?1)?[\s.-]?(?:\d[\s.-]?){7,14}\d/g;
const TX_RE = /\b(?:txid|transaction|trx|ref|reference|order)\s*[:#-]?\s*[a-z0-9_-]{5,}\b/gi;

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`${name} is required`);
  }
}

function redact(value = '') {
  return String(value)
    .replace(EMAIL_RE, '[email]')
    .replace(PHONE_RE, '[phone]')
    .replace(TX_RE, '[reference]');
}

function graphUrl(edge, params = {}) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${edge}`);
  url.searchParams.set('access_token', PAGE_ACCESS_TOKEN);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function fetchJson(url) {
  const response = await fetch(url);
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Graph API returned non-JSON (${response.status}): ${text.slice(0, 200)}`);
  }

  if (!response.ok || data.error) {
    const message = data.error?.message || text;
    throw new Error(`Graph API error (${response.status}): ${message}`);
  }

  return data;
}

async function* paginate(firstUrl) {
  let url = firstUrl;
  while (url) {
    const data = await fetchJson(url);
    for (const item of data.data || []) {
      yield item;
    }
    url = data.paging?.next || '';
  }
}

function normalizeMessage(conversation, message) {
  const fromId = message.from?.id || '';
  const speaker = fromId === PAGE_ID ? 'page' : 'customer';

  return {
    conversationId: conversation.id,
    conversationUpdatedTime: conversation.updated_time,
    messageId: message.id,
    createdTime: message.created_time,
    speaker,
    fromName: speaker === 'page' ? 'Page' : '[customer]',
    text: redact(message.message || ''),
    hasAttachments: Boolean(message.attachments?.data?.length),
    attachmentTypes: (message.attachments?.data || [])
      .map((attachment) => attachment.mime_type || attachment.type)
      .filter(Boolean),
  };
}

async function main() {
  requireEnv('FACEBOOK_PAGE_ID', PAGE_ID);
  requireEnv('FACEBOOK_PAGE_ACCESS_TOKEN', PAGE_ACCESS_TOKEN);

  const startedAt = new Date();
  await fs.mkdir(OUT_DIR, { recursive: true });

  const stamp = startedAt.toISOString().replace(/[:.]/g, '-');
  const messagesPath = path.join(OUT_DIR, `messages-${stamp}.jsonl`);
  const conversationsPath = path.join(OUT_DIR, `conversations-${stamp}.jsonl`);
  const qaPath = path.join(OUT_DIR, `qa-candidates-${stamp}.jsonl`);

  const messagesHandle = await fs.open(messagesPath, 'w');
  const conversationsHandle = await fs.open(conversationsPath, 'w');
  const qaHandle = await fs.open(qaPath, 'w');

  let conversationCount = 0;
  let messageCount = 0;
  let qaCount = 0;

  try {
    const conversationsUrl = graphUrl(`${PAGE_ID}/conversations`, {
      platform: 'messenger',
      fields: 'id,updated_time,snippet,message_count,participants',
      limit: LIMIT,
    });

    for await (const conversation of paginate(conversationsUrl)) {
      conversationCount += 1;
      await conversationsHandle.write(`${JSON.stringify(conversation)}\n`);

      const messagesUrl = graphUrl(`${conversation.id}/messages`, {
        fields: 'id,created_time,from,to,message,attachments',
        limit: LIMIT,
      });

      const normalizedMessages = [];
      for await (const message of paginate(messagesUrl)) {
        const normalized = normalizeMessage(conversation, message);
        normalizedMessages.push(normalized);
        messageCount += 1;
        await messagesHandle.write(`${JSON.stringify(normalized)}\n`);
      }

      normalizedMessages.sort((a, b) => new Date(a.createdTime) - new Date(b.createdTime));
      for (let i = 0; i < normalizedMessages.length - 1; i += 1) {
        const current = normalizedMessages[i];
        const next = normalizedMessages[i + 1];
        if (current.speaker === 'customer' && next.speaker === 'page' && current.text && next.text) {
          qaCount += 1;
          await qaHandle.write(`${JSON.stringify({
            conversationId: conversation.id,
            customer: current.text,
            pageReply: next.text,
            createdTime: current.createdTime,
          })}\n`);
        }
      }

      if (conversationCount % 25 === 0) {
        console.log(`Exported ${conversationCount} conversations, ${messageCount} messages...`);
      }
    }
  } finally {
    await messagesHandle.close();
    await conversationsHandle.close();
    await qaHandle.close();
  }

  console.log(JSON.stringify({
    ok: true,
    conversationCount,
    messageCount,
    qaCount,
    files: {
      conversationsPath,
      messagesPath,
      qaPath,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
