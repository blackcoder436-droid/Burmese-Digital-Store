#!/usr/bin/env node
import fs from 'fs/promises';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI missing in .env.local');
  process.exit(1);
}

const CSV_PATH = 'exports/github-education-pack.csv';

function normalizeHeader(value) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function getColumn(row, headerMap, column) {
  const index = headerMap.get(normalizeHeader(column));
  if (index === undefined) return '';
  return String(row[index] || '').trim();
}

function parseBoolean(value, fallback = false) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return fallback;
  return ['1', 'true', 'yes', 'y'].includes(v);
}

function sanitizeString(s, max = 1000) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

async function main() {
  console.log('Reading CSV:', CSV_PATH);
  let text;
  try {
    text = await fs.readFile(CSV_PATH, 'utf8');
  } catch (err) {
    console.error('Failed to read CSV:', err.message);
    process.exit(1);
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    console.error('CSV must include header and at least one row');
    process.exit(1);
  }

  const header = parseCsvLine(lines[0]).map((h) => normalizeHeader(h));
  const headerMap = new Map();
  header.forEach((col, idx) => headerMap.set(col, idx));

  for (const required of ['name', 'category', 'description', 'price']) {
    if (!headerMap.has(required)) {
      console.error('Missing required column in CSV:', required);
      process.exit(1);
    }
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI, { bufferCommands: false, maxPoolSize: 10 });
  console.log('MongoDB connected');

  const coll = mongoose.connection.db.collection('products');

  let inserted = 0;
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const raw = parseCsvLine(lines[i]);
    const lineNumber = i + 1;
    try {
      const name = sanitizeString(getColumn(raw, headerMap, 'name'), 100);
      const category = sanitizeString(getColumn(raw, headerMap, 'category'), 50).toLowerCase();
      const description = sanitizeString(getColumn(raw, headerMap, 'description'), 1000);
      const price = Math.max(0, Number(getColumn(raw, headerMap, 'price')) || 0);
      if (!name || !description || !(Number.isFinite(price))) {
        console.warn(`Skipping line ${lineNumber}: invalid name/description/price`);
        skipped++;
        continue;
      }

      const image = getColumn(raw, headerMap, 'image') || '/images/default-product.png';
      const featured = parseBoolean(getColumn(raw, headerMap, 'featured'));
      const active = parseBoolean(getColumn(raw, headerMap, 'active'), true);
      const stock = Math.max(0, Math.floor(Number(getColumn(raw, headerMap, 'stock')) || 5));

      // generate unique slug
      const base = generateSlug(name) || 'product';
      let slug = base;
      let counter = 0;
      while (true) {
        // check existence
        // includeDeleted not supported here, check raw collection
        // index on slug is unique so make sure we don't conflict
        // note: using findOne on slug
        // eslint-disable-next-line no-await-in-loop
        const exists = await coll.findOne({ slug });
        if (!exists) break;
        counter++;
        slug = `${base}-${counter}`;
      }

      const now = new Date();
      const doc = {
        name,
        slug,
        category,
        description,
        price,
        stock,
        fulfillmentMode: 'manual',
        details: [],
        image,
        featured,
        active,
        purchaseDisabled: false,
        allowedPaymentGateways: [],
        productType: 'single',
        bundleItems: [],
        bundleDiscount: 0,
        subscriptionDuration: null,
        subscriptionPrice: null,
        averageRating: 0,
        reviewCount: 0,
        deletedAt: null,
        deletedBy: null,
        createdAt: now,
        updatedAt: now,
      };

      // eslint-disable-next-line no-await-in-loop
      await coll.insertOne(doc);
      inserted++;
      console.log(`Inserted [${inserted}] ${name}`);
    } catch (err) {
      console.error(`Error processing line ${lineNumber}:`, err && err.message ? err.message : err);
      skipped++;
    }
  }

  console.log(`Import finished. Inserted: ${inserted}, Skipped: ${skipped}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
