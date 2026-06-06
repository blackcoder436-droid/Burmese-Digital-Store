#!/usr/bin/env node
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: '.env.local' });
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI missing in .env.local');
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGODB_URI, { bufferCommands: false, maxPoolSize: 10 });
  const coll = mongoose.connection.db.collection('products');
  const total = await coll.countDocuments();
  const gh = await coll.countDocuments({ image: { $regex: 'gh-pack', $options: 'i' } });
  const uploadsProducts = await coll.countDocuments({ image: { $regex: 'uploads/products', $options: 'i' } });
  const uploadsAny = await coll.countDocuments({ image: { $regex: 'uploads/', $options: 'i' } });
  console.log({ total, gh, uploadsProducts, uploadsAny });
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
