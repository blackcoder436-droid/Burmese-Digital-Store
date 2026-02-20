import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import '@/models/PaymentGateway'; // Ensure PaymentGateway model is registered for populate
import { apiLimiter } from '@/lib/rateLimit';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/products/[id]' });

// GET /api/products/[id] - Get single product (id can be ObjectId or slug)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const { id } = await params;
    await connectDB();

    // Support both ObjectId and slug lookup
    const isObjectId = mongoose.Types.ObjectId.isValid(id) && id.length === 24;
    const query = isObjectId
      ? { _id: id, active: true }
      : { slug: id, active: true };

    const product = await Product.findOne(query)
      .select('-details.loginPassword -details.serialKey') // Hide sensitive info
      .populate('allowedPaymentGateways', 'name code type category accountName accountNumber qrImage instructions enabled')
      .lean();

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { product },
    });
  } catch (error: unknown) {
    log.error('Product GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
