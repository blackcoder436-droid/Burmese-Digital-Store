import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import StockAlert from '@/models/StockAlert';
import Product from '@/models/Product';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { isValidObjectId } from '@/lib/security';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/products/[id]/stock-alert' });

/**
 * GET /api/products/[id]/stock-alert — Check if user is subscribed to stock alert
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ success: true, data: { subscribed: false } });
    }

    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: 'Invalid product ID' }, { status: 400 });
    }

    await connectDB();

    const alert = await StockAlert.findOne({
      user: authUser.userId,
      product: id,
      notified: false,
    }).lean();

    return NextResponse.json({
      success: true,
      data: { subscribed: !!alert },
    });
  } catch (error: unknown) {
    log.error('Stock alert GET error', { error: String(error) });
    return NextResponse.json({ success: false, error: 'Failed to check stock alert' }, { status: 500 });
  }
}

/**
 * POST /api/products/[id]/stock-alert — Subscribe to stock alert
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: 'Invalid product ID' }, { status: 400 });
    }

    await connectDB();

    // Verify product exists and is out of stock
    const product = await Product.findById(id).select('stock isActive').lean();
    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    const p = product as any;
    if (p.stock > 0) {
      return NextResponse.json({ success: false, error: 'Product is currently in stock' }, { status: 400 });
    }

    // Limit subscriptions per user
    const userAlertCount = await StockAlert.countDocuments({ user: authUser.userId, notified: false });
    if (userAlertCount >= 20) {
      return NextResponse.json({ success: false, error: 'Maximum stock alerts reached (20)' }, { status: 400 });
    }

    // Upsert to prevent duplicates + reset notified flag
    await StockAlert.findOneAndUpdate(
      { user: authUser.userId, product: id },
      { user: authUser.userId, product: id, notified: false, notifiedAt: null },
      { upsert: true, new: true }
    );

    log.info('Stock alert subscription created', { userId: authUser.userId, productId: id });

    return NextResponse.json({ success: true, data: { subscribed: true } });
  } catch (error: unknown) {
    log.error('Stock alert POST error', { error: String(error) });
    return NextResponse.json({ success: false, error: 'Failed to subscribe' }, { status: 500 });
  }
}

/**
 * DELETE /api/products/[id]/stock-alert — Unsubscribe from stock alert
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: 'Invalid product ID' }, { status: 400 });
    }

    await connectDB();

    await StockAlert.findOneAndDelete({ user: authUser.userId, product: id });

    return NextResponse.json({ success: true, data: { subscribed: false } });
  } catch (error: unknown) {
    log.error('Stock alert DELETE error', { error: String(error) });
    return NextResponse.json({ success: false, error: 'Failed to unsubscribe' }, { status: 500 });
  }
}
