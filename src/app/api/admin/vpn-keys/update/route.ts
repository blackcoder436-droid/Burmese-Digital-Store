import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import { updateVpnClient } from '@/lib/xui';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/admin/vpn-keys/update' });

// ==========================================
// PATCH /api/admin/vpn-keys/update
// Admin can update VPN key settings on 3x-UI panel
// (expiry, devices, data limit, enable/disable)
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
    await dbConnect();

    const body = await request.json();
    const { orderId, expiryTime, devices, dataLimitGB, enable } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'orderId is required' },
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

    const order = await Order.findById(orderId);
    if (!order || order.orderType !== 'vpn' || !order.vpnKey?.clientEmail) {
      return NextResponse.json(
        { success: false, error: 'VPN order not found or not provisioned' },
        { status: 404 }
      );
    }

    const serverId = order.vpnPlan?.serverId;
    if (!serverId) {
      return NextResponse.json(
        { success: false, error: 'Server ID not found on order' },
        { status: 400 }
      );
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
    const success = await updateVpnClient(serverId, order.vpnKey.clientEmail, updates);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to update client on 3x-UI panel. Check server connectivity.' },
        { status: 500 }
      );
    }

    // Sync changes to local DB
    if (updates.expiryTime !== undefined) {
      order.vpnKey.expiryTime = updates.expiryTime;
    }
    await order.save();

    log.info('Admin updated VPN key', {
      orderId,
      clientEmail: order.vpnKey.clientEmail,
      serverId,
      updates,
      adminId: admin.userId,
    });

    return NextResponse.json({
      success: true,
      data: {
        orderId,
        clientEmail: order.vpnKey.clientEmail,
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
