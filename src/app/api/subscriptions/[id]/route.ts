import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Subscription from '@/models/Subscription';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { isValidObjectId } from '@/lib/security';

// PUT /api/subscriptions/[id] - Cancel or toggle auto-renewal
export async function PUT(
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
      return NextResponse.json({ success: false, error: 'Invalid subscription ID' }, { status: 400 });
    }

    const body = await request.json();
    const { action } = body; // 'cancel' | 'toggle-auto-renew'

    await connectDB();

    const subscription = await Subscription.findById(id);
    if (!subscription) {
      return NextResponse.json({ success: false, error: 'Subscription not found' }, { status: 404 });
    }

    if (subscription.user.toString() !== authUser.userId) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    if (action === 'cancel') {
      if (subscription.status === 'cancelled') {
        return NextResponse.json({ success: false, error: 'Already cancelled' }, { status: 400 });
      }
      subscription.status = 'cancelled';
      subscription.cancelledAt = new Date();
      subscription.autoRenew = false;
      subscription.cancelReason = body.reason || '';
    } else if (action === 'toggle-auto-renew') {
      subscription.autoRenew = !subscription.autoRenew;
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }

    await subscription.save();

    return NextResponse.json({
      success: true,
      data: { subscription },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update subscription' },
      { status: 500 }
    );
  }
}
