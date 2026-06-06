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

const assetsFolderArg = process.argv[2] || 'facebook-BurmeseDigitalStore-2026-06-02-EaoI1ASe/GitHub Student Developer Pack - GitHub Education_files';
const assetsFolder = path.resolve(process.cwd(), assetsFolderArg);
const destFolder = path.resolve(process.cwd(), 'public/uploads/gh-pack');

function generateSlug(name) {
  const base = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'product';
  return base;
}

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {}
}

async function main() {
  console.log('Assets folder:', assetsFolder);
  console.log('Destination folder:', destFolder);
  await ensureDir(destFolder);

  await mongoose.connect(MONGODB_URI, { bufferCommands: false, maxPoolSize: 10 });
  const coll = mongoose.connection.db.collection('products');

  // Find products that reference the HTML assets (or all products if none)
  const docs = await coll.find({}).toArray();

  let updated = 0;
  let slugged = 0;
  let copied = 0;
  let missingFiles = 0;

  for (const d of docs) {
    const img = d.image || '';
    let basename = '';
    try {
      const parts = img.split('/');
      basename = decodeURIComponent(parts[parts.length - 1] || '').trim();
    } catch (e) {
      basename = '';
    }

    const sourcePath = basename ? path.join(assetsFolder, basename) : '';
    const destPath = basename ? path.join(destFolder, basename) : '';

    let needUpdate = false;

    // If source file exists in assets folder, copy to public and update image path
    if (sourcePath) {
      try {
        const stat = await fs.stat(sourcePath);
        if (stat && stat.isFile()) {
          // copy
          await fs.copyFile(sourcePath, destPath);
          const newImage = `/uploads/gh-pack/${basename}`;
          if (d.image !== newImage) {
            await coll.updateOne({ _id: d._id }, { $set: { image: newImage, updatedAt: new Date() } });
            updated++;
          }
          copied++;
          needUpdate = true;
        }
      } catch (e) {
        // file missing
        missingFiles++;
      }
    }

    // Ensure slug exists
    if (!d.slug || String(d.slug).trim() === '') {
      const base = generateSlug(d.name || 'product');
      let slug = base;
      let counter = 0;
      while (true) {
        const existing = await coll.findOne({ slug });
        if (!existing) break;
        counter++;
        slug = `${base}-${counter}`;
      }
      await coll.updateOne({ _id: d._id }, { $set: { slug, updatedAt: new Date() } });
      slugged++;
      needUpdate = true;
    }

    if (needUpdate) {
      // nothing else
    }
  }

  console.log(`Copied files: ${copied}, Updated image fields: ${updated}, Added slugs: ${slugged}, Missing files: ${missingFiles}`);

  await mongoose.disconnect();
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
