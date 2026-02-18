import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import { isValidObjectId } from 'mongoose';
import { getVpnClientStats } from '@/lib/xui';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/vpn/status/[orderId]' });

// ==========================================
// GET /api/vpn/status/[orderId]
// Returns VPN provision status + traffic stats for authenticated user's order
// ==========================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { orderId } = await params;

    if (!orderId || !isValidObjectId(orderId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    await dbConnect();

    const order = await Order.findOne({
      _id: orderId,
      user: user.userId,
      orderType: 'vpn',
    }).select('vpnPlan vpnKey vpnProvisionStatus status createdAt');

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'VPN order not found' },
        { status: 404 }
      );
    }

    const result: Record<string, unknown> = {
      orderId: order._id,
      status: order.status,
      vpnProvisionStatus: order.vpnProvisionStatus || 'pending',
      vpnPlan: order.vpnPlan,
      createdAt: order.createdAt,
    };

    // If provisioned, include key details + live traffic stats
    if (order.vpnProvisionStatus === 'provisioned' && order.vpnKey) {
      result.vpnKey = {
        subLink: order.vpnKey.subLink,
        configLink: order.vpnKey.configLink,
        protocol: order.vpnKey.protocol,
        expiryTime: order.vpnKey.expiryTime,
        provisionedAt: order.vpnKey.provisionedAt,
      };

      // Fetch live traffic stats from 3xUI panel
      try {
        if (order.vpnPlan?.serverId && order.vpnKey.clientEmail) {
          const stats = await getVpnClientStats(
            order.vpnPlan.serverId,
            order.vpnKey.clientEmail
          );
          if (stats) {
            result.trafficStats = {
              up: stats.up,
              down: stats.down,
              total: stats.up + stats.down,
              enable: stats.enable,
            };
          }
        }
      } catch {
        // Stats fetch failed — return order data without stats
        result.trafficStats = null;
      }

      // Calculate remaining time
      if (order.vpnKey.expiryTime) {
        const now = Date.now();
        const remaining = order.vpnKey.expiryTime - now;
        result.remainingMs = Math.max(0, remaining);
        result.expired = remaining <= 0;
      }
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    log.error('VPN status error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch VPN status' },
      { status: 500 }
    );
  }
}
