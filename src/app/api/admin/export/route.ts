import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import User from '@/models/User';
import Product from '@/models/Product';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';

// GET /api/admin/export?type=orders|users|products
export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
    await connectDB();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'orders';

    // CSV injection prevention: prefix cells starting with dangerous characters
    const safeCsvCell = (val: string): string => {
      if (!val) return val;
      const firstChar = val.charAt(0);
      if (['+', '-', '=', '@', '\t', '\r'].includes(firstChar)) {
        return `'${val}`;
      }
      return val;
    };

    let csv = '';
    const now = new Date().toISOString().split('T')[0];

    if (type === 'orders') {
      const orders = await Order.find()
        .populate('user', 'name email')
        .populate('product', 'name category price')
        .sort({ createdAt: -1 })
        .lean();

      csv = 'ID,User,Email,Product,Category,Quantity,Amount (MMK),Payment,Status,OCR Verified,Date\n';
      for (const o of orders as any[]) {
        csv += [
          o._id,
          `"${safeCsvCell((o.user?.name || 'Deleted').replace(/"/g, '""'))}"`,
          safeCsvCell(o.user?.email || ''),
          `"${safeCsvCell((o.product?.name || 'Deleted').replace(/"/g, '""'))}"`,
          o.product?.category || '',
          o.quantity,
          o.totalAmount,
          o.paymentMethod,
          o.status,
          o.ocrVerified ? 'Yes' : 'No',
          new Date(o.createdAt).toISOString(),
        ].join(',') + '\n';
      }

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="orders_${now}.csv"`,
        },
      });
    }

    if (type === 'users') {
      const users = await User.find()
        .select('name email role balance createdAt')
        .sort({ createdAt: -1 })
        .lean();

      csv = 'ID,Name,Email,Role,Balance (MMK),Joined\n';
      for (const u of users as any[]) {
        csv += [
          u._id,
          `"${safeCsvCell((u.name || '').replace(/"/g, '""'))}"`,
          safeCsvCell(u.email),
          u.role,
          u.balance || 0,
          new Date(u.createdAt).toISOString(),
        ].join(',') + '\n';
      }

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="users_${now}.csv"`,
        },
      });
    }

    if (type === 'products') {
      const products = await Product.find()
        .sort({ createdAt: -1 })
        .lean();

      csv = 'ID,Name,Category,Price (MMK),Stock,Total Keys,Status,Created\n';
      for (const p of products as any[]) {
        csv += [
          p._id,
          `"${safeCsvCell((p.name || '').replace(/"/g, '""'))}"`,
          p.category,
          p.price,
          p.stock,
          p.details?.length || 0,
          p.isActive !== false ? 'Active' : 'Inactive',
          new Date(p.createdAt).toISOString(),
        ].join(',') + '\n';
      }

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="products_${now}.csv"`,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid export type. Use: orders, users, or products' },
      { status: 400 }
    );
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    console.error('Export error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
