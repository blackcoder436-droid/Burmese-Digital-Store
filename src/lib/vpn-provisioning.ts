import { randomUUID } from 'crypto';
import { getSiteSettings } from '@/models/SiteSettings';
import { getEnabledServers } from '@/lib/vpn-servers';
import { provisionVpnKey, revokeVpnKey } from '@/lib/xui';

export type VpnProvisioningMode = 'single' | 'all-enabled' | 'server-group';

export interface VpnProvisioningSelection {
  mode: VpnProvisioningMode;
  serverIds: string[];
}

export interface ProvisionedVpnKey {
  serverId: string;
  clientEmail: string;
  clientUUID: string;
  subId: string;
  subLink: string;
  configLink: string;
  protocol: string;
  expiryTime: number;
  provisionedAt?: Date;
}

export interface MultiProvisionResult {
  primary: ProvisionedVpnKey;
  keys: ProvisionedVpnKey[];
  combinedSubLink: string;
  subToken: string;
  mode: VpnProvisioningMode;
  serverIds: string[];
}

export async function resolveProvisioningServers(
  selectedServerId: string
): Promise<VpnProvisioningSelection> {
  const settings = await getSiteSettings();
  const mode = settings.vpnProvisioningMode || 'single';

  if (mode === 'all-enabled') {
    const enabled = await getEnabledServers();
    const ids = enabled.map((s) => s.id);
    const merged = Array.from(new Set([...ids, selectedServerId].filter(Boolean)));
    return { mode, serverIds: merged };
  }

  if (mode === 'server-group') {
    const enabled = await getEnabledServers();
    const enabledIds = new Set(enabled.map((s) => s.id));
    const groupIds = (settings.vpnProvisioningServerIds || [])
      .map((id) => String(id).toLowerCase())
      .filter((id) => enabledIds.has(id));
    const merged = Array.from(new Set([...groupIds, selectedServerId].filter(Boolean)));
    return { mode, serverIds: merged };
  }

  return { mode: 'single', serverIds: [selectedServerId] };
}

export function generateSubToken(): string {
  return randomUUID().replace(/-/g, '');
}

export function buildCombinedSubLink(token: string): string {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000')
    .replace(/\/$/, '');
  return `${baseUrl}/api/vpn/sub/${token}`;
}

export async function provisionMultiServerKeys(opts: {
  serverId: string;
  username: string;
  userId: string;
  devices: number;
  expiryDays: number;
  dataLimitGB: number;
  protocol: string;
}): Promise<MultiProvisionResult | null> {
  const selection = await resolveProvisioningServers(opts.serverId);
  const serverIds = selection.serverIds.length > 0 ? selection.serverIds : [opts.serverId];
  const subToken = generateSubToken();
  const combinedSubLink = buildCombinedSubLink(subToken);
  const provisioned: ProvisionedVpnKey[] = [];

  for (const serverId of serverIds) {
    const result = await provisionVpnKey({
      serverId,
      username: opts.username,
      userId: opts.userId,
      devices: opts.devices,
      expiryDays: opts.expiryDays,
      dataLimitGB: opts.dataLimitGB,
      protocol: opts.protocol,
    });
    if (!result) {
      await revokeProvisionedKeys(provisioned);
      return null;
    }
    provisioned.push({
      serverId,
      clientEmail: result.clientEmail,
      clientUUID: result.clientUUID,
      subId: result.subId,
      subLink: result.subLink,
      configLink: result.configLink,
      protocol: result.protocol,
      expiryTime: result.expiryTime,
      provisionedAt: new Date(),
    });
  }

  const primary = provisioned.find((p) => p.serverId === opts.serverId) || provisioned[0];
  if (!primary) return null;

  return {
    primary,
    keys: provisioned,
    combinedSubLink,
    subToken,
    mode: selection.mode,
    serverIds,
  };
}

export async function revokeProvisionedKeys(
  keys: Array<Pick<ProvisionedVpnKey, 'serverId' | 'clientEmail'>>
): Promise<boolean> {
  let revokedAny = false;
  for (const key of keys) {
    try {
      const revoked = await revokeVpnKey(key.serverId, key.clientEmail);
      revokedAny = revokedAny || revoked;
    } catch {
      // continue
    }
  }
  return revokedAny;
}
