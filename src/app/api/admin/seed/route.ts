import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { hashPassword } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';
import { isValidEmail } from '@/lib/security';
import { timingSafeEqual } from 'crypto';

const seedLimiter = rateLimit({ windowMs: 900000, maxRequests: 3, prefix: 'seed' });

// POST /api/admin/seed - Create or promote admin user
// Secured by ADMIN_SECRET env variable
export async function POST(request: NextRequest) {
  const limited = await seedLimiter(request);
  if (limited) return limited;

  try {
    const { secret, email, password, name } = await request.json();

    const ADMIN_SECRET = process.env.ADMIN_SECRET;

    if (!ADMIN_SECRET) {
      return NextResponse.json(
        { success: false, error: 'Admin seeding is not configured' },
        { status: 500 }
      );
    }

    // Timing-safe comparison to prevent timing attacks
    if (
      !secret ||
      typeof secret !== 'string' ||
      secret.length !== ADMIN_SECRET.length ||
      !timingSafeEqual(Buffer.from(secret), Buffer.from(ADMIN_SECRET))
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid admin secret' },
        { status: 403 }
      );
    }

    if (!email || typeof email !== 'string' || !isValidEmail(email)) {
      return NextResponse.json(
        { success: false, error: 'Valid email is required' },
        { status: 400 }
      );
    }

    await connectDB();

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      // Promote existing user to admin
      existingUser.role = 'admin';
      await existingUser.save();
      return NextResponse.json({
        success: true,
        message: `User ${email} promoted to admin`,
      });
    }

    // Create new admin user
    if (!password || !name) {
      return NextResponse.json(
        { success: false, error: 'Name and password are required for new admin user' },
        { status: 400 }
      );
    }

    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      return NextResponse.json(
        { success: false, error: 'Password must be 6-128 characters' },
        { status: 400 }
      );
    }

    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 50) {
      return NextResponse.json(
        { success: false, error: 'Name must be 2-50 characters' },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(password);
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'admin',
    });

    return NextResponse.json({
      success: true,
      message: `Admin user ${email} created successfully`,
      data: { id: user._id, email: user.email, role: user.role },
    });
  } catch (error: unknown) {
    console.error('Admin seed error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to seed admin' },
      { status: 500 }
    );
  }
}
