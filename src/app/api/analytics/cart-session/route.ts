import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import CartSession, { CartAction } from '@/models/CartSession';
import { apiLimiter } from '@/lib/rateLimit';
import { getAuthUser } from '@/lib/auth';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/analytics/cart-session' });

interface CartItemPayload {
  productId: string;
  quantity: number;
  price: number;
}

interface CartEventBody {
  sessionId: string;
  action: CartAction;
  itemCount: number;
  subtotal: number;
  items: CartItemPayload[];
}

export async function POST(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const body = (await request.json()) as Partial<CartEventBody>;

    const sessionId = String(body.sessionId || '').trim();
    const action = body.action as CartAction | undefined;
    const itemCount = Number(body.itemCount ?? 0);
    const subtotal = Number(body.subtotal ?? 0);
    const items = Array.isArray(body.items) ? body.items.slice(0, 20) : [];

    if (!sessionId || sessionId.length < 8 || sessionId.length > 128) {
      return NextResponse.json({ success: false, error: 'Invalid sessionId' }, { status: 400 });
    }

    if (!['cart_updated', 'checkout_started', 'checkout_completed'].includes(String(action))) {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }

    if (!Number.isFinite(itemCount) || itemCount < 0 || itemCount > 999) {
      return NextResponse.json({ success: false, error: 'Invalid itemCount' }, { status: 400 });
    }

    if (!Number.isFinite(subtotal) || subtotal < 0) {
      return NextResponse.json({ success: false, error: 'Invalid subtotal' }, { status: 400 });
    }

    const sanitizedItems = items
      .filter((item) =>
        item &&
        typeof item.productId === 'string' &&
        item.productId.length > 0 &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        Number.isFinite(item.price) &&
        item.price >= 0
      )
      .map((item) => ({
        productId: String(item.productId).slice(0, 64),
        quantity: Number(item.quantity),
        price: Number(item.price),
      }));

    await connectDB();

    let authUserId: string | null = null;
    try {
      const authUser = await getAuthUser();
      authUserId = authUser?.userId || null;
    } catch {
      authUserId = null;
    }

    const now = new Date();
    const update: Record<string, unknown> = {
      lastAction: action,
      itemCount,
      subtotal,
      items: sanitizedItems,
      updatedAt: now,
    };

    if (authUserId) {
      update.user = authUserId;
    }

    if (action === 'checkout_started') {
      update.checkoutStartedAt = now;
    }

    if (action === 'checkout_completed') {
      update.checkoutCompletedAt = now;
    }

    await CartSession.findOneAndUpdate(
      { sessionId },
      {
        $set: update,
        $setOnInsert: { sessionId },
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    log.warn('Cart session analytics ingest failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: 'Failed to ingest cart analytics' }, { status: 500 });
  }
}
