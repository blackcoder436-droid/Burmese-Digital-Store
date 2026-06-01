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
      rows.push({ customer, pageReply, createdTime: item.createdTime });
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
  const limit = Math.max(1, Math.min(Number(argValue('--limit') || 300), 5000));
  const priority = Math.max(0, Math.min(Number(argValue('--priority') || 25), 100));
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

  for (const row of rows) {
    const id = fingerprint(row.customer, row.pageReply);
    const content = [
      'Real Facebook Page support example. Use this only for BDS Admin tone and conversation style, not as private customer data.',
      'Do not treat old history as current facts about price, product availability, app compatibility, server status, keys, refunds, or policies. Current AI Ops/catalog rules override old chat history.',
      '',
      `Customer asked: ${row.customer}`,
      `Page admin replied: ${row.pageReply}`,
      '',
      'When answering a similar question, copy the human style: short, personal, one-customer-at-a-time, and ask the next useful question. Do not mention this history item.',
    ].join('\n');

    const result = await collection.updateOne(
      { title: `Facebook QA ${id}` },
      {
        $set: {
          title: `Facebook QA ${id}`,
          category: 'faq',
          content,
          tags: extractTags(row.customer, row.pageReply),
          channels: ['all'],
          enabled: true,
          priority,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    upserted += result.upsertedCount || 0;
    matched += result.matchedCount || 0;
  }

  await mongoose.disconnect();
  console.log(JSON.stringify({ ok: true, filePath, read: rows.length, upserted, matched }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
