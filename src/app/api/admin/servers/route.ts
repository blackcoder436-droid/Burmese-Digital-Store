import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import VpnServer from '@/models/VpnServer';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { logActivity } from '@/models/ActivityLog';
import { invalidateServerCache } from '@/lib/vpn-servers';
import { createLogger } from '@/lib/logger';
import { sanitizeString, validateExternalHttpUrl, validatePanelPath } from '@/lib/security';
import { trackVpnServerChange } from '@/lib/monitoring';

const log = createLogger({ route: '/api/admin/servers' });

// ==========================================
// GET /api/admin/servers — List all servers
// ==========================================
export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectDB();
    const servers = await VpnServer.find().sort({ createdAt: 1 }).lean();

    return NextResponse.json({
      success: true,
      data: {
        servers,
        total: servers.length,
        enabled: servers.filter((s) => s.enabled).length,
        disabled: servers.filter((s) => !s.enabled).length,
      },
    });
  } catch (err) {
    log.error('Failed to fetch servers', { error: err });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch servers' },
      { status: 500 }
    );
  }
}

// ==========================================
// POST /api/admin/servers — Create new server
// ==========================================
export async function POST(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectDB();
    const body = await request.json();

    const serverId = sanitizeString(body.serverId || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const name = sanitizeString(body.name || '');
    const flag = (body.flag || '').trim();
    const url = sanitizeString(body.url || '').replace(/\/$/, ''); // strip trailing slash
    const panelPath = sanitizeString(body.panelPath || '/mka');
    const domain = sanitizeString(body.domain || '');
    const subPort = parseInt(body.subPort) || 2096;
    const trojanPort = body.trojanPort ? parseInt(body.trojanPort) : null;
    const protocol = sanitizeString(body.protocol || 'trojan').toLowerCase();
    const validProtocols = ['trojan', 'vless', 'vmess', 'shadowsocks'];
    const enabledProtocols = Array.isArray(body.enabledProtocols)
      ? body.enabledProtocols.filter((p: string) => validProtocols.includes(p))
      : validProtocols;
    const enabled = body.enabled !== false;
    const notes = sanitizeString(body.notes || '');

    // Validation
    if (!serverId || !name || !flag || !url || !domain) {
      return NextResponse.json(
        { success: false, error: 'Server ID, name, flag, panel URL, and domain are required' },
        { status: 400 }
      );
    }

    const urlCheck = validateExternalHttpUrl(url, { requiredAllowlistEnv: 'VPN_SERVER_ALLOWED_HOSTS' });
    if (!urlCheck.ok) {
      return NextResponse.json({ success: false, error: urlCheck.error }, { status: 400 });
    }

    if (!validatePanelPath(panelPath)) {
      return NextResponse.json(
        { success: false, error: 'Invalid panelPath' },
        { status: 400 }
      );
    }

    if (!/^[a-z0-9_-]+$/.test(serverId)) {
      return NextResponse.json(
        { success: false, error: 'Server ID must be lowercase letters, numbers, hyphens, or underscores' },
        { status: 400 }
      );
    }

    if (!['trojan', 'vless', 'vmess'].includes(protocol)) {
      return NextResponse.json(
        { success: false, error: 'Protocol must be trojan, vless, or vmess' },
        { status: 400 }
      );
    }

    // Check duplicate
    const existing = await VpnServer.findOne({ serverId });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Server ID "${serverId}" already exists` },
        { status: 409 }
      );
    }

    const server = await VpnServer.create({
      serverId,
      name,
      flag,
      url,
      panelPath,
      domain,
      subPort,
      trojanPort,
      protocol,
      enabledProtocols,
      enabled,
      notes,
    });

    invalidateServerCache();

    await logActivity({
      admin: admin.userId,
      action: 'settings_updated',
      target: `VPN Server: ${name} (${serverId})`,
      details: `Created VPN server — ${flag} ${name}, protocol: ${protocol}, panel: ${url}`,
    });

    log.info('VPN server created', { serverId, name, protocol });

    // S10: Track VPN server configuration change
    trackVpnServerChange(admin.userId, serverId, 'create', { name, protocol, url });

    return NextResponse.json({ success: true, data: { server } }, { status: 201 });
  } catch (err) {
    log.error('Failed to create server', { error: err });
    return NextResponse.json(
      { success: false, error: 'Failed to create server' },
      { status: 500 }
    );
  }
}

// ==========================================
// PATCH /api/admin/servers — Update server
// ==========================================
export async function PATCH(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectDB();
    const body = await request.json();
    const { serverId } = body;

    if (!serverId) {
      return NextResponse.json(
        { success: false, error: 'Server ID is required' },
        { status: 400 }
      );
    }

    const server = await VpnServer.findOne({ serverId });
    if (!server) {
      return NextResponse.json(
        { success: false, error: 'Server not found' },
        { status: 404 }
      );
    }

    // Update allowed fields
    const updates: string[] = [];
    if (body.name !== undefined) { server.name = sanitizeString(body.name); updates.push('name'); }
    if (body.flag !== undefined) { server.flag = (body.flag || '').trim(); updates.push('flag'); }
    if (body.url !== undefined) {
      const newUrl = sanitizeString(body.url).replace(/\/$/, '');
      const check = validateExternalHttpUrl(newUrl, { requiredAllowlistEnv: 'VPN_SERVER_ALLOWED_HOSTS' });
      if (!check.ok) {
        return NextResponse.json({ success: false, error: check.error }, { status: 400 });
      }
      server.url = newUrl;
      updates.push('url');
    }
    if (body.panelPath !== undefined) {
      const newPanelPath = sanitizeString(body.panelPath);
      if (!validatePanelPath(newPanelPath)) {
        return NextResponse.json({ success: false, error: 'Invalid panelPath' }, { status: 400 });
      }
      server.panelPath = newPanelPath;
      updates.push('panelPath');
    }
    if (body.domain !== undefined) { server.domain = sanitizeString(body.domain); updates.push('domain'); }
    if (body.subPort !== undefined) { server.subPort = parseInt(body.subPort) || 2096; updates.push('subPort'); }
    if (body.trojanPort !== undefined) { server.trojanPort = body.trojanPort ? parseInt(body.trojanPort) : undefined; updates.push('trojanPort'); }
    if (body.protocol !== undefined) {
      const p = sanitizeString(body.protocol).toLowerCase();
      if (['trojan', 'vless', 'vmess'].includes(p)) {
        server.protocol = p;
        updates.push('protocol');
      }
    }
    if (body.enabledProtocols !== undefined && Array.isArray(body.enabledProtocols)) {
      const validProtocols = ['trojan', 'vless', 'vmess', 'shadowsocks'];
      const filtered = body.enabledProtocols.filter((p: string) => validProtocols.includes(p));
      if (filtered.length > 0) {
        server.enabledProtocols = filtered;
        updates.push('enabledProtocols');
      }
    }
    if (body.enabled !== undefined) { server.enabled = !!body.enabled; updates.push('enabled'); }
    if (body.notes !== undefined) { server.notes = sanitizeString(body.notes); updates.push('notes'); }

    await server.save();
    invalidateServerCache();

    await logActivity({
      admin: admin.userId,
      action: 'settings_updated',
      target: `VPN Server: ${server.name} (${serverId})`,
      details: `Updated fields: ${updates.join(', ')}`,
    });

    log.info('VPN server updated', { serverId, updates });

    // S10: Track VPN server configuration change
    trackVpnServerChange(admin.userId, serverId, 'update', { updates });

    return NextResponse.json({ success: true, data: { server } });
  } catch (err) {
    log.error('Failed to update server', { error: err });
    return NextResponse.json(
      { success: false, error: 'Failed to update server' },
      { status: 500 }
    );
  }
}

// ==========================================
// DELETE /api/admin/servers — Delete server
// ==========================================
export async function DELETE(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get('serverId');

    if (!serverId) {
      return NextResponse.json(
        { success: false, error: 'Server ID is required' },
        { status: 400 }
      );
    }

    const server = await VpnServer.findOne({ serverId });
    if (!server) {
      return NextResponse.json(
        { success: false, error: 'Server not found' },
        { status: 404 }
      );
    }

    // Check if any active orders use this server
    const { default: Order } = await import('@/models/Order');
    const activeOrders = await Order.countDocuments({
      'vpnPlan.serverId': serverId,
      status: { $in: ['pending', 'verifying', 'completed'] },
      vpnProvisionStatus: { $in: ['pending', 'provisioned'] },
    });

    if (activeOrders > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete: ${activeOrders} active order(s) use this server. Disable it instead.`,
        },
        { status: 409 }
      );
    }

    await VpnServer.deleteOne({ serverId });
    invalidateServerCache();

    await logActivity({
      admin: admin.userId,
      action: 'settings_updated',
      target: `VPN Server: ${server.name} (${serverId})`,
      details: `Deleted VPN server — ${server.flag} ${server.name}`,
    });

    log.info('VPN server deleted', { serverId });

    // S10: Track VPN server configuration change
    trackVpnServerChange(admin.userId, serverId, 'delete');

    return NextResponse.json({ success: true, message: 'Server deleted' });
  } catch (err) {
    log.error('Failed to delete server', { error: err });
    return NextResponse.json(
      { success: false, error: 'Failed to delete server' },
      { status: 500 }
    );
  }
}
