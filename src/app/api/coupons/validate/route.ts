import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { getAuthUser } from '@/lib/auth';
import { validateCoupon } from '@/models/Coupon';
import { apiLimiter } from '@/lib/rateLimit';
import { sanitizeString } from '@/lib/security';

// POST /api/coupons/validate - Validate a coupon code
export async function POST(request: NextRequest) {
  const limited = await apiLimiter(request);
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
    const { code, amount, category } = body;

    if (!code || !amount) {
      return NextResponse.json(
        { success: false, error: 'Coupon code and order amount are required' },
        { status: 400 }
      );
    }

    const safeCode = sanitizeString(String(code));

    const { coupon, discountAmount } = await validateCoupon(
      safeCode,
      authUser.userId,
      Number(amount),
      category
    );

    return NextResponse.json({
      success: true,
      data: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount,
        finalAmount: Math.max(0, Number(amount) - discountAmount),
      },
    });
  } catch (error: any) {
    // Only expose known validation errors, not internal details
    // Only expose known validation error prefixes, not internal details
    const safePatterns = [
      'Invalid coupon',
      'not yet active',
      'expired',
      'usage limit',
      'already used',
      'Minimum order amount',
      'does not apply',
    ];
    const isSafe = safePatterns.some(p => error.message?.includes(p));
    const message = isSafe ? error.message : 'Invalid coupon';
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
