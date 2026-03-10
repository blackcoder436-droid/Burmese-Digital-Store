import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { sanitizeString } from '@/lib/security';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/admin/free-test-users' });

// GET /api/admin/free-test-users - List users who claimed free VPN test key
export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
    await connectDB();

    const { searchParams } = new URL(request.url);
    const search = sanitizeString(searchParams.get('search') || '');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {
      freeVpnTestUsedAt: { $ne: null },
    };

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const orConditions: Record<string, unknown>[] = [
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
        { telegramUsername: { $regex: escaped, $options: 'i' } },
      ];

      const tgId = Number(search);
      if (Number.isInteger(tgId) && String(tgId) === search.trim()) {
        orConditions.push({ telegramId: tgId });
      }

      query.$or = orConditions;
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('name email telegramId telegramUsername freeVpnTestUsedAt createdAt')
        .sort({ freeVpnTestUsedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        users,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }

    log.error('Admin free test users GET error', {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
