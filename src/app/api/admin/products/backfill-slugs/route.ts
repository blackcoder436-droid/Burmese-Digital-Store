import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import { requireAdmin } from '@/lib/auth';

// POST /api/admin/products/backfill-slugs
// One-time endpoint to generate slugs for existing products
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    await connectDB();

    // Find products without slugs
    const products = await Product.find({ $or: [{ slug: null }, { slug: '' }, { slug: { $exists: false } }] });

    let updated = 0;
    for (const product of products) {
      // Trigger the pre-save hook which auto-generates slug
      await product.save();
      updated++;
    }

    return NextResponse.json({
      success: true,
      message: `Backfilled slugs for ${updated} products`,
      data: { updated },
    });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
