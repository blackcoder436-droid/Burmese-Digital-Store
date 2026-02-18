import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Order from '@/models/Order';
import Notification from '@/models/Notification';
import { getAuthUser, COOKIE_NAME } from '@/lib/auth';
import { authLimiter } from '@/lib/rateLimit';
import bcrypt from 'bcryptjs';
import { createLogger } from '@/lib/logger';
import { deleteAccountSchema, parseBody } from '@/lib/validations';

const log = createLogger({ route: '/api/auth/delete-account' });

// DELETE /api/auth/delete-account - Delete user account (GDPR)
export async function DELETE(request: NextRequest) {
  try {
    // Rate limit
    const rateLimitResult = await authLimiter(request);
    if (rateLimitResult) return rateLimitResult;

    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    await connectDB();

    const user = await User.findById(authUser.userId).select('+password');
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Admins cannot delete their own account through this endpoint
    if (user.role === 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin accounts cannot be deleted through this endpoint' },
        { status: 403 }
      );
    }

    // Verify password for non-Google accounts
    const body = await request.json().catch(() => ({}));
    const parsed = parseBody(deleteAccountSchema, body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }
    const { password, confirmation } = parsed.data;

    // Check if user has a password (non-Google accounts need password verification)
    const isGoogleOnly = user.googleId && !user.password;
    if (!isGoogleOnly) {
      if (!password) {
        return NextResponse.json(
          { success: false, error: 'Password is required' },
          { status: 400 }
        );
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return NextResponse.json(
          { success: false, error: 'Incorrect password' },
          { status: 401 }
        );
      }
    }

    // Check for pending orders
    const pendingOrders = await Order.countDocuments({
      user: authUser.userId,
      status: { $in: ['pending', 'verifying'] },
    });

    if (pendingOrders > 0) {
      return NextResponse.json(
        { success: false, error: `You have ${pendingOrders} pending order(s). Please wait for them to be completed or cancelled before deleting your account.` },
        { status: 400 }
      );
    }

    // Anonymize order data instead of deleting (keep for business records)
    await Order.updateMany(
      { user: authUser.userId },
      {
        $set: {
          'metadata.accountDeleted': true,
          'metadata.deletedAt': new Date(),
        },
      }
    );

    // Delete notifications
    await Notification.deleteMany({ user: authUser.userId });

    // Delete user
    await User.findByIdAndDelete(authUser.userId);

    log.info('User account deleted', {
      userId: authUser.userId,
      email: user.email,
    });

    // Clear auth cookie
    const response = NextResponse.json({
      success: true,
      message: 'Account deleted successfully',
    });

    response.cookies.set(COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    });
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (error: unknown) {
    log.error('Delete account error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
