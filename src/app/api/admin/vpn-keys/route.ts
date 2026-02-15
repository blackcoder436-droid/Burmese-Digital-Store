import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';

// ==========================================
// GET /api/admin/vpn-keys
// List all VPN keys across all servers (admin only)
// ==========================================

export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Admin access required' },
      { status: 403 }
    );
  }

  try {
    await dbConnect();

    const url = new URL(request.url);
    const status = url.searchParams.get('status') || ''; // provisioned, failed, revoked, all
    const serverId = url.searchParams.get('serverId') || '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));

    // Build query
    const query: Record<string, unknown> = {
      orderType: 'vpn',
    };

    if (status && status !== 'all') {
      query.vpnProvisionStatus = status;
    } else {
      // By default show all VPN orders that have provision status
      query.vpnProvisionStatus = { $exists: true };
    }

    if (serverId) {
      query['vpnPlan.serverId'] = serverId;
    }

    const [keys, total] = await Promise.all([
      Order.find(query)
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select(
          'user vpnPlan vpnKey vpnProvisionStatus status totalAmount createdAt'
        )
        .lean(),
      Order.countDocuments(query),
    ]);

    // Get summary counts
    const [provisionedCount, failedCount, revokedCount, pendingCount] =
      await Promise.all([
        Order.countDocuments({ orderType: 'vpn', vpnProvisionStatus: 'provisioned' }),
        Order.countDocuments({ orderType: 'vpn', vpnProvisionStatus: 'failed' }),
        Order.countDocuments({ orderType: 'vpn', vpnProvisionStatus: 'revoked' }),
        Order.countDocuments({ orderType: 'vpn', vpnProvisionStatus: 'pending' }),
      ]);

    return NextResponse.json({
      success: true,
      data: {
        keys,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        summary: {
          provisioned: provisionedCount,
          failed: failedCount,
          revoked: revokedCount,
          pending: pendingCount,
          total: provisionedCount + failedCount + revokedCount + pendingCount,
        },
      },
    });
  } catch (error) {
    console.error('Admin VPN keys error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch VPN keys' },
      { status: 500 }
    );
  }
}
