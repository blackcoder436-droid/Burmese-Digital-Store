import crypto from 'crypto';
import { createLogger } from '@/lib/logger';
import { getEnabledServers, type VpnServer } from '@/lib/vpn-servers';
import {
  findClientByConfigLinkAcrossServers,
  findClientBySubIdAcrossServers,
  listServerClients,
  provisionVpnKey,
  updateVpnClient,
} from '@/lib/xui';
import { isMultiServerClientEmailMatch } from '@/lib/multi-server-key-match';

const log = createLogger({ module: 'multi-server-key-sync' });

type VpnKeyRecordLike = Record<string, unknown> & {
  _id?: unknown;
  userId?: unknown;
  username?: unknown;
  token?: unknown;
  protocol?: unknown;
  devices?: unknown;
  expiryTime?: unknown;
  dataLimitGB?: unknown;
  status?: unknown;
  serverSubLinks?: unknown;
  serverConfigLinks?: unknown;
};

type ResolvedPanelClient = Record<string, unknown> & {
  email?: string;
  clientEmail?: string;
  client?: string;
  clientId?: string;
  serverId?: string;
  serverName?: string;
  subId?: string;
};

export type AutoSyncActionStatus = 'updated' | 'created' | 'linked' | 'skipped' | 'failed';

export type AutoSyncActionType =
  | 'linked_client'
  | 'name_match'
  | 'missing_server'
  | 'multiple_candidates'
  | 'disabled_missing'
  | 'panel_error';

export interface AutoSyncAction {
  serverId: string;
  serverName: string;
  type: AutoSyncActionType;
  status: AutoSyncActionStatus;
  email?: string;
  source?: 'config' | 'sub' | 'name' | 'provision';
  message: string;
}

export interface MultiServerKeyAutoSyncReport {
  generatedAt: string;
  mode: 'web_to_panel';
  dryRun: false;
  linksChanged: boolean;
  serverSubLinks: string[];
  serverConfigLinks: string[];
  summary: {
    totalServers: number;
    updated: number;
    created: number;
    linked: number;
    skipped: number;
    failed: number;
  };
  actions: AutoSyncAction[];
}

export interface SyncMultiServerKeyOptions {
  provisionMissing?: boolean;
  persistLinks?: (links: { serverSubLinks: string[]; serverConfigLinks: string[] }) => Promise<void>;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function expectedEnable(record: VpnKeyRecordLike): boolean {
  return String(record.status || 'active') === 'active';
}

function buildPanelUpdates(record: VpnKeyRecordLike) {
  return {
    expiryTime: numberValue(record.expiryTime, 0),
    devices: Math.max(1, Math.trunc(numberValue(record.devices, 1))),
    dataLimitGB: numberValue(record.dataLimitGB, 0),
    enable: expectedEnable(record),
  };
}

function getClientEmail(client: ResolvedPanelClient): string {
  return String(client.email || client.clientEmail || client.client || client.clientId || '').trim();
}

function getClientSubId(client: ResolvedPanelClient): string {
  return String(client.subId || '').trim();
}

function extractSubId(value: string): string {
  try {
    const raw = value.trim();
    const parsed = raw.includes('://') ? new URL(raw) : null;
    const path = parsed ? `${parsed.pathname}${parsed.search}` : raw;
    const match = path.match(/(?:\/api\/vpn)?\/sub\/([a-zA-Z0-9-]{8,64})/i);
    return match ? match[1] : raw;
  } catch {
    const match = value.match(/(?:\/api\/vpn)?\/sub\/([a-zA-Z0-9-]{8,64})/i);
    return match ? match[1] : value;
  }
}

function buildServerSubLink(server: VpnServer, subId: string): string {
  return subId ? `https://${server.domain}:${server.subPort}/sub/${subId}` : '';
}

function daysUntilExpiry(expiryTime: unknown): number {
  const expiry = numberValue(expiryTime, 0);
  if (expiry <= 0) return 0;
  const msRemaining = expiry - Date.now();
  return msRemaining > 0 ? Math.max(1, Math.ceil(msRemaining / (24 * 60 * 60 * 1000))) : 1;
}

function buildProvisionUsername(record: VpnKeyRecordLike, server: VpnServer): string {
  const rawName = String(record.username || record.token || 'user');
  const sanitizedName = rawName
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 24) || 'user';
  const serverName = server.name.replace(/\s+/g, '-').replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 18);
  return `auto_${crypto.randomBytes(2).toString('hex')}_${sanitizedName}_${serverName}`;
}

function summarize(actions: AutoSyncAction[], totalServers: number): MultiServerKeyAutoSyncReport['summary'] {
  return actions.reduce(
    (acc, action) => {
      acc[action.status] += 1;
      return acc;
    },
    { totalServers, updated: 0, created: 0, linked: 0, skipped: 0, failed: 0 }
  );
}

async function updatePanelClient(
  server: VpnServer,
  client: ResolvedPanelClient,
  record: VpnKeyRecordLike,
  source: AutoSyncAction['source'],
  type: AutoSyncActionType
): Promise<AutoSyncAction> {
  const email = getClientEmail(client);
  if (!email) {
    return {
      serverId: server.id,
      serverName: server.name,
      type,
      status: 'failed',
      source,
      message: 'Panel client has no usable email/name identifier',
    };
  }

  const ok = await updateVpnClient(server.id, email, buildPanelUpdates(record));
  return {
    serverId: server.id,
    serverName: server.name,
    type,
    status: ok ? (source === 'name' ? 'linked' : 'updated') : 'failed',
    email,
    source,
    message: ok
      ? source === 'name'
        ? 'Matched unlinked panel client by name and synced DB values'
        : 'Synced linked panel client from DB values'
      : 'Failed to sync panel client',
  };
}

