import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { logActivity } from '@/models/ActivityLog';
import { sanitizeString, sanitizeUrlString } from '@/lib/security';
import { normalizeImageSrc } from '@/lib/image';
import { getStockForSave, normalizeStockQty, type ProductFulfillmentMode } from '@/lib/product-stock';

function normalizeFulfillmentMode(value: unknown): ProductFulfillmentMode {
  return value === 'preloaded' ? 'preloaded' : 'manual';
}

function normalizeProductDetails(details: unknown) {
  if (!Array.isArray(details)) return [];

  return details.map((detail) => {
    const item = detail && typeof detail === 'object' ? detail as Record<string, unknown> : {};
    return {
      serialKey: sanitizeString(String(item.serialKey || '')).slice(0, 500),
      loginEmail: sanitizeString(String(item.loginEmail || '')).slice(0, 200),
      loginPassword: sanitizeString(String(item.loginPassword || '')).slice(0, 200),
      additionalInfo: sanitizeString(String(item.additionalInfo || '')).slice(0, 1000),
      sold: item.sold === true,
    };
  });
}

// PATCH /api/admin/products - Bulk update purchaseDisabled for all products
export async function PATCH(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const admin = await requireAdmin();
    await connectDB();

    const body = await request.json();
    const { purchaseDisabled } = body;

    if (typeof purchaseDisabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'purchaseDisabled must be a boolean' },
        { status: 400 }
      );
    }

    const result = await Product.updateMany(
      { active: true },
      { $set: { purchaseDisabled } }
    );

    try {
      await logActivity({
        admin: admin.userId,
        action: 'product_updated',
        target: `All active products (${result.modifiedCount} updated)`,
        details: purchaseDisabled ? 'Bulk purchase disabled' : 'Bulk purchase enabled',
      });
    } catch { /* ignore */ }

    return NextResponse.json({
      success: true,
      data: { modifiedCount: result.modifiedCount },
      message: `Purchase ${purchaseDisabled ? 'disabled' : 'enabled'} for ${result.modifiedCount} products`,
    });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    console.error('Admin products PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/admin/products - List all products (admin)
export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        products,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 403 }
      );
    }
    console.error('Admin products GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/products - Create product
export async function POST(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const admin = await requireAdmin();
    await connectDB();

    const body = await request.json();
    const {
      name,
      category,
      description,
      price,
      image,
      featured,
      purchaseDisabled,
      details,
      stock,
      fulfillmentMode,
      allowedPaymentGateways,
    } = body;

    if (!name || !category || !description || price === undefined) {
      return NextResponse.json(
        { success: false, error: 'Name, category, description, and price are required' },
        { status: 400 }
      );
    }

    // Sanitize user inputs to prevent XSS
    const safeName = sanitizeString(name);
    const safeCategory = sanitizeString(category);
    const safeDescription = sanitizeString(description);
    const safePrice = Math.max(0, Number(price) || 0);
    const safeFulfillmentMode = normalizeFulfillmentMode(fulfillmentMode);
    const safeDetails = normalizeProductDetails(details);
    const safeStock = getStockForSave(safeFulfillmentMode, safeDetails, normalizeStockQty(stock));

    const validCategories = ['vpn', 'streaming', 'gaming', 'software', 'gift-card', 'other'];
    if (!validCategories.includes(safeCategory)) {
      return NextResponse.json(
        { success: false, error: 'Invalid category' },
        { status: 400 }
      );
    }

    const product = await Product.create({
      name: safeName,
      category: safeCategory,
      description: safeDescription,
      price: safePrice,
      image: normalizeImageSrc(sanitizeUrlString(String(image || '')).slice(0, 500)) || '/images/default-product.png',
      featured: featured || false,
      purchaseDisabled: purchaseDisabled === true,
      fulfillmentMode: safeFulfillmentMode,
      details: safeFulfillmentMode === 'preloaded' ? safeDetails : [],
      stock: safeStock,
      allowedPaymentGateways: Array.isArray(allowedPaymentGateways) ? allowedPaymentGateways : [],
    });

    try {
      await logActivity({
        admin: admin.userId,
        action: 'product_created',
        target: `${name} (${category})`,
        details: `Price: ${price} MMK, Stock: ${safeStock}, Mode: ${safeFulfillmentMode}`,
        metadata: { productId: product._id },
      });
    } catch { /* ignore */ }

    return NextResponse.json(
      {
        success: true,
        data: { product },
        message: 'Product created successfully',
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 403 }
      );
    }
    console.error('Admin product POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
