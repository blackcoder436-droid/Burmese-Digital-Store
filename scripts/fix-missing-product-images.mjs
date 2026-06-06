#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: '.env.local' });
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI missing in .env.local');
  process.exit(1);
}

const uploadsFolder = path.resolve(process.cwd(), 'public/uploads/gh-pack');
const fallbackImage = '/uploads/gh-pack/logo-full-dark.png';

function normalizeImage(image) {
  if (!image) return undefined;
  let decoded = image;
  for (let i = 0; i < 2; i++) {
    decoded = decoded.replace(/&amp;/gi, '&').replace(/&#x2f;|&#47;/gi, '/').replace(/&quot;/gi, '"').replace(/&#x27;|&#39;/gi, "'");
  }
  const trimmed = decoded.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;
  const withForwardSlashes = trimmed.replace(/\\/g, '/');
  const withoutPublic = withForwardSlashes.replace(/^\.?\/?public\//i, '/');
  return withoutPublic.startsWith('/') ? withoutPublic : `/${withoutPublic}`;
}

function normalizeKey(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function main() {
  await mongoose.connect(MONGODB_URI, { bufferCommands: false, maxPoolSize: 10 });
  const coll = mongoose.connection.db.collection('products');

  // Build list of available files in uploads folder
  let files = [];
  try {
    files = await fs.readdir(uploadsFolder);
  } catch (e) {
    console.error('Failed to read uploads folder:', uploadsFolder, e.message);
    await mongoose.disconnect();
    process.exit(1);
  }

  const fileMap = new Map();
  for (const f of files) {
    fileMap.set(normalizeKey(f), f);
  }

  const docs = await coll.find({}).toArray();
  let matched = 0;
  let replacedWithFallback = 0;
  let alreadyOk = 0;

  for (const d of docs) {
    const image = d.image || '';
    const normalized = normalizeImage(image);

    let needsFix = false;
    if (!normalized) needsFix = true;
    else if (normalized.startsWith('/')) {
      const localPath = path.join(process.cwd(), 'public', normalized.replace(/^\//, ''));
      try {
        const st = await fs.stat(localPath);
        if (!st.isFile()) needsFix = true;
      } catch (e) {
        needsFix = true;
      }
    } else {
      // remote URL
      needsFix = true;
    }

    if (!needsFix) {
      alreadyOk++;
      continue;
    }

    // Try match by basename
    let basename = '';
    try {
      const parts = String(image).split('/');
      basename = decodeURIComponent(parts[parts.length - 1] || '').trim();
    } catch (e) {
      basename = '';
    }

    const key = normalizeKey(basename);
    let foundFile = null;

    if (key && fileMap.has(key)) {
      foundFile = fileMap.get(key);
    } else if (key) {
      // try substring matches
      for (const [k, f] of fileMap.entries()) {
        if (k.includes(key) || key.includes(k) || k.startsWith(key) || k.endsWith(key)) {
          foundFile = f;
          break;
        }
      }
    }

    if (!foundFile && basename) {
      // try matching by removing hyphens/underscores from basename and comparing
      const alt = key;
      for (const [k, f] of fileMap.entries()) {
        if (k.includes(alt) || alt.includes(k)) { foundFile = f; break; }
      }
    }

    if (foundFile) {
      const newImage = `/uploads/gh-pack/${foundFile}`;
      if (d.image !== newImage) {
        await coll.updateOne({ _id: d._id }, { $set: { image: newImage, updatedAt: new Date() } });
      }
      matched++;
    } else {
      // set fallback
      if (d.image !== fallbackImage) {
        await coll.updateOne({ _id: d._id }, { $set: { image: fallbackImage, updatedAt: new Date() } });
      }
      replacedWithFallback++;
    }
  }

  console.log(`Already OK: ${alreadyOk}, Matched and updated: ${matched}, Replaced with fallback: ${replacedWithFallback}`);

  await mongoose.disconnect();
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
