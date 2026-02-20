import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { sanitizeString } from '@/lib/security';
import { logActivity } from '@/models/ActivityLog';

const VALID_CATEGORIES = new Set(['vpn', 'streaming', 'gaming', 'software', 'gift-card', 'other']);

interface ParsedRow {
  name: string;
  category: string;
  description: string;
  price: number;
  image: string;
  featured: boolean;
  active: boolean;
  details: Array<{
    serialKey: string;
    loginEmail: string;
    loginPassword: string;
    additionalInfo: string;
    sold: boolean;
  }>;
}

export async function POST(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const admin = await requireAdmin();
    await connectDB();

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'CSV file is required' }, { status: 400 });
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'CSV too large (max 2MB)' }, { status: 400 });
    }

    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      return NextResponse.json({ success: false, error: 'CSV must include header and at least one row' }, { status: 400 });
    }

    const header = parseCsvLine(lines[0]).map((h) => normalizeHeader(h));
    const headerMap = new Map<string, number>();
    header.forEach((column, index) => headerMap.set(column, index));

    for (const required of ['name', 'category', 'description', 'price']) {
      if (!headerMap.has(required)) {
        return NextResponse.json({ success: false, error: `Missing required column: ${required}` }, { status: 400 });
      }
    }

    const rows: ParsedRow[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const raw = parseCsvLine(lines[i]);
      const lineNumber = i + 1;

      const name = sanitizeString(getColumn(raw, headerMap, 'name')).slice(0, 100);
      const category = sanitizeString(getColumn(raw, headerMap, 'category')).toLowerCase();
      const description = sanitizeString(getColumn(raw, headerMap, 'description')).slice(0, 1000);
      const price = Number(getColumn(raw, headerMap, 'price'));

      if (!name || !description || !Number.isFinite(price) || price < 0) {
        errors.push(`Line ${lineNumber}: invalid name/description/price`);
        continue;
      }

      if (!VALID_CATEGORIES.has(category)) {
        errors.push(`Line ${lineNumber}: invalid category "${category}"`);
        continue;
      }

      const image = sanitizeString(getColumn(raw, headerMap, 'image') || '/images/default-product.png').slice(0, 500);
      const featured = parseBoolean(getColumn(raw, headerMap, 'featured'));
      const active = parseBoolean(getColumn(raw, headerMap, 'active'), true);

      const details = parseDetails(getColumn(raw, headerMap, 'keys'));

      rows.push({
        name,
        category,
        description,
        price,
        image,
        featured,
        active,
        details,
      });
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid rows found', data: { errors: errors.slice(0, 20) } },
        { status: 400 }
      );
    }

    const createdProducts = [];
    for (const row of rows) {
      const created = await Product.create({
        name: row.name,
        category: row.category,
        description: row.description,
        price: row.price,
        image: row.image,
        featured: row.featured,
        active: row.active,
        details: row.details,
        stock: row.details.length,
      });
      createdProducts.push(created);
    }

    try {
      await logActivity({
        admin: admin.userId,
        action: 'product_created',
        target: `Bulk import (${createdProducts.length} products)`,
        details: `Source file: ${file.name}`,
        metadata: {
          importedCount: createdProducts.length,
          skippedCount: errors.length,
        },
      });
    } catch {
      // non-blocking
    }

    return NextResponse.json({
      success: true,
      data: {
        imported: createdProducts.length,
        skipped: errors.length,
        errors: errors.slice(0, 20),
      },
      message: `Imported ${createdProducts.length} product(s)`,
    });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function getColumn(row: string[], headerMap: Map<string, number>, column: string): string {
  const index = headerMap.get(normalizeHeader(column));
  if (index === undefined) return '';
  return String(row[index] || '').trim();
}

function parseBoolean(value: string, fallback = false): boolean {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return fallback;
  return ['1', 'true', 'yes', 'y'].includes(v);
}

function parseDetails(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return [];

  return raw
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const parts = chunk.split('|').map((part) => sanitizeString(part.trim()));
      return {
        serialKey: parts[0] || '',
        loginEmail: parts[1] || '',
        loginPassword: parts[2] || '',
        additionalInfo: parts[3] || '',
        sold: false,
      };
    });
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
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
