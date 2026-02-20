import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import User from '@/models/User';
import CartSession from '@/models/CartSession';
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
      abandonedCart,
      repeatPurchase,
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
      // 10. Abandoned cart / recovery stats
      getAbandonedCartStats(startDate, endDate),
      // 11. Repeat purchase / retention stats
      getRepeatPurchaseStats(startDate, endDate),
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
        abandonedCart,
        repeatPurchase,
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

async function getAbandonedCartStats(start: Date, end: Date) {
  const abandonmentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    startedCarts,
    completedCarts,
    activeCarts,
    abandonedCarts,
    abandonedTrendRaw,
    recoveredTrendRaw,
  ] = await Promise.all([
    CartSession.countDocuments({
      checkoutStartedAt: { $gte: start, $lte: end },
    }),
    CartSession.countDocuments({
      checkoutCompletedAt: { $gte: start, $lte: end },
    }),
    CartSession.countDocuments({
      updatedAt: { $gte: start, $lte: end },
      itemCount: { $gt: 0 },
    }),
    CartSession.countDocuments({
      updatedAt: { $gte: start, $lte: end, $lte: abandonmentCutoff },
      itemCount: { $gt: 0 },
      checkoutCompletedAt: null,
    }),
    CartSession.aggregate([
      {
        $match: {
          updatedAt: { $gte: start, $lte: end, $lte: abandonmentCutoff },
          itemCount: { $gt: 0 },
          checkoutCompletedAt: null,
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' },
          },
          abandoned: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    CartSession.aggregate([
      {
        $match: {
          checkoutCompletedAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$checkoutCompletedAt' },
          },
          recovered: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const dayMap = new Map<string, { abandoned: number; recovered: number }>();

  for (const row of abandonedTrendRaw as Array<{ _id: string; abandoned: number }>) {
    dayMap.set(row._id, { abandoned: row.abandoned, recovered: 0 });
  }

  for (const row of recoveredTrendRaw as Array<{ _id: string; recovered: number }>) {
    const existing = dayMap.get(row._id) || { abandoned: 0, recovered: 0 };
    dayMap.set(row._id, { ...existing, recovered: row.recovered });
  }

  const dailyTrend = fillMissingDays(
    start,
    end,
    Array.from(dayMap.entries()).map(([date, values]) => ({ _id: date, ...values })),
    'abandoned'
  ).map((row) => ({
    date: row.date,
    abandoned: Number(row.abandoned || 0),
    recovered: Number(row.recovered || 0),
  }));

  const abandonmentRate = activeCarts > 0 ? (abandonedCarts / activeCarts) * 100 : 0;
  const recoveryRate = startedCarts > 0 ? (completedCarts / startedCarts) * 100 : 0;

  return {
    activeCarts,
    startedCarts,
    completedCarts,
    abandonedCarts,
    abandonmentRate,
    recoveryRate,
    dailyTrend,
  };
}

async function getRepeatPurchaseStats(start: Date, end: Date) {
  const currentUsersRaw = await Order.distinct('user', {
    status: 'completed',
    createdAt: { $gte: start, $lte: end },
  });
  const currentUsers = currentUsersRaw.map(String);

  const periodMs = Math.max(24 * 60 * 60 * 1000, end.getTime() - start.getTime() + 1);
  const previousStart = new Date(start.getTime() - periodMs);
  const previousEnd = new Date(start.getTime() - 1);

  const previousUsersRaw = await Order.distinct('user', {
    status: 'completed',
    createdAt: { $gte: previousStart, $lte: previousEnd },
  });
  const previousUsers = previousUsersRaw.map(String);

  let repeatCustomers = 0;
  if (currentUsers.length > 0) {
    const repeatResult = await Order.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $lte: end },
          user: { $in: currentUsersRaw },
        },
      },
      {
        $group: {
          _id: '$user',
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gte: 2 } } },
      { $count: 'total' },
    ]);

    repeatCustomers = Number(repeatResult[0]?.total || 0);
  }

  const previousSet = new Set(previousUsers);
  const retainedCustomers = currentUsers.filter((id) => previousSet.has(id)).length;

  const repeatRate = currentUsers.length > 0 ? (repeatCustomers / currentUsers.length) * 100 : 0;
  const retentionRate = previousUsers.length > 0 ? (retainedCustomers / previousUsers.length) * 100 : 0;

  const monthlyTrend = await getRepeatMonthlyTrend(end);

  return {
    uniqueCustomers: currentUsers.length,
    repeatCustomers,
    repeatRate,
    previousPeriodCustomers: previousUsers.length,
    retainedCustomers,
    retentionRate,
    monthlyTrend,
  };
}

async function getRepeatMonthlyTrend(endDate: Date) {
  const months: Array<{ label: string; monthStart: Date; monthEnd: Date }> = [];
  const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(endMonth.getFullYear(), endMonth.getMonth() - i, 1);
    const monthEnd = new Date(endMonth.getFullYear(), endMonth.getMonth() - i + 1, 0, 23, 59, 59, 999);
    months.push({
      label: monthStart.toLocaleDateString('en-US', { month: 'short' }),
      monthStart,
      monthEnd,
    });
  }

  return Promise.all(
    months.map(async ({ label, monthStart, monthEnd }) => {
      const usersRaw = await Order.distinct('user', {
        status: 'completed',
        createdAt: { $gte: monthStart, $lte: monthEnd },
      });

      if (usersRaw.length === 0) {
        return { month: label, customers: 0, repeatRate: 0 };
      }

      const repeatResult = await Order.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $lte: monthEnd },
            user: { $in: usersRaw },
          },
        },
        {
          $group: {
            _id: '$user',
            count: { $sum: 1 },
          },
        },
        { $match: { count: { $gte: 2 } } },
        { $count: 'total' },
      ]);

      const repeatCustomers = Number(repeatResult[0]?.total || 0);
      return {
        month: label,
        customers: usersRaw.length,
        repeatRate: usersRaw.length > 0 ? (repeatCustomers / usersRaw.length) * 100 : 0,
      };
    })
  );
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
