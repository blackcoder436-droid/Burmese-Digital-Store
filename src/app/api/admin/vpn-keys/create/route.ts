import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import dbConnect from '@/lib/mongodb';
import { provisionVpnKey } from '@/lib/xui';
import { getAllServers, getServer } from '@/lib/vpn-servers';
import { getPlan } from '@/lib/vpn-plans';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/admin/vpn-keys/create' });

// ==========================================
// POST /api/admin/vpn-keys/create
// Admin can create VPN keys directly (test or sell)
// without going to 3x-ui panel
// ==========================================

export async function POST(request: NextRequest) {
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
    const {
      type,         // 'test' | 'sell'
      serverId,     // server ID
      protocol,     // trojan, vless, vmess, shadowsocks
      username,     // client name / label
      devices,      // number of devices (default 1)
      expiryDays,   // custom expiry in days
      dataLimitGB,  // data limit in GB (0 = unlimited)
      planId,       // optional: use predefined plan
    } = body;

    // Validate required fields
    if (!serverId || !protocol || !username) {
      return NextResponse.json(
        { success: false, error: 'serverId, protocol, username are required' },
        { status: 400 }
      );
    }

    if (!type || !['test', 'sell'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'type must be "test" or "sell"' },
        { status: 400 }
      );
    }

    // Validate server exists
    const server = await getServer(serverId);
    if (!server) {
      return NextResponse.json(
        { success: false, error: 'Server not found' },
        { status: 400 }
      );
    }

    // Check protocol is enabled on server
    if (!server.enabledProtocols.includes(protocol)) {
      return NextResponse.json(
        { success: false, error: `Protocol "${protocol}" is not enabled on ${server.name}` },
        { status: 400 }
      );
    }

    // Determine key parameters
    let keyDevices = devices || 1;
    let keyExpiryDays = expiryDays;
    let keyDataLimitGB = dataLimitGB;

    if (type === 'test') {
      // Test key defaults: 1 device, 3 days (72h), 3GB
      keyDevices = devices || 1;
      keyExpiryDays = expiryDays || 3;
      keyDataLimitGB = dataLimitGB ?? 3;
    } else if (planId) {
      // Sell key with predefined plan
      const plan = getPlan(planId);
      if (plan) {
        keyDevices = plan.devices;
        keyExpiryDays = plan.expiryDays;
        keyDataLimitGB = plan.dataLimitGB;
      }
    }

    // Default sell key: 30 days, unlimited data
    if (!keyExpiryDays) keyExpiryDays = 30;
    if (keyDataLimitGB === undefined || keyDataLimitGB === null) keyDataLimitGB = 0;

    // Provision the key via 3x-ui API
    const result = await provisionVpnKey({
      serverId,
      username,
      userId: `admin_${admin.userId}`,
      devices: keyDevices,
      expiryDays: keyExpiryDays,
      dataLimitGB: keyDataLimitGB,
      protocol,
    });

    if (!result) {
      log.error('Admin key provisioning failed', { serverId, protocol, username });
      return NextResponse.json(
        { success: false, error: 'Key provisioning failed. Check server connectivity.' },
        { status: 500 }
      );
    }

    log.info('Admin created VPN key', {
      type,
      serverId,
      protocol,
      username,
      devices: keyDevices,
      expiryDays: keyExpiryDays,
      adminId: admin.userId,
    });

    return NextResponse.json({
      success: true,
      data: {
        type,
        server: `${server.flag} ${server.name}`,
        protocol,
        username,
        devices: keyDevices,
        expiryDays: keyExpiryDays,
        dataLimitGB: keyDataLimitGB,
        clientEmail: result.clientEmail,
        clientUUID: result.clientUUID,
        subLink: result.subLink,
        configLink: result.configLink,
        expiryTime: result.expiryTime,
      },
    });
  } catch (error) {
    log.error('Admin create key error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Failed to create VPN key' },
      { status: 500 }
    );
  }
}

// GET - list available servers & protocols for the create form
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
    const serversMap = await getAllServers();
    const enabledServers = Object.values(serversMap)
      .filter((s) => s.enabled)
      .map((s) => ({
        id: s.id,
        name: s.name,
        flag: s.flag,
        enabledProtocols: s.enabledProtocols,
        online: s.online,
      }));

    return NextResponse.json({
      success: true,
      data: { servers: enabledServers },
    });
  } catch (error) {
    log.error('Admin get servers error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch servers' },
      { status: 500 }
    );
  }
}
