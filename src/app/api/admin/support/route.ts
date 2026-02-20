import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import SupportTicket from '@/models/SupportTicket';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';

// GET /api/admin/support - List all tickets (admin only)
export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const authUser = await getAuthUser();
    if (!authUser || authUser.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const priority = searchParams.get('priority');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    const query: Record<string, unknown> = {};
    if (status && ['open', 'in-progress', 'resolved', 'closed'].includes(status)) {
      query.status = status;
    }
    if (category && ['order', 'payment', 'vpn', 'account', 'other'].includes(category)) {
      query.category = category;
    }
    if (priority && ['low', 'medium', 'high'].includes(priority)) {
      query.priority = priority;
    }

    const [tickets, total, openCount, inProgressCount] = await Promise.all([
      SupportTicket.find(query)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('user', 'name email avatar')
        .populate('assignedTo', 'name')
        .select('-messages')
        .lean(),
      SupportTicket.countDocuments(query),
      SupportTicket.countDocuments({ status: 'open' }),
      SupportTicket.countDocuments({ status: 'in-progress' }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        tickets,
        stats: { open: openCount, inProgress: inProgressCount },
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch tickets' },
      { status: 500 }
    );
  }
}
