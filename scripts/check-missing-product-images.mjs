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

const uploadsProducts = path.resolve(process.cwd(), 'public/uploads/products');
const uploadsGhPack = path.resolve(process.cwd(), 'public/uploads/gh-pack');
const reportDir = path.resolve(process.cwd(), 'scripts/reports');

async function ensureDir(dir) {
  try { await fs.mkdir(dir, { recursive: true }); } catch (e) {}
}

function basenameFromImage(img) {
  if (!img) return '';
  try {
    const parts = String(img).split('/');
    return decodeURIComponent(parts[parts.length - 1] || '').trim();
  } catch (e) {
    return '';
  }
}

async function fileExists(p) {
  try { const st = await fs.stat(p); return st.isFile(); } catch (e) { return false; }
}

async function main() {
  await ensureDir(reportDir);
  await mongoose.connect(MONGODB_URI, { bufferCommands: false, maxPoolSize: 10 });
  const coll = mongoose.connection.db.collection('products');

  const cursor = coll.find({ image: { $regex: 'uploads/', $options: 'i' } });
  const results = [];
  const ghFiles = new Set(await (async () => { try { return await fs.readdir(uploadsGhPack); } catch (e) { return []; } })());

  let total = 0, missing = 0, matchedGh = 0, ok = 0;

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    total++;
    const img = doc.image || '';
    const basename = basenameFromImage(img);
    const expectedPath = path.join(process.cwd(), 'public', img.replace(/^\//, ''));
    const exists = await fileExists(expectedPath);
    if (exists) {
      ok++;
      results.push({ _id: String(doc._id), name: doc.name, image: img, status: 'ok' });
      continue;
    }
    missing++;
    let suggestion = null;
    if (basename) {
      // try exact match in gh-pack
      for (const f of ghFiles) {
        if (f === basename) { suggestion = `/uploads/gh-pack/${f}`; break; }
      }
      // try case-insensitive or simplified match
      if (!suggestion) {
        const key = basename.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const f of ghFiles) {
          const fk = f.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (fk.includes(key) || key.includes(fk)) { suggestion = `/uploads/gh-pack/${f}`; break; }
        }
      }
    }

    if (suggestion) matchedGh++;

    results.push({ _id: String(doc._id), name: doc.name, image: img, exists: false, basename, suggestion });
  }

  const summary = { totalChecked: total, ok, missing, matchedGh };
  await fs.writeFile(path.join(reportDir, 'missing-product-images.json'), JSON.stringify({ summary, results }, null, 2), 'utf8');

  // also CSV (simple)
  const csvLines = ['_id,name,image,basename,suggestion,status'];
  for (const r of results) {
    csvLines.push([r._id, `"${(r.name||'').replace(/"/g,'""')}"]`, r.image || '', r.basename || '', r.suggestion || '', r.status || (r.exists === false ? 'missing' : 'ok')].join(','));
  }
  await fs.writeFile(path.join(reportDir, 'missing-product-images.csv'), csvLines.join('\n'), 'utf8');

  console.log('Scan complete:', summary);
  console.log('Report saved to scripts/reports/missing-product-images.json');

  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
