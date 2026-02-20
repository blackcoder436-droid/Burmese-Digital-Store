import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import PaymentGateway, { seedDefaultGateways } from '@/models/PaymentGateway';
import { apiLimiter } from '@/lib/rateLimit';

// GET /api/payment-gateways - Public: get all enabled payment gateways
export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await connectDB();

    // Seed defaults on first access
    await seedDefaultGateways();

    const gateways = await PaymentGateway.find({ enabled: true })
      .sort({ displayOrder: 1 })
      .select('name code type category accountName accountNumber qrImage instructions')
      .lean();

    return NextResponse.json({
      success: true,
      data: { gateways },
    });
  } catch (error) {
    console.error('Payment gateways public GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
