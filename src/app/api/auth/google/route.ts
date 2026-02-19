import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { generateToken, COOKIE_NAME } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { createLogger } from '@/lib/logger';
import { randomUUID } from 'crypto';
import { googleAuthSchema, parseBody } from '@/lib/validations';

const log = createLogger({ route: '/api/auth/google' });

// POST /api/auth/google — Google OAuth callback (verify Google ID token & login/register)
export async function POST(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const body = await request.json();
    const parsed = parseBody(googleAuthSchema, body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400 }
      );
    }

    const { credential } = parsed.data;

    // Verify Google ID token
    const googlePayload = await verifyGoogleToken(credential);
    if (!googlePayload) {
      return NextResponse.json(
        { success: false, error: 'Invalid Google token' },
        { status: 401 }
      );
    }

    const { email, name, picture, email_verified } = googlePayload;

    if (!email || !email_verified) {
      return NextResponse.json(
        { success: false, error: 'Google account email not verified' },
        { status: 400 }
      );
    }

    await connectDB();

    // Find or create user
    let user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      // Existing user — update avatar and link Google ID if needed
      if (!user.avatar && picture) user.avatar = picture;
      if (!user.googleId) user.googleId = googlePayload.sub;
      if (!user.emailVerified) user.emailVerified = true; // Google already verified email
      if (user.isModified()) await user.save();
    } else {
      // New user — create account with random password (won't be used for Google login)
      const bcrypt = await import('bcryptjs');
      const randomPassword = await bcrypt.hash(randomUUID(), 12);

      user = await User.create({
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
        password: randomPassword,
        googleId: googlePayload.sub,
        avatar: picture || null,
        emailVerified: true, // Google already verified email
      });

      log.info('New user via Google OAuth', { userId: user._id, email });
    }

    // Generate JWT
    const token = await generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion || 0,
    });

    // Set cookie
    const isProd = process.env.NODE_ENV === 'production';
    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar || null,
        },
      },
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'strict' : 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error: unknown) {
    log.error('Google auth error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

/**
 * Verify Google ID token by calling Google's tokeninfo endpoint
 */
async function verifyGoogleToken(credential: string): Promise<{
  email: string;
  name: string;
  picture: string;
  email_verified: boolean;
  sub: string;
} | null> {
  try {
    // Decode JWT payload (Google ID tokens are JWTs)
    const parts = credential.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

    // Verify with Google's tokeninfo endpoint
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    if (!res.ok) return null;

    const data = await res.json();

    // Verify audience (client ID)
    const configuredIds = getAllowedGoogleClientIds();
    if (configuredIds.length > 0 && !configuredIds.includes(String(data.aud || ''))) {
      log.warn('Google token audience mismatch', { expected: configuredIds, got: data.aud });
      return null;
    }

    // Verify issuer
    if (!['accounts.google.com', 'https://accounts.google.com'].includes(data.iss)) {
      return null;
    }

    // Verify expiry
    if (data.exp && Number(data.exp) * 1000 < Date.now()) {
      return null;
    }

    return {
      email: data.email,
      name: data.name || payload.name,
      picture: data.picture || payload.picture || '',
      email_verified: data.email_verified === 'true' || data.email_verified === true,
      sub: data.sub,
    };
  } catch (error) {
    log.error('Google token verification failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function getAllowedGoogleClientIds(): string[] {
  const rawValues = [
    process.env.GOOGLE_CLIENT_ID || '',
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
  ];

  return [...new Set(
    rawValues
      .flatMap((v) => v.split(','))
      .map((v) => v.trim())
      .filter(Boolean)
  )];
}
