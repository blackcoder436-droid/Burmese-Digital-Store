import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/auth/verify-email' });

// ==========================================
// Email Verification API - Burmese Digital Store
// GET: Verify email via token (from email link)
// POST: Resend verification email
// ==========================================

// GET /api/auth/verify-email?token=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawToken = searchParams.get('token');

    if (!rawToken) {
      return redirectWithMessage('error', 'Invalid verification link.');
    }

    await connectDB();

    // Hash the token to match what's stored in DB
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: new Date() },
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      return redirectWithMessage('error', 'Verification link is invalid or has expired.');
    }

    // Mark as verified and clear verification fields
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    log.info('Email verified', { userId: user._id, email: user.email });

    return redirectWithMessage('success', 'Email verified successfully! You can now place orders.');
  } catch (error: unknown) {
    log.error('Email verification error', { error: error instanceof Error ? error.message : String(error) });
    return redirectWithMessage('error', 'Verification failed. Please try again.');
  }
}

// POST /api/auth/verify-email — Resend verification email
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await User.findOne({ email: email.toLowerCase() });

    // Always return success to prevent email enumeration
    const successResponse = NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a verification link has been sent.',
    });

    if (!user || user.emailVerified) {
      return successResponse;
    }

    // Generate new verification token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await user.save();

    // Send verification email (non-blocking)
    const { sendVerificationEmail } = await import('@/lib/email');
    sendVerificationEmail(user.email, rawToken).catch((err) => {
      log.error('Failed to resend verification email', { email: user.email, error: String(err) });
    });

    return successResponse;
  } catch (error: unknown) {
    log.error('Resend verification error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/** Redirect to login page with a flash message via query param */
function redirectWithMessage(type: 'success' | 'error', message: string): NextResponse {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const url = new URL('/login', baseUrl);
  url.searchParams.set('verified', type);
  url.searchParams.set('message', message);
  return NextResponse.redirect(url);
}
