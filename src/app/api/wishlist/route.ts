import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Wishlist from '@/models/Wishlist';
import Product from '@/models/Product';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { isValidObjectId } from '@/lib/security';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/wishlist' });

// ==========================================
// Wishlist API — GET (list) + POST (add)
// Phase 10.4 — Wishlist / Favorites System
// ==========================================

/**
 * GET /api/wishlist — Get user's wishlist
 */
export async function GET(request: NextRequest) {
  const limitRes = await apiLimiter(request);
  if (limitRes) return limitRes;

  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    await connectDB();

    const items = await Wishlist.find({ user: user.userId })
      .populate({
        path: 'product',
        select: 'name slug description price category stock image averageRating reviewCount active',
      })
      .sort({ createdAt: -1 })
      .lean();

    // Filter out null products (deleted) and inactive products
    const validItems = items.filter(
      (item: any) => item.product && item.product.active !== false
    );

    return NextResponse.json({
      success: true,
      data: {
        items: validItems.map((item: any) => ({
          _id: item._id,
          product: item.product,
          addedAt: item.createdAt,
        })),
        total: validItems.length,
      },
    });
  } catch (error) {
    log.error('Failed to get wishlist', { error: String(error) });
    return NextResponse.json({ success: false, error: 'Failed to get wishlist' }, { status: 500 });
  }
}

/**
 * POST /api/wishlist — Add product to wishlist
 * Body: { productId: string }
 */
export async function POST(request: NextRequest) {
  const limitRes = await apiLimiter(request);
  if (limitRes) return limitRes;

  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { productId } = body;

    if (!productId || !isValidObjectId(productId)) {
      return NextResponse.json({ success: false, error: 'Invalid product ID' }, { status: 400 });
    }

    await connectDB();

    // Verify product exists and is active
    const product = await Product.findOne({ _id: productId, active: true }).lean();
    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    // Max 50 items per user's wishlist
    const count = await Wishlist.countDocuments({ user: user.userId });
    if (count >= 50) {
      return NextResponse.json({ success: false, error: 'Wishlist is full (max 50 items)' }, { status: 400 });
    }

    // Upsert to prevent duplicates
    await Wishlist.findOneAndUpdate(
      { user: user.userId, product: productId },
      { user: user.userId, product: productId },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true, data: { added: true } });
  } catch (error) {
    log.error('Failed to add to wishlist', { error: String(error) });
    return NextResponse.json({ success: false, error: 'Failed to add to wishlist' }, { status: 500 });
  }
}

/**
 * DELETE /api/wishlist — Remove product from wishlist
 * Body: { productId: string }
 */
export async function DELETE(request: NextRequest) {
  const limitRes = await apiLimiter(request);
  if (limitRes) return limitRes;

  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { productId } = body;

    if (!productId || !isValidObjectId(productId)) {
      return NextResponse.json({ success: false, error: 'Invalid product ID' }, { status: 400 });
    }

    await connectDB();

    const result = await Wishlist.findOneAndDelete({ user: user.userId, product: productId });

    return NextResponse.json({
      success: true,
      data: { removed: !!result },
    });
  } catch (error) {
    log.error('Failed to remove from wishlist', { error: String(error) });
    return NextResponse.json({ success: false, error: 'Failed to remove from wishlist' }, { status: 500 });
  }
}
