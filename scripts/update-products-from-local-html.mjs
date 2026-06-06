#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { JSDOM } from 'jsdom';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI missing in .env.local');
  process.exit(1);
}

const arg = process.argv[2];
const defaultRelative = 'facebook-BurmeseDigitalStore-2026-06-02-EaoI1ASe/GitHub Student Developer Pack - GitHub Education.html';
const htmlPath = path.resolve(process.cwd(), arg || defaultRelative);

function normalizeImageKey(url) {
  if (!url) return '';
  try {
    if (/^https?:\/\//i.test(url)) {
      const u = new URL(url);
      return (u.origin + u.pathname).toLowerCase();
    }
  } catch (e) {
    // ignore
  }
  return url.split('?')[0].toLowerCase();
}

function csvEscape(v) {
  return `"${String(v).replace(/"/g, '""')}"`;
}

async function readHtmlFile(file) {
  try {
    const text = await fs.readFile(file, 'utf8');
    return text;
  } catch (err) {
    console.error('Failed to read file', file, err.message);
    process.exit(1);
  }
}

function extractProductsFromDom(doc) {
  const imgSelectorRegex = /(educationwebblobstorage|assets\/pack|packcompany|logo-|logo_|logo)/i;
  const imgs = Array.from(doc.querySelectorAll('img')).filter((img) => img.src && imgSelectorRegex.test(img.src));
  const products = [];
  for (const img of imgs) {
    // find nearest heading
    let heading = null;
    let node = img;
    for (let depth = 0; depth < 6 && node; depth++) {
      const h = node.querySelector && node.querySelector('h3, h2, h4, h5, h6');
      if (h && h.textContent && h.textContent.trim().length > 0) {
        heading = h;
        break;
      }
      node = node.parentElement;
    }
    if (!heading) {
      let prev = img.previousElementSibling;
      while (prev) {
        if (/^H[1-6]$/.test(prev.tagName)) {
          heading = prev;
          break;
        }
        prev = prev.previousElementSibling;
      }
    }
    if (!heading) continue;
    const name = heading.textContent.trim();
    if (!name) continue;
    if (products.some((p) => p.name === name)) continue;

    // description
    let description = '';
    const container = heading.parentElement || img.parentElement;
    if (container) {
      const paras = container.querySelectorAll('p, div');
      for (const p of paras) {
        const t = p.textContent.trim();
        if (t.length >= 20 && !/Offers in this bundle/i.test(t)) {
          description = t.replace(/\s+/g, ' ');
          break;
        }
      }
    }
    if (!description) {
      let next = heading.nextElementSibling;
      while (next) {
        const t = next.textContent.trim();
        if (t.length >= 20) {
          description = t.replace(/\s+/g, ' ');
          break;
        }
        next = next.nextElementSibling;
      }
    }
    if (!description) description = `${name} - GitHub Education offer`;

    const imageUrl = img.src.startsWith('http') ? img.src : new URL(img.src, 'https://education.github.com/pack').href;
    products.push({ name, description, image: imageUrl });
  }
  return products;
}

async function main() {
  console.log('Reading HTML from', htmlPath);
  const html = await readHtmlFile(htmlPath);
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const products = extractProductsFromDom(doc);
  if (products.length === 0) {
    console.error('No products extracted from the HTML file.');
    process.exit(1);
  }

  console.log(`Found ${products.length} product entries in HTML`);

  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI, { bufferCommands: false, maxPoolSize: 10 });
  const coll = mongoose.connection.db.collection('products');

  // build existing image map
  const existing = await coll.find({}, { projection: { image: 1 } }).toArray();
  const imageMap = new Map();
  for (const docu of existing) {
    if (docu.image) imageMap.set(normalizeImageKey(docu.image), docu._id);
  }

  let updated = 0;
  let inserted = 0;
  for (const p of products) {
    const key = normalizeImageKey(p.image);
    const now = new Date();
    const doc = {
      name: p.name,
      category: 'software',
      description: p.description,
      price: 30000,
      stock: 5,
      fulfillmentMode: 'manual',
      details: [],
      image: p.image,
      featured: false,
      active: true,
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
      updatedAt: now,
    };

    if (imageMap.has(key)) {
      const id = imageMap.get(key);
      await coll.updateOne({ _id: id }, { $set: doc });
      updated++;
      console.log('Updated:', p.name);
    } else {
      doc.createdAt = now;
      const res = await coll.insertOne(doc);
      inserted++;
      console.log('Inserted:', p.name);
      imageMap.set(key, res.insertedId);
    }
  }

  console.log(`Done. Updated: ${updated}, Inserted: ${inserted}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err && err.message ? err.message : err);
  process.exit(1);
});
