import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import StockAlert from '@/models/StockAlert';
import { createNotification } from '@/models/Notification';
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
    const { name, category, description, price, image, featured, active, purchaseDisabled, details, allowedPaymentGateways } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = sanitizeString(name);
    if (category !== undefined) updateData.category = sanitizeString(category);
    if (description !== undefined) updateData.description = sanitizeString(description);
    if (price !== undefined) updateData.price = Math.max(0, Number(price) || 0);
    if (image !== undefined) updateData.image = sanitizeString(String(image)).slice(0, 500);
    if (featured !== undefined) updateData.featured = featured;
    if (active !== undefined) updateData.active = active;
    if (purchaseDisabled !== undefined) updateData.purchaseDisabled = purchaseDisabled;
    if (allowedPaymentGateways !== undefined) updateData.allowedPaymentGateways = Array.isArray(allowedPaymentGateways) ? allowedPaymentGateways : [];
    if (details !== undefined) {
      updateData.details = details;
      updateData.stock = details.length;
    }

    const oldProduct = await Product.findById(id).select('stock name').lean() as any;

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

    // Notify stock alert subscribers if product was out of stock and now has stock
    if (oldProduct && oldProduct.stock <= 0 && product.stock > 0) {
      try {
        const alerts = await StockAlert.find({ product: id, notified: false }).lean();
        for (const alert of alerts) {
          await createNotification({
            user: (alert as any).user,
            type: 'stock_back_in',
            title: 'Back in Stock!',
            message: `${product.name} is now back in stock. Grab it before it sells out!`,
          });
        }
        await StockAlert.updateMany(
          { product: id, notified: false },
          { $set: { notified: true, notifiedAt: new Date() } }
        );
      } catch {
        // Stock alert notification is best-effort
      }
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
