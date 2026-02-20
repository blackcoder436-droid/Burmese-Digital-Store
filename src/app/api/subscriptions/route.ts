import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Subscription from '@/models/Subscription';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';

// GET /api/subscriptions - List user's subscriptions
export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    await connectDB();

    const subscriptions = await Subscription.find({ user: authUser.userId })
      .populate('product', 'name slug image price subscriptionDuration subscriptionPrice')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: { subscriptions },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
}
