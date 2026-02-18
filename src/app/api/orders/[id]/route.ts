import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { isValidObjectId } from '@/lib/security';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/orders/[id]' });

// GET /api/orders/[id] - Get single order (user must own it)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    await connectDB();

    const order = await Order.findOne({
      _id: id,
      user: authUser.userId,
    })
      .populate('product', 'name category price image')
      .lean();

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { order },
    });
  } catch (error: unknown) {
    log.error('Order GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