export async function syncMultiServerKeyRecord(
  record: VpnKeyRecordLike,
  options: SyncMultiServerKeyOptions = {}
): Promise<MultiServerKeyAutoSyncReport> {
  const provisionMissing = options.provisionMissing !== false;
  const enabledServers = await getEnabledServers();
  const serverSubLinks = stringArray(record.serverSubLinks);
  const serverConfigLinks = stringArray(record.serverConfigLinks);
  const originalSubLinkCount = serverSubLinks.length;
  const originalConfigLinkCount = serverConfigLinks.length;
  const existingByServer = new Map<string, { client: ResolvedPanelClient; source: 'config' | 'sub' }>();
  const linkedClientsForMatching: ResolvedPanelClient[] = [];
  const actions: AutoSyncAction[] = [];

  for (const configLink of serverConfigLinks) {
    try {
      const client = await findClientByConfigLinkAcrossServers(configLink) as ResolvedPanelClient | null;
      if (!client?.serverId || existingByServer.has(String(client.serverId))) continue;
      existingByServer.set(String(client.serverId), { client, source: 'config' });
      linkedClientsForMatching.push(client);
    } catch (error) {
      log.warn('Failed to resolve config link during auto-sync', {
        recordId: String(record._id || ''),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  for (const subLink of serverSubLinks) {
    try {
      const subId = extractSubId(subLink);
      const client = await findClientBySubIdAcrossServers(subId, subLink) as ResolvedPanelClient | null;
      if (!client?.serverId || existingByServer.has(String(client.serverId))) continue;
      existingByServer.set(String(client.serverId), { client, source: 'sub' });
      linkedClientsForMatching.push(client);
    } catch (error) {
      log.warn('Failed to resolve sub link during auto-sync', {
        recordId: String(record._id || ''),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  for (const server of enabledServers) {
    const existing = existingByServer.get(server.id);
    if (!existing) continue;
    actions.push(await updatePanelClient(server, existing.client, record, existing.source, 'linked_client'));
  }

  for (const server of enabledServers) {
    if (existingByServer.has(server.id)) continue;

    try {
      const clients = (await listServerClients(server.id) || []) as ResolvedPanelClient[];
      const matches = clients.filter((client) =>
        isMultiServerClientEmailMatch(String(client.email || ''), record, server, linkedClientsForMatching)
      );

      if (matches.length === 1) {
        const action = await updatePanelClient(server, matches[0], record, 'name', 'name_match');
        actions.push(action);
        existingByServer.set(server.id, { client: matches[0], source: 'sub' });
        linkedClientsForMatching.push({ ...matches[0], serverId: server.id, serverName: server.name });

        const subId = getClientSubId(matches[0]);
        const subLink = buildServerSubLink(server, subId);
        if (subLink && !serverSubLinks.includes(subLink)) serverSubLinks.push(subLink);
        continue;
      }

      if (matches.length > 1) {
        actions.push({
          serverId: server.id,
          serverName: server.name,
          type: 'multiple_candidates',
          status: 'skipped',
          message: 'Multiple matching panel clients found. Skipped to avoid linking the wrong client.',
        });
        continue;
      }

      if (!provisionMissing || !expectedEnable(record)) {
        actions.push({
          serverId: server.id,
          serverName: server.name,
          type: expectedEnable(record) ? 'missing_server' : 'disabled_missing',
          status: 'skipped',
          message: expectedEnable(record)
            ? 'Missing server client was not provisioned by this sync mode'
            : 'Record is disabled, so no new panel client was provisioned',
        });
        continue;
      }

      const keyData = await provisionVpnKey({
        serverId: server.id,
        userId: String(record.userId || 'admin_auto_sync'),
        devices: Math.max(1, Math.trunc(numberValue(record.devices, 1))),
        expiryDays: daysUntilExpiry(record.expiryTime),
        dataLimitGB: numberValue(record.dataLimitGB, 0),
        protocol: String(record.protocol || 'trojan'),
        username: buildProvisionUsername(record, server),
      });

      if (!keyData?.success) {
        actions.push({
          serverId: server.id,
          serverName: server.name,
          type: 'missing_server',
          status: 'failed',
          source: 'provision',
          message: 'Failed to provision missing server client',
        });
        continue;
      }

      await updateVpnClient(server.id, keyData.clientEmail, buildPanelUpdates(record));
      if (keyData.subLink && !serverSubLinks.includes(keyData.subLink)) serverSubLinks.push(keyData.subLink);
      if (keyData.configLink && !serverConfigLinks.includes(keyData.configLink)) serverConfigLinks.push(keyData.configLink);
      actions.push({
        serverId: server.id,
        serverName: server.name,
        type: 'missing_server',
        status: 'created',
        email: keyData.clientEmail,
        source: 'provision',
        message: 'Provisioned missing server client and synced DB values',
      });
    } catch (error) {
      actions.push({
        serverId: server.id,
        serverName: server.name,
        type: 'panel_error',
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const linksChanged = serverSubLinks.length !== originalSubLinkCount || serverConfigLinks.length !== originalConfigLinkCount;
  if (linksChanged && options.persistLinks) {
    await options.persistLinks({ serverSubLinks, serverConfigLinks });
  }

  return {
    generatedAt: new Date().toISOString(),
    mode: 'web_to_panel',
    dryRun: false,
    linksChanged,
    serverSubLinks,
    serverConfigLinks,
    summary: summarize(actions, enabledServers.length),
    actions,
  };
}
