import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { logActivity } from '@/models/ActivityLog';
import { sanitizeString, isValidObjectId } from '@/lib/security';

// PUT /api/admin/products/[id] - Update product
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
        { success: false, error: 'Invalid product ID' },
        { status: 400 }
      );
    }

    const admin = await requireAdmin();
    await connectDB();

    const body = await request.json();
    const { name, category, description, price, image, featured, active, details } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = sanitizeString(name);
    if (category !== undefined) updateData.category = sanitizeString(category);
    if (description !== undefined) updateData.description = sanitizeString(description);
    if (price !== undefined) updateData.price = Math.max(0, Number(price) || 0);
    if (image !== undefined) updateData.image = sanitizeString(String(image)).slice(0, 500);
    if (featured !== undefined) updateData.featured = featured;
    if (active !== undefined) updateData.active = active;
    if (details !== undefined) {
      updateData.details = details;
      updateData.stock = details.length;
    }

    const product = await Product.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    try {
      await logActivity({
        admin: admin.userId,
        action: 'product_updated',
        target: `${product.name} (${product.category})`,
        metadata: { productId: product._id },
      });
    } catch { /* ignore */ }

    return NextResponse.json({
      success: true,
      data: { product },
      message: 'Product updated successfully',
    });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    console.error('Admin product PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/products/[id] - Delete product
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
        { success: false, error: 'Invalid product ID' },
        { status: 400 }
      );
    }

    const admin = await requireAdmin();
    await connectDB();

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    try {
      await logActivity({
        admin: admin.userId,
        action: 'product_deleted',
        target: `${product.name} (${product.category})`,
        metadata: { productId: id },
      });
    } catch { /* ignore */ }

    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    console.error('Admin product DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
