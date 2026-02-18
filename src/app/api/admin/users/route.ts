import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Order from '@/models/Order';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { sanitizeString, isValidObjectId } from '@/lib/security';
import { logActivity } from '@/models/ActivityLog';
import { trackAdminPrivilegeChange } from '@/lib/monitoring';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/admin/users' });

// GET /api/admin/users - List all users (admin)
export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
    await connectDB();

    const { searchParams } = new URL(request.url);
    const search = sanitizeString(searchParams.get('search') || '');
    const role = searchParams.get('role') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (role && ['user', 'admin'].includes(role)) query.role = role;
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    // Get order counts per user
    const userIds = users.map((u: any) => u._id);
    const orderCounts = await Order.aggregate([
      { $match: { user: { $in: userIds } } },
      {
        $group: {
          _id: '$user',
          totalOrders: { $sum: 1 },
          totalSpent: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, '$totalAmount', 0],
            },
          },
        },
      },
    ]);

    const orderMap = new Map(
      orderCounts.map((o: any) => [o._id.toString(), o])
    );

    const enrichedUsers = users.map((user: any) => {
      const stats = orderMap.get(user._id.toString());
      return {
        ...user,
        totalOrders: stats?.totalOrders || 0,
        totalSpent: stats?.totalSpent || 0,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        users: enrichedUsers,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error: any) {
    if (
      error.message === 'Admin access required' ||
      error.message === 'Authentication required'
    ) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 403 }
      );
    }
    log.error('Admin users GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/users - Update user role or balance
export async function PATCH(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const admin = await requireAdmin();
    await connectDB();

    const { userId, role, balance } = await request.json();

    if (!userId || !isValidObjectId(userId)) {
      return NextResponse.json(
        { success: false, error: 'Valid user ID is required' },
        { status: 400 }
      );
    }

    // Prevent admin from changing their own role
    if (userId === admin.userId && role !== undefined) {
      return NextResponse.json(
        { success: false, error: 'Cannot change your own role' },
        { status: 400 }
      );
    }

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    if (role !== undefined) {
      if (!['user', 'admin'].includes(role)) {
        return NextResponse.json(
          { success: false, error: 'Invalid role' },
          { status: 400 }
        );
      }
      user.role = role;
      // Bump tokenVersion so old JWTs with stale role are invalidated
      user.tokenVersion = (user.tokenVersion || 0) + 1;
    }

    if (balance !== undefined) {
      if (typeof balance !== 'number' || balance < 0 || balance > 100000000 || !Number.isFinite(balance)) {
        return NextResponse.json(
          { success: false, error: 'Invalid balance' },
          { status: 400 }
        );
      }
      user.balance = balance;
    }

    await user.save();

    // Log role change
    try {
      if (role !== undefined) {
        // S10: Track privilege change for monitoring
        trackAdminPrivilegeChange(
          admin.userId,
          user._id.toString(),
          role === 'admin' ? 'promote' : 'demote',
          user.email
        );
        await logActivity({
          admin: admin.userId,
          action: role === 'admin' ? 'user_promoted' : 'user_demoted',
          target: `${user.name} (${user.email})`,
          details: `Role changed to ${role}`,
          metadata: { userId: user._id },
        });
      }
    } catch { /* ignore */ }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          balance: user.balance,
        },
      },
      message: 'User updated successfully',
    });
  } catch (error: any) {
    if (
      error.message === 'Admin access required' ||
      error.message === 'Authentication required'
    ) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 403 }
      );
    }
    log.error('Admin users PATCH error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users - Delete a user
export async function DELETE(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const admin = await requireAdmin();
    await connectDB();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId || !isValidObjectId(userId)) {
      return NextResponse.json(
        { success: false, error: 'Valid user ID is required' },
        { status: 400 }
      );
    }

    // Prevent admin from deleting themselves
    if (userId === admin.userId) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user has active orders
    const activeOrders = await Order.countDocuments({
      user: userId,
      status: { $in: ['pending', 'verifying'] },
    });

    if (activeOrders > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `User has ${activeOrders} active order(s). Resolve them first.`,
        },
        { status: 400 }
      );
    }

    await User.findByIdAndDelete(userId);

    // Log user deletion
    try {
      await logActivity({
        admin: admin.userId,
        action: 'user_deleted',
        target: `${user.name} (${user.email})`,
        metadata: { userId },
      });
    } catch { /* ignore */ }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error: any) {
    if (
      error.message === 'Admin access required' ||
      error.message === 'Authentication required'
    ) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 403 }
      );
    }
    log.error('Admin users DELETE error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
