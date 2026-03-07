import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import { updateVpnClient, listServerClients } from '@/lib/xui';
import { getAllServers } from '@/lib/vpn-servers';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/admin/vpn-keys/update' });

// ==========================================
// PATCH /api/admin/vpn-keys/update
// Admin can update VPN key settings on 3x-UI panel
// Supports two modes:
//   1. orderId — update key linked to an order (customer keys)
//   2. serverId + clientEmail — update any key directly on 3x-UI (admin-created keys)
// ==========================================

export async function PATCH(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Admin access required' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { orderId, serverId: directServerId, clientEmail: directClientEmail, expiryTime, devices, dataLimitGB, enable } = body;

    // Must provide either orderId OR serverId+clientEmail
    if (!orderId && (!directServerId || !directClientEmail)) {
      return NextResponse.json(
        { success: false, error: 'Provide orderId or serverId + clientEmail' },
        { status: 400 }
      );
    }

    // Validate expiryTime is a reasonable timestamp (not in the past by more than 1 day)
    if (expiryTime !== undefined) {
      if (typeof expiryTime !== 'number' || expiryTime < Date.now() - 86400000) {
        return NextResponse.json(
          { success: false, error: 'Invalid expiryTime' },
          { status: 400 }
        );
      }
    }

    if (devices !== undefined && (typeof devices !== 'number' || devices < 1 || devices > 10)) {
      return NextResponse.json(
        { success: false, error: 'devices must be between 1 and 10' },
        { status: 400 }
      );
    }

    if (dataLimitGB !== undefined && (typeof dataLimitGB !== 'number' || dataLimitGB < 0)) {
      return NextResponse.json(
        { success: false, error: 'dataLimitGB must be >= 0' },
        { status: 400 }
      );
    }

    let resolvedServerId: string;
    let resolvedClientEmail: string;
    let order: InstanceType<typeof Order> | null = null;

    if (orderId) {
      // Mode 1: Resolve serverId + clientEmail from order
      await dbConnect();
      order = await Order.findById(orderId);
      if (!order || order.orderType !== 'vpn' || !order.vpnKey?.clientEmail) {
        return NextResponse.json(
          { success: false, error: 'VPN order not found or not provisioned' },
          { status: 404 }
        );
      }
      const sid = order.vpnPlan?.serverId;
      if (!sid) {
        return NextResponse.json(
          { success: false, error: 'Server ID not found on order' },
          { status: 400 }
        );
      }
      resolvedServerId = sid;
      resolvedClientEmail = order.vpnKey.clientEmail;
    } else {
      // Mode 2: Direct serverId + clientEmail
      resolvedServerId = directServerId;
      resolvedClientEmail = directClientEmail;
    }

    // Build update payload
    const updates: {
      expiryTime?: number;
      devices?: number;
      dataLimitGB?: number;
      enable?: boolean;
    } = {};

    if (expiryTime !== undefined) updates.expiryTime = expiryTime;
    if (devices !== undefined) updates.devices = devices;
    if (dataLimitGB !== undefined) updates.dataLimitGB = dataLimitGB;
    if (enable !== undefined) updates.enable = !!enable;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No updates provided' },
        { status: 400 }
      );
    }

    // Update on 3x-UI panel
    const success = await updateVpnClient(resolvedServerId, resolvedClientEmail, updates);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to update client on 3x-UI panel. Check server connectivity.' },
        { status: 500 }
      );
    }

    // Sync changes to local DB if order exists
    if (order && order.vpnKey) {
      if (updates.expiryTime !== undefined) {
        order.vpnKey.expiryTime = updates.expiryTime;
      }
      await order.save();
    }

    log.info('Admin updated VPN key', {
      orderId: orderId || null,
      clientEmail: resolvedClientEmail,
      serverId: resolvedServerId,
      updates,
      adminId: admin.userId,
    });

    return NextResponse.json({
      success: true,
      data: {
        orderId: orderId || null,
        clientEmail: resolvedClientEmail,
        serverId: resolvedServerId,
        updates,
      },
    });
  } catch (error) {
    log.error('Admin update VPN key error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Failed to update VPN key' },
      { status: 500 }
    );
  }
}

// ==========================================
// GET /api/admin/vpn-keys/update?serverId=xxx
// List all clients on a specific 3x-UI server
// (for browsing admin-created keys that have no Order)
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
    const url = new URL(request.url);
    const serverId = url.searchParams.get('serverId');

    if (!serverId) {
      // Return available servers list
      const serversMap = await getAllServers();
      const servers = Object.values(serversMap)
        .filter((s) => s.enabled)
        .map((s) => ({ id: s.id, name: s.name, flag: s.flag }));
      return NextResponse.json({ success: true, data: { servers } });
    }

    const clients = await listServerClients(serverId);
    if (clients === null) {
      return NextResponse.json(
        { success: false, error: 'Failed to connect to server' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { serverId, clients },
    });
  } catch (error) {
    log.error('Admin list server clients error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Failed to list server clients' },
      { status: 500 }
    );
  }
}
