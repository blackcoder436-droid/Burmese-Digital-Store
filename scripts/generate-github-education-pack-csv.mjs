#!/usr/bin/env node
import fs from 'fs/promises';
import { fetch } from 'undici';
import { JSDOM } from 'jsdom';

// Generates a CSV suitable for importing into the admin products import endpoint
// Usage: node scripts/generate-github-education-pack-csv.mjs

const SOURCE_URL = 'https://education.github.com/pack';

function csvEscape(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

console.log('Fetching', SOURCE_URL);
const res = await fetch(SOURCE_URL, { headers: { 'user-agent': 'burmesedigital-import-script/1.0' } });
if (!res.ok) {
  console.error('Failed to fetch source:', res.status, res.statusText);
  process.exit(1);
}
const html = await res.text();
const dom = new JSDOM(html);
const doc = dom.window.document;

const imgSelectorRegex = /(educationwebblobstorage|assets\/pack|packcompany|logo-)/i;

const imgs = Array.from(doc.querySelectorAll('img')).filter((img) => img.src && imgSelectorRegex.test(img.src));

const products = [];
for (const img of imgs) {
  // Find a nearby heading that likely contains the company name
  let heading = null;
  let node = img;
  for (let depth = 0; depth < 6 && node; depth++) {
    const h = node.querySelector('h3, h2, h4, h5, h6');
    if (h && h.textContent && h.textContent.trim().length > 0) {
      heading = h;
      break;
    }
    node = node.parentElement;
  }

  if (!heading) {
    // try previous siblings
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
  if (products.some((p) => p.name === name)) continue; // dedupe

  // Find a nearby descriptive paragraph
  let description = '';
  const container = heading.parentElement || img.parentElement;
  if (container) {
    const paragraphs = container.querySelectorAll('p, div');
    for (const p of paragraphs) {
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

  const imageUrl = img.src.startsWith('http') ? img.src : new URL(img.src, SOURCE_URL).href;
  products.push({ name, description, image: imageUrl });
}

if (products.length === 0) {
  console.error('No products found on the source page. HTML structure may have changed.');
  process.exit(1);
}

// Build CSV rows expected by /api/admin/products/import
const header = ['name','category','description','price','image','featured','active','stock','fulfillmentMode','keys'];
const rows = products.map((p) => {
  const fields = [
    p.name,
    'software',         // category (valid: vpn, streaming, gaming, software, gift-card, other)
    p.description,
    30000,              // price in MMK
    p.image,
    false,              // featured
    true,               // active
    5,                  // stock qty
    'manual',           // fulfillmentMode
    ''                  // keys/details
  ];
  return fields.map(csvEscape).join(',');
});

const csv = [header.join(','), ...rows].join('\n');
await fs.mkdir('exports', { recursive: true });
const outPath = 'exports/github-education-pack.csv';
await fs.writeFile(outPath, csv, 'utf8');
console.log(`Wrote ${products.length} products to ${outPath}`);
console.log('Next steps:');
console.log(`1) Open the admin: /admin/products and click "Import CSV", then upload ${outPath}`);
console.log('2) Alternatively, POST the CSV to /api/admin/products/import with an authenticated admin session.');
