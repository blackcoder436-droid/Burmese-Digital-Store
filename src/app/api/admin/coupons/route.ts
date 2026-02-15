import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Coupon from '@/models/Coupon';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { logActivity } from '@/models/ActivityLog';
import { sanitizeString, isValidObjectId } from '@/lib/security';

// GET /api/admin/coupons - List all coupons
export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
    await connectDB();

    const coupons = await Coupon.find()
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: { coupons },
    });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    console.error('Admin coupons GET error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/coupons - Create coupon
export async function POST(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const admin = await requireAdmin();
    await connectDB();

    const body = await request.json();
    const {
      code, discountType, discountValue, minOrderAmount,
      maxDiscountAmount, usageLimit, perUserLimit,
      validFrom, validUntil, categories, active,
    } = body;

    if (!code || !discountType || discountValue === undefined || !validFrom || !validUntil) {
      return NextResponse.json(
        { success: false, error: 'Code, discount type, discount value, and validity dates are required' },
        { status: 400 }
      );
    }

    const safeCode = sanitizeString(code).toUpperCase().replace(/\s+/g, '');
    if (safeCode.length < 3 || safeCode.length > 30) {
      return NextResponse.json(
        { success: false, error: 'Coupon code must be 3-30 characters' },
        { status: 400 }
      );
    }

    // Check for duplicate code
    const existing = await Coupon.findOne({ code: safeCode });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A coupon with this code already exists' },
        { status: 400 }
      );
    }

    if (!['percentage', 'fixed'].includes(discountType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid discount type' },
        { status: 400 }
      );
    }

    if (discountType === 'percentage' && (discountValue < 0 || discountValue > 100)) {
      return NextResponse.json(
        { success: false, error: 'Percentage discount must be between 0 and 100' },
        { status: 400 }
      );
    }

    const coupon = await Coupon.create({
      code: safeCode,
      discountType,
      discountValue: Math.max(0, Number(discountValue) || 0),
      minOrderAmount: Math.max(0, Number(minOrderAmount) || 0),
      maxDiscountAmount: maxDiscountAmount ? Math.max(0, Number(maxDiscountAmount)) : null,
      usageLimit: Math.max(0, Number(usageLimit) || 0),
      perUserLimit: Math.max(0, Number(perUserLimit) ?? 1),
      validFrom: new Date(validFrom),
      validUntil: new Date(validUntil),
      categories: Array.isArray(categories) ? categories : [],
      active: active !== false,
    });

    try {
      await logActivity({
        admin: admin.userId,
        action: 'coupon_created',
        target: safeCode,
        details: `${discountType === 'percentage' ? discountValue + '%' : discountValue + ' MMK'} discount`,
        metadata: { couponId: coupon._id },
      });
    } catch { /* ignore */ }

    return NextResponse.json(
      { success: true, data: { coupon }, message: 'Coupon created successfully' },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    console.error('Admin coupon POST error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/coupons - Delete coupon (pass id in body)
export async function DELETE(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const admin = await requireAdmin();
    await connectDB();

    const body = await request.json();
    const { id } = body;

    if (!id || !isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, error: 'Valid coupon ID is required' },
        { status: 400 }
      );
    }

    const coupon = await Coupon.findByIdAndDelete(id);
    if (!coupon) {
      return NextResponse.json(
        { success: false, error: 'Coupon not found' },
        { status: 404 }
      );
    }

    try {
      await logActivity({
        admin: admin.userId,
        action: 'coupon_deleted',
        target: coupon.code,
        metadata: { couponId: id },
      });
    } catch { /* ignore */ }

    return NextResponse.json({
      success: true,
      message: 'Coupon deleted successfully',
    });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    console.error('Admin coupon DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/admin/coupons - Toggle active status
export async function PATCH(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const admin = await requireAdmin();
    await connectDB();

    const body = await request.json();
    const { id, active } = body;

    if (!id || !isValidObjectId(id) || typeof active !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Coupon ID and active status are required' },
        { status: 400 }
      );
    }

    const coupon = await Coupon.findByIdAndUpdate(
      id,
      { $set: { active } },
      { new: true }
    );

    if (!coupon) {
      return NextResponse.json(
        { success: false, error: 'Coupon not found' },
        { status: 404 }
      );
    }

    try {
      await logActivity({
        admin: admin.userId,
        action: active ? 'coupon_activated' : 'coupon_deactivated',
        target: coupon.code,
        metadata: { couponId: id },
      });
    } catch { /* ignore */ }

    return NextResponse.json({
      success: true,
      data: { coupon },
      message: `Coupon ${active ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    console.error('Admin coupon PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
