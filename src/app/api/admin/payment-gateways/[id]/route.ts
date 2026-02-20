import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import PaymentGateway from '@/models/PaymentGateway';
import Product from '@/models/Product';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { logActivity } from '@/models/ActivityLog';
import { sanitizeString, isValidObjectId } from '@/lib/security';

// PUT /api/admin/payment-gateways/[id] - Update payment gateway
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid gateway ID' },
        { status: 400 }
      );
    }

    const admin = await requireAdmin();
    await connectDB();

    const body = await request.json();
    const { name, type, category, accountName, accountNumber, qrImage, instructions, enabled, displayOrder } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = sanitizeString(name).slice(0, 100);
    if (type !== undefined) updateData.type = type === 'online' ? 'online' : 'manual';
    if (category !== undefined) updateData.category = category === 'crypto' ? 'crypto' : 'myanmar';
    if (accountName !== undefined) updateData.accountName = sanitizeString(accountName).slice(0, 200);
    if (accountNumber !== undefined) updateData.accountNumber = sanitizeString(accountNumber).slice(0, 100);
    if (qrImage !== undefined) updateData.qrImage = qrImage ? sanitizeString(String(qrImage)).slice(0, 500) : null;
    if (instructions !== undefined) updateData.instructions = sanitizeString(instructions).slice(0, 500);
    if (enabled !== undefined) updateData.enabled = Boolean(enabled);
    if (displayOrder !== undefined) updateData.displayOrder = Number(displayOrder) || 0;

    const gateway = await PaymentGateway.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!gateway) {
      return NextResponse.json(
        { success: false, error: 'Payment gateway not found' },
        { status: 404 }
      );
    }

    try {
      await logActivity({
        admin: admin.userId,
        action: 'settings_updated',
        target: `Payment Gateway updated: ${gateway.name} (${gateway.code})`,
      });
    } catch { /* ignore */ }

    return NextResponse.json({
      success: true,
      data: { gateway },
      message: 'Payment gateway updated',
    });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    console.error('Payment gateway PUT error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/admin/payment-gateways/[id] - Delete payment gateway
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid gateway ID' },
        { status: 400 }
      );
    }

    const admin = await requireAdmin();
    await connectDB();

    const gateway = await PaymentGateway.findById(id);
    if (!gateway) {
      return NextResponse.json(
        { success: false, error: 'Payment gateway not found' },
        { status: 404 }
      );
    }

    // Remove reference from all products that use this gateway
    await Product.updateMany(
      { allowedPaymentGateways: id },
      { $pull: { allowedPaymentGateways: id } }
    );

    await PaymentGateway.findByIdAndDelete(id);

    try {
      await logActivity({
        admin: admin.userId,
        action: 'settings_updated',
        target: `Payment Gateway deleted: ${gateway.name} (${gateway.code})`,
      });
    } catch { /* ignore */ }

    return NextResponse.json({
      success: true,
      message: 'Payment gateway deleted',
    });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    console.error('Payment gateway DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
