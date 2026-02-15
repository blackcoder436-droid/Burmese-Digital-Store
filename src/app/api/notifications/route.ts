import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Notification from '@/models/Notification';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { isValidObjectId } from '@/lib/security';

// ==========================================
// Notifications API - Burmese Digital Store
// GET: List user's notifications
// PATCH: Mark notifications as read
// ==========================================

// GET /api/notifications — Get user's notifications
export async function GET(request: NextRequest) {
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

    await connectDB();

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    const query: Record<string, unknown> = { user: authUser.userId };
    if (unreadOnly) query.read = false;

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      Notification.countDocuments({ user: authUser.userId, read: false }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error: unknown) {
    console.error('Notifications GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/notifications — Mark notifications as read
export async function PATCH(request: NextRequest) {
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

    await connectDB();

    const body = await request.json();
    const { notificationId, markAllRead } = body;

    if (markAllRead) {
      // Mark all user's notifications as read
      await Notification.updateMany(
        { user: authUser.userId, read: false },
        { $set: { read: true } }
      );
    } else if (notificationId) {
      // Validate ObjectId format
      if (!isValidObjectId(notificationId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid notification ID' },
          { status: 400 }
        );
      }
      // Mark single notification as read (only if it belongs to user)
      await Notification.findOneAndUpdate(
        { _id: notificationId, user: authUser.userId },
        { $set: { read: true } }
      );
    } else {
      return NextResponse.json(
        { success: false, error: 'notificationId or markAllRead is required' },
        { status: 400 }
      );
    }

    const unreadCount = await Notification.countDocuments({
      user: authUser.userId,
      read: false,
    });

    return NextResponse.json({
      success: true,
      data: { unreadCount },
      message: 'Notifications updated',
    });
  } catch (error: unknown) {
    console.error('Notifications PATCH error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
