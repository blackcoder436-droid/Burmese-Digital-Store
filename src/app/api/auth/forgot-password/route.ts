import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { sendPasswordResetEmail } from '@/lib/email';
import { rateLimit } from '@/lib/rateLimit';
import { isValidEmail } from '@/lib/security';

// ==========================================
// Forgot Password API - Burmese Digital Store
// POST: Send password reset email
// ==========================================

// Strict rate limit — 3 requests per 15 minutes per IP
const forgotPasswordLimiter = rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 3 });

export async function POST(request: NextRequest) {
  // Rate limit
  const limitRes = await forgotPasswordLimiter(request);
  if (limitRes) return limitRes;

  try {
    const { email } = await request.json();

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { success: false, error: 'Please provide a valid email address' },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Always return success to prevent email enumeration
    const successResponse = NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });

    if (!user) {
      return successResponse;
    }

    // Generate a secure random token
    const rawToken = crypto.randomBytes(32).toString('hex');

    // Store hashed version in DB (so even if DB is compromised, token can't be used)
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // Send email with the RAW token (user clicks link with raw token)
    try {
      await sendPasswordResetEmail(user.email, rawToken);
    } catch (emailError) {
      // If email fails, clear the token so user can retry
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      console.error('Failed to send password reset email:', emailError);
      return NextResponse.json(
        { success: false, error: 'Failed to send email. Please try again later.' },
        { status: 500 }
      );
    }

    return successResponse;
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { success: false, error: 'Something went wrong' },
      { status: 500 }
    );
  }
}
