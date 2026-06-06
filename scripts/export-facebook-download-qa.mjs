#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const PAGE_NAME = 'Burmese Digital Store';
const DEFAULT_OUT_DIR = 'exports/facebook-page-history';
const EXPORT_DIR_PREFIX = 'facebook-BurmeseDigitalStore';

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?:\+?95|\+?1)?[\s.-]?(?:\d[\s.-]?){7,14}\d/g;
const TX_RE = /\b(?:txid|transaction|trx|ref|reference|order)\s*[:#-]?\s*[a-z0-9_-]{5,}\b/gi;
const VPN_URI_RE = /\b(?:ss|ssr|vmess|vless|trojan|hysteria2?|tuic):\/\/[^\s"'<>]+/gi;
const VPN_SUB_URL_RE = /https?:\/\/(?:www\.)?burmesedigital\.store\/api\/vpn\/sub\/[^\s"'<>]+/gi;
const SECRET_URL_PARAM_RE = /([?&](?:access_token|token|key|secret)=)[^&\s"'<>]+/gi;
const LONG_TOKEN_RE = /\b(?:[a-f0-9]{24,}|[a-z0-9_-]{32,})\b/gi;
const LONG_NUMBER_RE = /\b\d{8,}\b/g;

const TAG_RULES = [
  {
    tag: 'vpn',
    patterns: [/vpn|v2ray|vless|vmess|trojan|hiddify|happ|v2box|outline|shadowrocket|key|server/i],
    words: ['\u1000\u102e\u1038', '\u1017\u102e\u1015\u102e\u1021\u1014\u103a', '\u1006\u102c\u1017\u102c'],
  },
  {
    tag: 'payment',
    patterns: [/payment|pay|paid|kpay|wave|aya|uab|slip|screenshot|ss/i],
    words: ['\u1004\u103d\u1031\u1001\u103b\u1031', '\u101c\u103d\u103e\u1032'],
  },
  {
    tag: 'setup',
    patterns: [/setup|install|app|copy|link|qr|scan|hiddify|happ|v2box|outline/i],
    words: ['\u1011\u100a\u1037\u103a', '\u101e\u102f\u1036\u1038\u1014\u100a\u103a\u1038'],
  },
  {
    tag: 'troubleshooting',
    patterns: [/error|problem|timeout|time out|connecting|failed|fail|ping|ms|slow/i],
    words: ['\u1019\u101b', '\u1001\u103b\u102d\u1010\u103a', '\u101c\u102d\u102f\u1004\u103a\u1038', '\u1014\u103e\u1031\u1038'],
  },
  {
    tag: 'price',
    patterns: [/price|pricing|plan|mmk|ks|kyat/i],
    words: ['\u1008\u1031\u1038', '\u1005\u103b\u1031\u1038', '\u1018\u101a\u103a\u101c\u1031\u102c\u1000\u103a'],
  },
  {
    tag: 'renewal',
    patterns: [/renew|expire|expired|expiry|extension/i],
    words: ['\u101e\u1000\u103a\u1010\u1019\u103a\u1038', '\u1011\u1015\u103a\u1010\u102d\u102f\u1038'],
  },
  {
    tag: 'device',
    patterns: [/device|phone|android|ios|iphone|windows|laptop|pc|share/i],
    words: ['\u1016\u102f\u1014\u103a\u1038', '\u101c\u102f\u1036\u1038'],
  },
  {
    tag: 'free-test',
    patterns: [/free|trial|test/i],
    words: ['\u1005\u1019\u103a\u1038'],
  },
];

function argValue(name) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : '';
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function decodeFacebookText(value) {
  if (typeof value !== 'string' || value.length === 0) return '';
  if (/[\u1000-\u109f]/.test(value)) return value;

  const decoded = Buffer.from(value, 'latin1').toString('utf8');
  return /[\u1000-\u109f]/.test(decoded) ? decoded : value;
}

function redact(value = '') {
  return String(value)
    .replace(VPN_URI_RE, '[vpn-config-uri]')
    .replace(VPN_SUB_URL_RE, '[vpn-subscription-link]')
    .replace(SECRET_URL_PARAM_RE, '$1[redacted]')
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[link]')
    .replace(EMAIL_RE, '[email]')
    .replace(PHONE_RE, '[phone]')
    .replace(TX_RE, '[reference]')
    .replace(LONG_TOKEN_RE, '[token]')
    .replace(LONG_NUMBER_RE, '[number]')
    .replace(/\s+/g, ' ')
    .trim();
}

function attachmentLabels(message) {
  const labels = [];
  if (message.photos?.length) labels.push('[photos]');
  if (message.videos?.length) labels.push('[videos]');
  if (message.audio_files?.length) labels.push('[audio]');
  if (message.gifs?.length) labels.push('[gifs]');
  if (message.files?.length) labels.push('[files]');
  if (message.sticker) labels.push('[sticker]');
  if (message.share?.link) labels.push('[share-link]');
  return labels;
}

function messageText(message) {
  const text = decodeFacebookText(message.content || '').trim();
  const labels = attachmentLabels(message);
  return [text, ...labels].filter(Boolean).join(' ').trim();
}

function speakerFor(message) {
  const sender = decodeFacebookText(message.sender_name || '');
  return sender === PAGE_NAME ? 'page' : 'customer';
}

function classify(customer, pageReply) {
  const text = `${customer} ${pageReply}`.toLowerCase();
  const tags = new Set(['facebook-download', 'facebook-history', 'customer-qa']);

  for (const rule of TAG_RULES) {
    if (
      rule.patterns.some((pattern) => pattern.test(text)) ||
      rule.words.some((word) => text.includes(word))
    ) {
      tags.add(rule.tag);
    }
  }

  return Array.from(tags).slice(0, 12);
}

function categoryFromTags(tags) {
  if (tags.includes('price')) return 'pricing';
  if (tags.includes('payment')) return 'payment';
  if (tags.includes('setup')) return 'setup';
  if (tags.includes('troubleshooting')) return 'troubleshooting';
  return 'faq';
}

function isPlaceholderOnly(value) {
  return /^(?:\[(?:photos|videos|audio|gifs|files|sticker|share-link|link|vpn-config-uri|vpn-subscription-link|phone|email|number|token|reference)\]\s*)+$/i.test(
    value.trim()
  );
}

function isAutomationReply(value) {
  return /(?:auto-label added|lead stage set|set to qualified|set to intake|this automated reply was sent)/i.test(
    value
  );
}

function isMarketingGreeting(_customer, pageReply) {
  return pageReply.includes('😍') && pageReply.length > 420;
}

function isUsefulQaRow(customer, pageReply) {
  if (customer.length < 2 || pageReply.length < 2) return false;
  if (isPlaceholderOnly(customer) || isPlaceholderOnly(pageReply)) return false;
  if (isAutomationReply(pageReply)) return false;
  if (isMarketingGreeting(customer, pageReply)) return false;
  return true;
}

function addCount(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function findLatestExportDir(baseDir) {
  const entries = await fs.readdir(baseDir, { withFileTypes: true });
  const candidates = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith(EXPORT_DIR_PREFIX)) continue;
    const fullPath = path.join(baseDir, entry.name);
    const inbox = path.join(
      fullPath,
      "this_profile's_activity_across_facebook",
      'messages',
      'inbox'
    );
    if (!(await pathExists(inbox))) continue;
    const stat = await fs.stat(fullPath);
    candidates.push({ fullPath, mtimeMs: stat.mtimeMs });
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.fullPath || '';
}

async function walkMessageFiles(dir, files = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkMessageFiles(fullPath, files);
    } else if (/^message_\d+\.json$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function normalizeConversationMessages(filePath, data) {
  const conversationKey = fingerprint(path.basename(path.dirname(filePath)));
  return (data.messages || [])
    .map((message) => {
      const rawText = messageText(message);
      const text = redact(rawText);
      return {
        conversationKey,
        timestampMs: Number(message.timestamp_ms || 0),
        createdTime: message.timestamp_ms
          ? new Date(Number(message.timestamp_ms)).toISOString()
          : undefined,
        speaker: speakerFor(message),
        text,
        hasAttachments: attachmentLabels(message).length > 0,
        attachmentLabels: attachmentLabels(message),
      };
    })
    .filter((message) => message.text)
    .sort((a, b) => a.timestampMs - b.timestampMs);
}

function buildQaRows(messages) {
  const rows = [];
  let pendingCustomer = [];
  let pendingStartedAt = '';

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.speaker === 'customer') {
      if (pendingCustomer.length === 0) pendingStartedAt = message.createdTime;
      pendingCustomer.push(message.text);
      if (pendingCustomer.join('\n').length > 1400) {
        pendingCustomer = [pendingCustomer.join('\n').slice(-1400)];
      }
      continue;
    }

    if (message.speaker !== 'page' || pendingCustomer.length === 0) continue;

    const pageReplies = [message.text];
    while (index + 1 < messages.length && messages[index + 1].speaker === 'page') {
      index += 1;
      if (messages[index].text) pageReplies.push(messages[index].text);
    }

    const customer = pendingCustomer.join('\n').trim();
    const pageReply = pageReplies.join('\n').trim();
    if (isUsefulQaRow(customer, pageReply)) {
      const tags = classify(customer, pageReply);
      rows.push({
        conversationKey: message.conversationKey,
        customer,
        pageReply,
        createdTime: pendingStartedAt || message.createdTime,
        tags,
        category: categoryFromTags(tags),
      });
    }

    pendingCustomer = [];
    pendingStartedAt = '';
  }

  return rows;
}

function compactTopEntries(map, limit = 20) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

async function main() {
  const inputArg = argValue('--input') || argValue('--dir');
  const inputDir = inputArg ? path.resolve(inputArg) : await findLatestExportDir(process.cwd());
  const outDir = path.resolve(argValue('--out-dir') || DEFAULT_OUT_DIR);
  const limit = Math.max(1, Math.min(Number(argValue('--limit') || 5000), 20000));
  const dryRun = hasFlag('--dry-run');

  if (!inputDir) {
    throw new Error(`No ${EXPORT_DIR_PREFIX} Facebook export directory found.`);
  }

  const inboxDir = path.join(
    inputDir,
    "this_profile's_activity_across_facebook",
    'messages',
    'inbox'
  );
  if (!(await pathExists(inboxDir))) {
    throw new Error(`Messenger inbox directory not found: ${inboxDir}`);
  }

  const startedAt = new Date();
  const stamp = startedAt.toISOString().replace(/[:.]/g, '-');
  const messagesPath = path.join(outDir, `messages-${stamp}.jsonl`);
  const conversationsPath = path.join(outDir, `conversations-${stamp}.jsonl`);
  const qaPath = path.join(outDir, `qa-candidates-${stamp}.jsonl`);
  const summaryPath = path.join(outDir, `facebook-download-summary-${stamp}.json`);

  const files = await walkMessageFiles(inboxDir);
  const categoryCounts = new Map();
  const tagCounts = new Map();
  const shortPageReplies = new Map();

  let conversationCount = 0;
  let messageCount = 0;
  let customerMessageCount = 0;
  let pageMessageCount = 0;
  let qaCount = 0;
  let mediaMessageCount = 0;
  const samples = [];

  if (!dryRun) await fs.mkdir(outDir, { recursive: true });

  const messagesHandle = dryRun ? null : await fs.open(messagesPath, 'w');
  const conversationsHandle = dryRun ? null : await fs.open(conversationsPath, 'w');
  const qaHandle = dryRun ? null : await fs.open(qaPath, 'w');

  try {
    for (const filePath of files) {
      let data;
      try {
        data = JSON.parse(await fs.readFile(filePath, 'utf8'));
      } catch {
        continue;
      }

      const messages = normalizeConversationMessages(filePath, data);
      if (messages.length === 0) continue;

      conversationCount += 1;
      messageCount += messages.length;
      customerMessageCount += messages.filter((message) => message.speaker === 'customer').length;
      pageMessageCount += messages.filter((message) => message.speaker === 'page').length;
      mediaMessageCount += messages.filter((message) => message.hasAttachments).length;

      const conversation = {
        conversationKey: messages[0].conversationKey,
        messageCount: messages.length,
        firstMessageAt: messages[0]?.createdTime,
        lastMessageAt: messages[messages.length - 1]?.createdTime,
      };
      await conversationsHandle?.write(`${JSON.stringify(conversation)}\n`);

      for (const message of messages) {
        await messagesHandle?.write(`${JSON.stringify(message)}\n`);
      }

      for (const row of buildQaRows(messages)) {
        if (qaCount >= limit) break;
        qaCount += 1;
        addCount(categoryCounts, row.category);
        for (const tag of row.tags) addCount(tagCounts, tag);

        const firstReplyLine = row.pageReply.split(/\r?\n/)[0].trim();
        if (
          firstReplyLine.length >= 2 &&
          firstReplyLine.length <= 90 &&
          !firstReplyLine.includes('[vpn-subscription-link]')
        ) {
          addCount(shortPageReplies, firstReplyLine);
        }

        if (samples.length < 8) {
          samples.push({
            customer: row.customer.slice(0, 220),
            pageReply: row.pageReply.slice(0, 260),
            tags: row.tags,
          });
        }

        await qaHandle?.write(`${JSON.stringify(row)}\n`);
      }

      if (qaCount >= limit) break;
    }
  } finally {
    await messagesHandle?.close();
    await conversationsHandle?.close();
    await qaHandle?.close();
  }

  const summary = {
    ok: true,
    dryRun,
    inputDir,
    conversationCount,
    messageCount,
    customerMessageCount,
    pageMessageCount,
    mediaMessageCount,
    qaCount,
    categoryCounts: Object.fromEntries(categoryCounts),
    tagCounts: Object.fromEntries(tagCounts),
    topShortPageReplies: compactTopEntries(shortPageReplies, 25),
    samples,
    files: dryRun
      ? {}
      : {
          conversationsPath,
          messagesPath,
          qaPath,
          summaryPath,
        },
  };

  if (!dryRun) {
    await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
