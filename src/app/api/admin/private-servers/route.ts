import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { logActivity } from '@/models/ActivityLog';
import PrivateVpnService from '@/models/PrivateVpnService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['planned', 'provisioning', 'active', 'suspended', 'rotating', 'archived', 'error'];
const VALID_ACTION_MODES = ['create_new', 'attach_existing', 'replace_existing'];
const VALID_CUSTOMER_TYPES = ['family', 'company', 'internal'];

function cleanText(value: unknown, maxLength = 500): string {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanSlug(value: unknown): string {
  return cleanText(value, 80).toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

function cleanDomain(value: unknown): string {
  return cleanText(value, 180)
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .replace(/[^a-z0-9._-]/g, '');
}

function cleanNumber(value: unknown, fallback: number, min = 0, max = 65535): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function cleanBool(value: unknown, fallback = false): boolean {
  if (value === undefined) return fallback;
  return value === true || value === 'true' || value === '1' || value === 1;
}

function cleanList(value: unknown, maxItems = 30): string[] {
  const source = Array.isArray(value) ? value : String(value || '').split(',');
  return source
    .map((item) => cleanText(item, 120))
    .filter(Boolean)
    .slice(0, maxItems);
}

function cleanNumberList(value: unknown, fallback: number[]): number[] {
  const source = Array.isArray(value) ? value : String(value || '').split(',');
  const ports = source
    .map((item) => cleanNumber(item, 0, 1, 65535))
    .filter((item) => item > 0);

  return ports.length > 0 ? Array.from(new Set(ports)) : fallback;
}

function pickEnum(value: unknown, allowed: string[], fallback: string) {
  const normalized = cleanText(value, 80);
  return allowed.includes(normalized) ? normalized : fallback;
}

function servicePayload(body: any, existing?: any) {
  const domain = body.domain || {};
  const droplet = body.droplet || {};
  const panel = body.panel || {};
  const existingDomain = existing?.domain || {};
  const existingDroplet = existing?.droplet || {};
  const existingPanel = existing?.panel || {};
  const defaultUfwPorts = [443, 8443, 2053, 2083, 2087, 2096];
  const serviceId = cleanSlug(body.serviceId ?? existing?.serviceId);
  const dropletName = cleanSlug(droplet.dropletName ?? existingDroplet.dropletName ?? serviceId);

  return {
    serviceId,
    customerName: cleanText(body.customerName ?? existing?.customerName, 160),
    customerType: pickEnum(body.customerType ?? existing?.customerType, VALID_CUSTOMER_TYPES, 'family'),
    contactName: cleanText(body.contactName ?? existing?.contactName, 120),
    contactEmail: cleanText(body.contactEmail ?? existing?.contactEmail, 160).toLowerCase(),
    notes: cleanText(body.notes ?? existing?.notes, 1000),
    status: pickEnum(body.status ?? existing?.status, VALID_STATUSES, 'planned'),
    actionMode: pickEnum(body.actionMode ?? existing?.actionMode, VALID_ACTION_MODES, 'create_new'),
    linkedServerId: cleanSlug(body.linkedServerId ?? existing?.linkedServerId),
    domain: {
      cfAccountId: cleanText(domain.cfAccountId ?? existingDomain.cfAccountId, 120),
      zoneId: cleanText(domain.zoneId ?? existingDomain.zoneId, 180),
      zoneName: cleanDomain(domain.zoneName ?? existingDomain.zoneName),
      hostname: cleanDomain(domain.hostname ?? existingDomain.hostname),
      recordType: 'A',
      content: cleanText(domain.content ?? existingDomain.content, 180),
      proxied: cleanBool(domain.proxied, existingDomain.proxied ?? false),
      ttl: cleanNumber(domain.ttl ?? existingDomain.ttl, 60, 1, 86400),
      dnsRecordId: cleanText(domain.dnsRecordId ?? existingDomain.dnsRecordId, 180),
    },
    droplet: {
      provider: 'digitalocean',
      tokenId: cleanText(droplet.tokenId ?? existingDroplet.tokenId, 120),
      dropletLimit: cleanNumber(droplet.dropletLimit ?? existingDroplet.dropletLimit, 3, 1, 100),
      dropletId: cleanText(droplet.dropletId ?? existingDroplet.dropletId, 120),
      dropletName,
      publicIp: cleanText(droplet.publicIp ?? existingDroplet.publicIp, 80),
      region: cleanText(droplet.region ?? existingDroplet.region ?? 'sgp1', 80),
      size: cleanText(droplet.size ?? existingDroplet.size ?? 's-1vcpu-1gb', 120),
      image: cleanText(droplet.image ?? existingDroplet.image ?? 'ubuntu-22-04-x64', 160),
      backups: cleanBool(droplet.backups, existingDroplet.backups ?? false),
      ipv6: cleanBool(droplet.ipv6, existingDroplet.ipv6 ?? false),
      monitoring: cleanBool(droplet.monitoring, existingDroplet.monitoring ?? true),
      publicNetworking: cleanBool(droplet.publicNetworking, existingDroplet.publicNetworking ?? true),
      dropletAgent: cleanBool(droplet.dropletAgent, existingDroplet.dropletAgent ?? true),
      sshKeys: cleanList(droplet.sshKeys ?? existingDroplet.sshKeys),
      vpcUuid: cleanText(droplet.vpcUuid ?? existingDroplet.vpcUuid, 160),
      volumes: cleanList(droplet.volumes ?? existingDroplet.volumes),
      tags: cleanList(droplet.tags ?? existingDroplet.tags ?? ['private-vpn']),
      userData: cleanText(droplet.userData ?? existingDroplet.userData, 64000),
      existingDropletId: cleanText(droplet.existingDropletId ?? existingDroplet.existingDropletId, 120),
      replaceOldDroplet: cleanBool(droplet.replaceOldDroplet, existingDroplet.replaceOldDroplet ?? false),
    },
    panel: {
      username: cleanText(panel.username ?? existingPanel.username ?? 'admin', 80),
      password: cleanText(panel.password ?? existingPanel.password, 160),
      enable2FA: cleanBool(panel.enable2FA, existingPanel.enable2FA ?? false),
      panelPath: cleanText(panel.panelPath ?? existingPanel.panelPath ?? '/mka', 80) || '/mka',
      panelPort: cleanNumber(panel.panelPort ?? existingPanel.panelPort, 2053, 1, 65535),
      subPort: cleanNumber(panel.subPort ?? existingPanel.subPort, 2096, 1, 65535),
      protocolPorts: {
        vless: cleanNumber(panel.protocolPorts?.vless ?? existingPanel.protocolPorts?.vless, 443, 1, 65535),
        trojan: cleanNumber(panel.protocolPorts?.trojan ?? existingPanel.protocolPorts?.trojan, 2083, 1, 65535),
        vmess: cleanNumber(panel.protocolPorts?.vmess ?? existingPanel.protocolPorts?.vmess, 2087, 1, 65535),
        shadowsocks: cleanNumber(panel.protocolPorts?.shadowsocks ?? existingPanel.protocolPorts?.shadowsocks, 8443, 1, 65535),
      },
      ufwAllowPorts: cleanNumberList(panel.ufwAllowPorts ?? existingPanel.ufwAllowPorts, defaultUfwPorts),
      installStatus: pickEnum(
        panel.installStatus ?? existingPanel.installStatus,
        ['pending', 'installed', 'repair_needed', 'unknown'],
        'pending'
      ),
    },
  };
}

function validatePayload(payload: ReturnType<typeof servicePayload>) {
  if (!payload.serviceId) return 'Service ID is required';
  if (!payload.customerName) return 'Customer name is required';
  if (!payload.domain.hostname) return 'Domain hostname is required';
  if (!payload.droplet.dropletName) return 'Droplet name is required';
  if (!payload.panel.password) return '3xUI panel password is required';
  return '';
}

export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
    await connectDB();

    const status = request.nextUrl.searchParams.get('status');
    const query: Record<string, any> = {};
    if (status && status !== 'all') query.status = status;

    const services = await PrivateVpnService.find(query).sort({ updatedAt: -1 }).lean();
    const counts = await PrivateVpnService.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    return NextResponse.json({
      success: true,
      data: {
        services,
        counts: Object.fromEntries(counts.map((item) => [item._id, item.count])),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load private servers' },
      { status: error.message === 'Admin access required' ? 403 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const admin = await requireAdmin();
    await connectDB();

    const body = await request.json();
    const payload = servicePayload(body);
    const validationError = validatePayload(payload);
    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 400 });
    }

    const existing = await PrivateVpnService.findOne({ serviceId: payload.serviceId }).lean();
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Service ID "${payload.serviceId}" already exists` },
        { status: 409 }
      );
    }

    const service = await PrivateVpnService.create(payload);
    await logActivity({
      admin: admin.userId,
      action: 'settings_updated',
      target: `Private VPN: ${service.customerName} (${service.serviceId})`,
      details: `Created private VPN service draft for ${service.domain.hostname}`,
    });

    return NextResponse.json({ success: true, data: { service } }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create private server' },
      { status: error.message === 'Admin access required' ? 403 : 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const admin = await requireAdmin();
    await connectDB();

    const body = await request.json();
    const serviceId = cleanSlug(body.serviceId);
    if (!serviceId) {
      return NextResponse.json({ success: false, error: 'Service ID is required' }, { status: 400 });
    }

    const existing = await PrivateVpnService.findOne({ serviceId });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Private server not found' }, { status: 404 });
    }

    const payload = servicePayload(body, existing);
    const validationError = validatePayload(payload);
    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 400 });
    }

    const newServiceId = cleanSlug(body.newServiceId || payload.serviceId);
    if (newServiceId && newServiceId !== serviceId) {
      const conflict = await PrivateVpnService.findOne({ serviceId: newServiceId }).lean();
      if (conflict) {
        return NextResponse.json(
          { success: false, error: `Service ID "${newServiceId}" already exists` },
          { status: 409 }
        );
      }
      payload.serviceId = newServiceId;
    }

    existing.set(payload);
    await existing.save();

    await logActivity({
      admin: admin.userId,
      action: 'settings_updated',
      target: `Private VPN: ${existing.customerName} (${existing.serviceId})`,
      details: `Updated private VPN service ${serviceId}`,
    });

    return NextResponse.json({ success: true, data: { service: existing } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update private server' },
      { status: error.message === 'Admin access required' ? 403 : 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const admin = await requireAdmin();
    await connectDB();

    const serviceId = cleanSlug(request.nextUrl.searchParams.get('serviceId'));
    if (!serviceId) {
      return NextResponse.json({ success: false, error: 'Service ID is required' }, { status: 400 });
    }

    const service = await PrivateVpnService.findOne({ serviceId });
    if (!service) {
      return NextResponse.json({ success: false, error: 'Private server not found' }, { status: 404 });
    }

    service.status = 'archived';
    await service.save();

    await logActivity({
      admin: admin.userId,
      action: 'settings_updated',
      target: `Private VPN: ${service.customerName} (${service.serviceId})`,
      details: 'Archived private VPN service record only. No droplet or DNS resources were deleted.',
    });

    return NextResponse.json({
      success: true,
      data: { service },
      message: 'Private server archived. No cloud resources were deleted.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to archive private server' },
      { status: error.message === 'Admin access required' ? 403 : 500 }
    );
  }
}
