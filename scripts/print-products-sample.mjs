#!/usr/bin/env node
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: '.env.local' });
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI missing in .env.local');
  process.exit(1);
}

function normalizeImageKey(url) {
  if (!url) return '';
  try {
    if (/^https?:\/\//i.test(url)) {
      const u = new URL(url);
      return (u.origin + u.pathname).toLowerCase();
    }
  } catch (e) {}
  return url.split('?')[0].toLowerCase();
}

async function main() {
  await mongoose.connect(MONGODB_URI, { bufferCommands: false, maxPoolSize: 10 });
  const coll = mongoose.connection.db.collection('products');
  const docs = await coll.find({}).sort({ createdAt: -1 }).limit(20).toArray();
  console.log(`Sample ${docs.length} products (latest):`);
  for (const d of docs) {
    console.log('---');
    console.log('id:', d._id.toString());
    console.log('name:', d.name);
    console.log('slug:', d.slug || '');
    console.log('price:', d.price);
    console.log('stock:', d.stock);
    console.log('image:', d.image || '');
    console.log('imageKey:', normalizeImageKey(d.image || ''));
    console.log('createdAt:', d.createdAt);
  }
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
