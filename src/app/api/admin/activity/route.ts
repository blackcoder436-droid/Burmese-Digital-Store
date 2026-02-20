import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ActivityLog from '@/models/ActivityLog';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';

// GET /api/admin/activity — List admin activity logs
export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 100);
    const action = searchParams.get('action');
    const search = searchParams.get('search');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const exportCsv = searchParams.get('export') === 'csv';
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (action) query.action = action;
    if (search) {
      query.$or = [
        { target: { $regex: search, $options: 'i' } },
        { details: { $regex: search, $options: 'i' } },
        { action: { $regex: search, $options: 'i' } },
      ];
    }
    if (startDate || endDate) {
      query.createdAt = {} as Record<string, Date>;
      if (startDate) (query.createdAt as Record<string, Date>).$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        (query.createdAt as Record<string, Date>).$lte = end;
      }
    }

    // CSV export — return all matching records
    if (exportCsv) {
      const allLogs = await ActivityLog.find(query)
        .populate('admin', 'name email')
        .sort({ createdAt: -1 })
        .limit(5000)
        .lean();

      const csv = [
        'Date,Admin,Action,Target,Details',
        ...allLogs.map((log: any) =>
          [
            new Date(log.createdAt).toISOString(),
            `"${(log.admin?.name || 'Unknown').replace(/"/g, '""')}"`,
            log.action,
            `"${(log.target || '').replace(/"/g, '""')}"`,
            `"${(log.details || '').replace(/"/g, '""')}"`,
          ].join(',')
        ),
      ].join('\n');

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="activity-log-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    const [logs, total] = await Promise.all([
      ActivityLog.find(query)
        .populate('admin', 'name email avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ActivityLog.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        logs,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    console.error('Activity log GET error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
