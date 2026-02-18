import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import User from '@/models/User';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/admin/analytics' });

// ==========================================
// Analytics API - Burmese Digital Store
// GET: Dashboard stats, daily breakdown, top products
// ==========================================

export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
    await connectDB();

    const { searchParams } = new URL(request.url);
    // Range: 7d, 30d, 90d, 365d, or a specific date (YYYY-MM-DD)
    const range = searchParams.get('range') || '30d';
    const specificDate = searchParams.get('date'); // YYYY-MM-DD for single day

    // Calculate date range
    let startDate: Date;
    let endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    if (specificDate) {
      // Single day view
      startDate = new Date(specificDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(specificDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      const days = parseInt(range) || 30;
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);
    }

    // Run all aggregations in parallel
    const [
      overviewStats,
      dailyRevenue,
      dailyOrders,
      dailyUsers,
      statusBreakdown,
      paymentMethodBreakdown,
      topProducts,
      recentOrders,
      categoryBreakdown,
    ] = await Promise.all([
      // 1. Overview stats
      getOverviewStats(startDate, endDate),
      // 2. Daily revenue
      getDailyRevenue(startDate, endDate),
      // 3. Daily order count
      getDailyOrders(startDate, endDate),
      // 4. Daily new users
      getDailyUsers(startDate, endDate),
      // 5. Order status breakdown
      getStatusBreakdown(startDate, endDate),
      // 6. Payment method breakdown
      getPaymentMethodBreakdown(startDate, endDate),
      // 7. Top selling products
      getTopProducts(startDate, endDate),
      // 8. Recent orders (last 10)
      getRecentOrders(),
      // 9. Category breakdown
      getCategoryBreakdown(startDate, endDate),
    ]);

    // All-time totals for comparison
    const allTimeTotals = await getAllTimeTotals();

    return NextResponse.json({
      success: true,
      data: {
        range,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        overview: overviewStats,
        allTime: allTimeTotals,
        dailyRevenue,
        dailyOrders,
        dailyUsers,
        statusBreakdown,
        paymentMethodBreakdown,
        topProducts,
        recentOrders,
        categoryBreakdown,
      },
    });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    log.error('Analytics GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ---- Helper functions ----

async function getOverviewStats(start: Date, end: Date) {
  const [orderStats, userCount, productCount] = await Promise.all([
    Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalAmount', 0] },
          },
          completedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          pendingOrders: {
            $sum: { $cond: [{ $in: ['$status', ['pending', 'verifying']] }, 1, 0] },
          },
          rejectedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] },
          },
          avgOrderValue: { $avg: '$totalAmount' },
        },
      },
    ]),
    User.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    Product.countDocuments({ active: true }),
  ]);

  const stats = orderStats[0] || {
    totalOrders: 0,
    totalRevenue: 0,
    completedOrders: 0,
    pendingOrders: 0,
    rejectedOrders: 0,
    avgOrderValue: 0,
  };

  return {
    ...stats,
    newUsers: userCount,
    activeProducts: productCount,
  };
}

async function getAllTimeTotals() {
  const [orderStats, userCount, productCount] = await Promise.all([
    Order.aggregate([
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalAmount', 0] },
          },
        },
      },
    ]),
    User.countDocuments(),
    Product.countDocuments({ active: true }),
  ]);

  return {
    totalOrders: orderStats[0]?.totalOrders || 0,
    totalRevenue: orderStats[0]?.totalRevenue || 0,
    totalUsers: userCount,
    activeProducts: productCount,
  };
}

async function getDailyRevenue(start: Date, end: Date) {
  const result = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        status: 'completed',
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
        },
        revenue: { $sum: '$totalAmount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Fill in missing days with 0
  return fillMissingDays(start, end, result, 'revenue');
}

async function getDailyOrders(start: Date, end: Date) {
  const result = await Order.aggregate([
    {
      $match: { createdAt: { $gte: start, $lte: end } },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
        },
        total: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
        },
        pending: {
          $sum: { $cond: [{ $in: ['$status', ['pending', 'verifying']] }, 1, 0] },
        },
        rejected: {
          $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return fillMissingDays(start, end, result, 'total');
}

async function getDailyUsers(start: Date, end: Date) {
  const result = await User.aggregate([
    {
      $match: { createdAt: { $gte: start, $lte: end } },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return fillMissingDays(start, end, result, 'count');
}

async function getStatusBreakdown(start: Date, end: Date) {
  return Order.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        revenue: { $sum: '$totalAmount' },
      },
    },
    { $sort: { count: -1 } },
  ]);
}

async function getPaymentMethodBreakdown(start: Date, end: Date) {
  return Order.aggregate([
    { $match: { createdAt: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: '$paymentMethod',
        count: { $sum: 1 },
        revenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalAmount', 0] } },
      },
    },
    { $sort: { count: -1 } },
  ]);
}

async function getTopProducts(start: Date, end: Date) {
  return Order.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        status: 'completed',
      },
    },
    {
      $group: {
        _id: '$product',
        totalSold: { $sum: '$quantity' },
        totalRevenue: { $sum: '$totalAmount' },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        totalSold: 1,
        totalRevenue: 1,
        orderCount: 1,
        name: { $ifNull: ['$product.name', 'Deleted Product'] },
        category: { $ifNull: ['$product.category', 'unknown'] },
        price: { $ifNull: ['$product.price', 0] },
      },
    },
  ]);
}

async function getCategoryBreakdown(start: Date, end: Date) {
  return Order.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        status: 'completed',
      },
    },
    {
      $lookup: {
        from: 'products',
        localField: 'product',
        foreignField: '_id',
        as: 'productInfo',
      },
    },
    { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { $ifNull: ['$productInfo.category', 'unknown'] },
        count: { $sum: '$quantity' },
        revenue: { $sum: '$totalAmount' },
      },
    },
    { $sort: { revenue: -1 } },
  ]);
}

async function getRecentOrders() {
  return Order.find()
    .populate('user', 'name email')
    .populate('product', 'name category price')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
}

/**
 * Fill missing days in aggregation results with zero values.
 */
function fillMissingDays(
  start: Date,
  end: Date,
  data: Array<{ _id: string; [key: string]: any }>,
  mainField: string
) {
  const dataMap = new Map<string, any>();
  data.forEach((d) => dataMap.set(d._id, d));

  const filled: Array<{ date: string; [key: string]: any }> = [];
  const current = new Date(start);

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const existing = dataMap.get(dateStr);

    if (existing) {
      const { _id, ...rest } = existing;
      filled.push({ date: dateStr, ...rest });
    } else {
      filled.push({ date: dateStr, [mainField]: 0 });
    }

    current.setDate(current.getDate() + 1);
  }

  return filled;
}
