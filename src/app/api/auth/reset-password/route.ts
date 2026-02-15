import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { hashPassword } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';

// ==========================================
// Reset Password API - Burmese Digital Store
// POST: Verify token and set new password
// ==========================================

// Strict rate limit — 5 requests per 15 minutes per IP
const resetPasswordLimiter = rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 5 });

export async function POST(request: NextRequest) {
  // Rate limit
  const limitRes = await resetPasswordLimiter(request);
  if (limitRes) return limitRes;

  try {
    const { token, password } = await request.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Reset token is required' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'New password is required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    if (password.length > 128) {
      return NextResponse.json(
        { success: false, error: 'Password is too long' },
        { status: 400 }
      );
    }

    // Hash the incoming raw token to compare with stored hashed token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    await connectDB();

    // Find user with matching token that hasn't expired
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    }).select('+resetPasswordToken +resetPasswordExpires +password');

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Update password & clear reset token
    user.password = await hashPassword(password);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { success: false, error: 'Something went wrong' },
      { status: 500 }
    );
  }
}
