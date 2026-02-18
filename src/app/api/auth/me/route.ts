import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthUser, COOKIE_NAME, generateToken } from '@/lib/auth';
import { sanitizeString } from '@/lib/security';
import { authLimiter } from '@/lib/rateLimit';
import bcrypt from 'bcryptjs';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/auth/me' });

// GET /api/auth/me - Get current user
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    await connectDB();
    const user = await User.findById(authUser.userId);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const expSec = typeof authUser.exp === 'number' ? authUser.exp : null;
    const iatSec = typeof authUser.iat === 'number' ? authUser.iat : null;
    const remainingSeconds = expSec !== null ? Math.max(0, expSec - nowSec) : null;

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone || null,
          role: user.role,
          balance: user.balance,
          avatar: user.avatar || null,
          createdAt: user.createdAt,
        },
        session: {
          issuedAt: iatSec !== null ? new Date(iatSec * 1000).toISOString() : null,
          expiresAt: expSec !== null ? new Date(expSec * 1000).toISOString() : null,
          remainingSeconds,
        },
      },
    });
  } catch (error: unknown) {
    log.error('Auth me error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/auth/me - Logout
export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully',
  });

  // Clear both cookie names for backward compatibility
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
}

// PUT /api/auth/me - Update profile (name, phone)
export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    await connectDB();
    const body = await request.json();
    const updateData: Record<string, string> = {};

    if (body.name !== undefined) {
      const name = sanitizeString(body.name);
      if (name.length < 2 || name.length > 50) {
        return NextResponse.json(
          { success: false, error: 'Name must be between 2 and 50 characters' },
          { status: 400 }
        );
      }
      updateData.name = name;
    }

    if (body.phone !== undefined) {
      const phone = body.phone ? sanitizeString(body.phone).replace(/[^0-9+\-\s()]/g, '') : '';
      if (phone && phone.length > 20) {
        return NextResponse.json(
          { success: false, error: 'Phone number is too long' },
          { status: 400 }
        );
      }
      updateData.phone = phone || '';
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const user = await User.findByIdAndUpdate(
      authUser.userId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone || null,
          role: user.role,
          balance: user.balance,
          avatar: user.avatar || null,
          createdAt: user.createdAt,
        },
      },
      message: 'Profile updated successfully',
    });
  } catch (error: unknown) {
    log.error('Profile update error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/auth/me - Change password
export async function PATCH(request: NextRequest) {
  // Strict rate limiting for password change (brute-force prevention)
  const limited = await authLimiter(request);
  if (limited) return limited;

  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    await connectDB();
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    // Type validation to prevent unexpected bcrypt behavior
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid input types' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6 || newPassword.length > 128) {
      return NextResponse.json(
        { success: false, error: 'New password must be 6-128 characters' },
        { status: 400 }
      );
    }

    const user = await User.findById(authUser.userId).select('+password');
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    const token = await generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion || 0,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Password changed successfully',
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error: unknown) {
    log.error('Password change error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
