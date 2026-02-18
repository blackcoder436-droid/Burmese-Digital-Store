import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { hashPassword, generateToken, COOKIE_NAME } from '@/lib/auth';
import { registerLimiter } from '@/lib/rateLimit';
import { sanitizeString, isValidEmail } from '@/lib/security';
import { createLogger } from '@/lib/logger';
import { registerSchema, parseBody } from '@/lib/validations';
import { sendVerificationEmail } from '@/lib/email';

const log = createLogger({ route: '/api/auth/register' });

// POST /api/auth/register
export async function POST(request: NextRequest) {
  // Rate limiting — 1 registration per 3 minutes per IP
  const limited = await registerLimiter(request);
  if (limited) return limited;

  try {
    await connectDB();

    const body = await request.json();
    const parsed = parseBody(registerSchema, body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    // Check if user already exists (use generic message to prevent email enumeration)
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Registration failed. Please try a different email.' },
        { status: 409 }
      );
    }

    // Hash password and create user with email verification token
    const hashedPassword = await hashPassword(password);
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      emailVerified: false,
      emailVerificationToken: hashedToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    // Send verification email (non-blocking so registration isn't delayed)
    sendVerificationEmail(user.email, rawToken).catch((err) => {
      log.error('Failed to send verification email', { email: user.email, error: String(err) });
    });

    // Generate JWT token
    const token = await generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    // Set cookie
    const response = NextResponse.json(
      {
        success: true,
        data: {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            emailVerified: false,
          },
        },
        message: 'Registration successful. Please check your email to verify your account.',
      },
      { status: 201 }
    );

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;
  } catch (error: unknown) {
    log.error('Register error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
