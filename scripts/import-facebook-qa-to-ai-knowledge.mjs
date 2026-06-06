#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: '.env.local' });
dotenv.config();

const DEFAULT_DIR = 'exports/facebook-page-history';
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?:\+?95|\+?1)?[\s.-]?(?:\d[\s.-]?){7,14}\d/g;
const TX_RE = /\b(?:txid|transaction|trx|ref|reference|order)\s*[:#-]?\s*[a-z0-9_-]{5,}\b/gi;
const VPN_URI_RE = /\b(?:ss|ssr|vmess|vless|trojan|hysteria2?|tuic):\/\/[^\s"'<>]+/gi;
const SECRET_URL_PARAM_RE = /([?&](?:access_token|token|key|secret)=)[^&\s"'<>]+/gi;
const REDACTED_SECRET_RE = /\[(?:vpn-link|redacted)\]/i;
const ALLOWED_CATEGORIES = new Set([
  'pricing',
  'service',
  'setup',
  'troubleshooting',
  'payment',
  'policy',
  'faq',
  'announcement',
  'other',
]);

function argValue(name) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : '';
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function redact(value = '') {
  return String(value)
    .replace(VPN_URI_RE, '[vpn-link]')
    .replace(SECRET_URL_PARAM_RE, '$1[redacted]')
    .replace(EMAIL_RE, '[email]')
    .replace(PHONE_RE, '[phone]')
    .replace(TX_RE, '[reference]')
    .replace(/\s+/g, ' ')
    .trim();
}

function fingerprint(customer, pageReply) {
  return crypto
    .createHash('sha256')
    .update(`${customer}\n---\n${pageReply}`)
    .digest('hex')
    .slice(0, 16);
}

function extractTags(customer, pageReply) {
  const text = `${customer} ${pageReply}`.toLowerCase();
  const tags = new Set(['facebook-history', 'customer-qa']);
  const candidates = [
    ['vpn', /vpn|v2ray|vless|trojan|vmess|key/],
    ['vps', /vps|cloud server|ubuntu|droplet/],
    ['domain', /domain|domains|\.com|\.dev|\.app|ဒိုမိန်း/],
    ['payment', /payment|pay|kpay|wave|aya|uab|slip|screenshot|ငွေ|ပေးချေ/],
    ['setup', /setup|install|တပ်ဆင်|သုံးနည်း/],
    ['troubleshooting', /error|problem|မရ|မချိတ်|ပြဿနာ|နှေး/],
    ['price', /price|plan|ဈေး|စျေး|ဘယ်လောက်/],
  ];

  for (const [tag, pattern] of candidates) {
    if (pattern.test(text)) tags.add(tag);
  }

  return Array.from(tags).slice(0, 12);
}

function normalizeTags(item, customer, pageReply) {
  const tags = new Set(extractTags(customer, pageReply));
  if (Array.isArray(item.tags)) {
    for (const tag of item.tags) {
      if (typeof tag === 'string' && tag.trim()) tags.add(tag.trim().toLowerCase());
    }
  }
  return Array.from(tags).slice(0, 16);
}

function categoryFromTags(tags, fallback = 'faq') {
  if (tags.includes('troubleshooting')) return 'troubleshooting';
  if (tags.includes('setup')) return 'setup';
  if (tags.includes('payment')) return 'payment';
  if (tags.includes('price')) return 'pricing';
  return fallback;
}

function isNoisyHistoricalReply(pageReply) {
  return (
    /(?:auto-label added|lead stage set|set to qualified|set to intake|this automated reply was sent)/i.test(pageReply) ||
    (pageReply.includes('😍') && pageReply.length > 420)
  );
}

async function findLatestQaFile(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || !/^qa-candidates-.*\.jsonl$/i.test(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    const stat = await fs.stat(fullPath);
    if (stat.size === 0) continue;
    files.push({ path: fullPath, mtimeMs: stat.mtimeMs });
  }
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files[0]?.path || '';
}

async function readQaRows(filePath, limit) {
  const text = await fs.readFile(filePath, 'utf8');
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const item = JSON.parse(line);
      const customer = redact(item.customer || '');
      const pageReply = redact(item.pageReply || '');
      if (customer.length < 3 || pageReply.length < 3) continue;
      if (customer.length > 1200 || pageReply.length > 2500) continue;
      if (REDACTED_SECRET_RE.test(customer) || REDACTED_SECRET_RE.test(pageReply)) continue;
      if (isNoisyHistoricalReply(pageReply)) continue;
      const tags = normalizeTags(item, customer, pageReply);
      const category = ALLOWED_CATEGORIES.has(item.category)
        ? item.category
        : categoryFromTags(tags);
      rows.push({ customer, pageReply, createdTime: item.createdTime, tags, category });
      if (rows.length >= limit) break;
    } catch {
      // Skip malformed lines.
    }
  }
  return rows;
}

async function main() {
  const fileArg = argValue('--file');
  const dir = argValue('--dir') || DEFAULT_DIR;
  const limit = Math.max(1, Math.min(Number(argValue('--limit') || 300), 20000));
  const priority = Math.max(0, Math.min(Number(argValue('--priority') || 25), 100));
  const batchSize = Math.max(50, Math.min(Number(argValue('--batch-size') || 500), 1000));
  const dryRun = hasFlag('--dry-run');
  const filePath = fileArg || await findLatestQaFile(dir);

  if (!filePath) {
    throw new Error(`No qa-candidates JSONL file found. Expected ${dir}/qa-candidates-*.jsonl`);
  }

  const rows = await readQaRows(filePath, limit);
  if (dryRun) {
    console.log(JSON.stringify({ ok: true, dryRun, filePath, rows: rows.length }, null, 2));
    return;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const collection = mongoose.connection.db.collection('aiknowledgeitems');
  let upserted = 0;
  let matched = 0;
  let modified = 0;
  const operations = [];

  async function flush() {
    if (operations.length === 0) return;
    const result = await collection.bulkWrite(operations.splice(0), { ordered: false });
    upserted += result.upsertedCount || 0;
    matched += result.matchedCount || 0;
    modified += result.modifiedCount || 0;
  }

  for (const row of rows) {
    const id = fingerprint(row.customer, row.pageReply);
    const content = [
      'Real Facebook Page support example. Use this for BDS Admin tone and solved-case troubleshooting guidance when the same app/error/problem matches.',
      'Do not copy private customer data or old secrets. Do not treat old history as current facts about price, product availability, server status, keys, refunds, or policies. Current AI Ops/catalog rules override old chat history.',
      'If the old reply contains price, payment-account, phone, link, or key-delivery wording, reuse only the customer-handling flow and tone; use current live catalog/payment/key rules for actual details.',
      '',
      `Customer asked: ${row.customer}`,
      `Page admin replied: ${row.pageReply}`,
      '',
      'When answering a similar issue, copy the human style and the next-step direction: short, personal, one-customer-at-a-time. Do not mention this history item.',
    ].join('\n');

    operations.push({
      updateOne: {
        filter: { title: `Facebook QA ${id}` },
        update: {
          $set: {
            title: `Facebook QA ${id}`,
            category: row.category || 'faq',
            content,
            tags: row.tags?.length ? row.tags : extractTags(row.customer, row.pageReply),
            channels: ['all'],
            enabled: true,
            priority,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        upsert: true,
      },
    });

    if (operations.length >= batchSize) {
      await flush();
      console.log(`Imported ${upserted + matched} / ${rows.length} rows...`);
    }
  }

  await flush();
  await mongoose.disconnect();
  console.log(JSON.stringify({ ok: true, filePath, read: rows.length, upserted, matched, modified }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
