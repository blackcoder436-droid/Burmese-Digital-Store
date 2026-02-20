import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import PaymentGateway, { seedDefaultGateways } from '@/models/PaymentGateway';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { logActivity } from '@/models/ActivityLog';
import { sanitizeString } from '@/lib/security';

// GET /api/admin/payment-gateways - List all payment gateways
export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
    await connectDB();

    // Seed defaults on first access
    await seedDefaultGateways();

    const gateways = await PaymentGateway.find()
      .sort({ displayOrder: 1, createdAt: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: { gateways },
    });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    console.error('Payment gateways GET error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/payment-gateways - Create new payment gateway
export async function POST(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const admin = await requireAdmin();
    await connectDB();

    const body = await request.json();
    const { name, code, type, category, accountName, accountNumber, qrImage, instructions, enabled, displayOrder } = body;

    if (!name || !code) {
      return NextResponse.json(
        { success: false, error: 'Name and code are required' },
        { status: 400 }
      );
    }

    // Sanitize
    const safeName = sanitizeString(name).slice(0, 100);
    const safeCode = sanitizeString(code).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 50);

    if (!safeCode) {
      return NextResponse.json(
        { success: false, error: 'Invalid code format. Use lowercase letters, numbers, hyphens, underscores.' },
        { status: 400 }
      );
    }

    // Check duplicate code
    const existing = await PaymentGateway.findOne({ code: safeCode });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Gateway with code "${safeCode}" already exists` },
        { status: 409 }
      );
    }

    const gateway = await PaymentGateway.create({
      name: safeName,
      code: safeCode,
      type: type === 'online' ? 'online' : 'manual',
      category: category === 'crypto' ? 'crypto' : 'myanmar',
      accountName: accountName ? sanitizeString(accountName).slice(0, 200) : '',
      accountNumber: accountNumber ? sanitizeString(accountNumber).slice(0, 100) : '',
      qrImage: qrImage ? sanitizeString(String(qrImage)).slice(0, 500) : null,
      instructions: instructions ? sanitizeString(instructions).slice(0, 500) : '',
      enabled: enabled !== false,
      displayOrder: Number(displayOrder) || 0,
    });

    try {
      await logActivity({
        admin: admin.userId,
        action: 'settings_updated',
        target: `Payment Gateway created: ${safeName} (${safeCode})`,
      });
    } catch { /* ignore */ }

    return NextResponse.json(
      { success: true, data: { gateway }, message: 'Payment gateway created' },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    console.error('Payment gateway POST error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
