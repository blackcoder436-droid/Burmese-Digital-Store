import { isMultiServerClientEmailMatch } from '@/lib/multi-server-key-match';
import { getEnabledServers, type VpnServer } from '@/lib/vpn-servers';
import { listServerClients } from '@/lib/xui';

type VpnKeyRecordLike = Record<string, unknown> & {
  _id?: unknown;
  username?: unknown;
  devices?: unknown;
  expiryTime?: unknown;
  dataLimitGB?: unknown;
  status?: unknown;
  serverSubLinks?: unknown;
  serverConfigLinks?: unknown;
};

type ListedClient = {
  email: string;
  protocol: string;
  enable: boolean;
  expiryTime: number;
  limitIp: number;
  totalGB: number;
  up: number;
  down: number;
  tgId: string;
  subId: string;
  clientId: string;
  clientPassword: string;
};

type ReconciliationIssueType =
  | 'expiry_mismatch'
  | 'devices_mismatch'
  | 'data_limit_mismatch'
  | 'enable_mismatch'
  | 'missing_client'
  | 'orphan_candidate'
  | 'unlinked_server'
  | 'panel_error';

export type ReconciliationStatus = 'ok' | 'drift' | 'missing' | 'orphan' | 'unlinked' | 'error';

export interface ReconciliationIssue {
  type: ReconciliationIssueType;
  message: string;
  expected?: string | number | boolean;
  actual?: string | number | boolean;
}

export interface ReconciliationClientSnapshot {
  email: string;
  protocol: string;
  enable: boolean;
  expiryTime: number;
  limitIp: number;
  totalGB: number;
  up: number;
  down: number;
  subId: string;
  clientId: string;
  clientPassword: string;
}

export interface ServerReconciliationResult {
  serverId: string;
  serverName: string;
  status: ReconciliationStatus;
  expectedSubIds: string[];
  expectedSubLinks: string[];
  issues: ReconciliationIssue[];
  linkedClient: ReconciliationClientSnapshot | null;
  orphanCandidates: ReconciliationClientSnapshot[];
}

export interface MultiServerKeyReconciliationReport {
  generatedAt: string;
  expected: {
    expiryTime: number;
    devices: number;
    totalGB: number;
    enable: boolean;
  };
  summary: {
    totalServers: number;
    ok: number;
    drift: number;
    missing: number;
    orphan: number;
    unlinked: number;
    error: number;
    orphanCandidates: number;
  };
  servers: ServerReconciliationResult[];
}

function asArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function numberValue(value: unknown, fallback = 0): number {
  const valueNumber = Number(value);
  return Number.isFinite(valueNumber) ? valueNumber : fallback;
}

function expectedTotalBytes(record: VpnKeyRecordLike): number {
  const dataLimitGB = numberValue(record.dataLimitGB, 0);
  return dataLimitGB > 0 ? Math.floor(dataLimitGB * 1024 * 1024 * 1024) : 0;
}

function expectedEnable(record: VpnKeyRecordLike): boolean {
  return String(record.status || 'active') === 'active';
}

function sameUtcDate(a: number, b: number): boolean {
  if (!a || !b) return false;
  return new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10);
}

function parseSubLink(value: string): { host: string; subId: string; link: string } | null {
  const raw = value.trim();
  if (!raw) return null;

  try {
    const parsed = raw.includes('://') ? new URL(raw) : new URL(`https://local.invalid${raw.startsWith('/') ? raw : `/${raw}`}`);
    const match = parsed.pathname.match(/\/sub\/(?:api\/vpn\/)?([a-zA-Z0-9-]{8,64})/i)
      || parsed.pathname.match(/(?:\/api\/vpn)?\/sub\/([a-zA-Z0-9-]{8,64})/i);
    if (!match) return null;
    return {
      host: parsed.hostname === 'local.invalid' ? '' : parsed.hostname.toLowerCase(),
      subId: match[1].toLowerCase(),
      link: raw,
    };
  } catch {
    const match = raw.match(/(?:\/api\/vpn)?\/sub\/([a-zA-Z0-9-]{8,64})/i);
    return match ? { host: '', subId: match[1].toLowerCase(), link: raw } : null;
  }
}

function linkBelongsToServer(linkHost: string, server: VpnServer): boolean {
  if (!linkHost) return false;
  const serverHost = String(server.domain || '').toLowerCase();
  return linkHost === serverHost || linkHost.includes(server.id.toLowerCase());
}

function snapshotClient(client: ListedClient): ReconciliationClientSnapshot {
  return {
    email: String(client.email || ''),
    protocol: String(client.protocol || ''),
    enable: client.enable !== false,
    expiryTime: numberValue(client.expiryTime, 0),
    limitIp: numberValue(client.limitIp, 0),
    totalGB: numberValue(client.totalGB, 0),
    up: numberValue(client.up, 0),
    down: numberValue(client.down, 0),
    subId: String(client.subId || ''),
    clientId: String(client.clientId || ''),
    clientPassword: String(client.clientPassword || ''),
  };
}

function compareClientToRecord(client: ReconciliationClientSnapshot, record: VpnKeyRecordLike): ReconciliationIssue[] {
  const expectedExpiry = numberValue(record.expiryTime, 0);
  const expectedDevices = Math.max(1, Math.trunc(numberValue(record.devices, 1)));
  const expectedTotal = expectedTotalBytes(record);
  const expectedIsEnabled = expectedEnable(record);
  const issues: ReconciliationIssue[] = [];

  // Allow small clock/precision differences (e.g. panel truncates milliseconds)
  const clientExpiry = numberValue(client.expiryTime, 0);
  const EPSILON_MS = 5000; // 5 seconds tolerance
  if (!(clientExpiry === 0 && expectedExpiry === 0)) {
    const diff = Math.abs(clientExpiry - expectedExpiry);
    if (diff > EPSILON_MS) {
      issues.push({
        type: 'expiry_mismatch',
        message: sameUtcDate(clientExpiry, expectedExpiry)
          ? 'Panel expiry date matches, but exact expiry time differs from DB record'
          : 'Panel expiry does not match DB record',
        expected: expectedExpiry,
        actual: clientExpiry,
      });
    }
  }

  if (numberValue(client.limitIp, 0) !== expectedDevices) {
    issues.push({
      type: 'devices_mismatch',
      message: 'Panel device limit does not match DB record',
      expected: expectedDevices,
      actual: client.limitIp,
    });
  }

  if (numberValue(client.totalGB, 0) !== expectedTotal) {
    issues.push({
      type: 'data_limit_mismatch',
      message: 'Panel data limit does not match DB record',
      expected: expectedTotal,
      actual: client.totalGB,
    });
  }

  if (client.enable !== expectedIsEnabled) {
    issues.push({
      type: 'enable_mismatch',
      message: 'Panel enable status does not match DB record',
      expected: expectedIsEnabled,
      actual: client.enable,
    });
  }

  return issues;
}

function summarize(servers: ServerReconciliationResult[]): MultiServerKeyReconciliationReport['summary'] {
  return servers.reduce(
    (acc, server) => {
      acc.totalServers += 1;
      acc[server.status] += 1;
      acc.orphanCandidates += server.orphanCandidates.length;
      return acc;
    },
    { totalServers: 0, ok: 0, drift: 0, missing: 0, orphan: 0, unlinked: 0, error: 0, orphanCandidates: 0 }
  );
}

// Simple in-memory cache for server client lists to reduce repeated panel requests
const SERVER_CLIENT_LIST_CACHE_TTL_MS = 30_000; // 30s
const DEFAULT_CLIENT_LIST_CONCURRENCY = 4;
const serverClientsCache = new Map<string, { ts: number; clients: ListedClient[] | null }>();

export function invalidateReconciliationClientCache(serverIds?: string[]) {
  if (!serverIds || serverIds.length === 0) {
    serverClientsCache.clear();
    return;
  }

  for (const serverId of serverIds) {
    serverClientsCache.delete(serverId);
  }
}

async function getServerClientsCached(serverId: string): Promise<ListedClient[] | null> {
  const now = Date.now();
  const cached = serverClientsCache.get(serverId);
  if (cached && now - cached.ts < SERVER_CLIENT_LIST_CACHE_TTL_MS) {
    return cached.clients;
  }

  try {
    const clients = ((await listServerClients(serverId)) || []) as ListedClient[];
    serverClientsCache.set(serverId, { ts: now, clients });
    return clients;
  } catch (err) {
    // Cache a null result briefly to avoid hammering a failing panel repeatedly
    serverClientsCache.set(serverId, { ts: now, clients: null });
    throw err;
  }
}

// Simple concurrency helper: run mapper over items with N workers
async function mapWithConcurrency<T, U>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<U>): Promise<U[]> {
  const results: U[] = new Array(items.length);
  let i = 0;
  const workers = new Array(Math.max(1, concurrency)).fill(0).map(async () => {
    while (true) {
      const index = i++;
      if (index >= items.length) break;
      // eslint-disable-next-line no-await-in-loop
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function reconcileMultiServerKey(record: VpnKeyRecordLike): Promise<MultiServerKeyReconciliationReport> {
  const servers = await getEnabledServers();
  const parsedSubLinks = asArray(record.serverSubLinks)
    .map(parseSubLink)
    .filter((link): link is NonNullable<ReturnType<typeof parseSubLink>> => Boolean(link));

  const listedByServer = new Map<string, ListedClient[]>();
  const linkedClientsForMatching: Array<ReconciliationClientSnapshot & { serverName: string }> = [];

  const concurrency = Number(process.env.RECONCILE_CLIENT_CONCURRENCY || DEFAULT_CLIENT_LIST_CONCURRENCY);

  const firstPassResults = await mapWithConcurrency(servers, concurrency, async (server) => {
    const expectedLinks = parsedSubLinks.filter((link) => linkBelongsToServer(link.host, server));
    const expectedSubIds = Array.from(new Set(expectedLinks.map((link) => link.subId)));

    try {
      const clients = ((await getServerClientsCached(server.id)) || []) as ListedClient[];
      listedByServer.set(server.id, clients);

      const linked = clients.find((client) => expectedSubIds.includes(String(client.subId || '').toLowerCase()));
      const linkedClient = linked ? snapshotClient(linked) : null;
      if (linkedClient) {
        linkedClientsForMatching.push({ ...linkedClient, serverName: server.name });
      }

      const issues = linkedClient ? compareClientToRecord(linkedClient, record) : [];
      if (!linkedClient && expectedSubIds.length > 0) {
        issues.push({
          type: 'missing_client',
          message: 'DB has a sub link for this server, but panel client was not found by subId',
        });
      }
      if (!linkedClient && expectedSubIds.length === 0) {
        issues.push({
          type: 'unlinked_server',
          message: 'DB record has no server sub link for this enabled server',
        });
      }

      return {
        serverId: server.id,
        serverName: server.name,
        status: linkedClient ? (issues.length > 0 ? 'drift' : 'ok') : expectedSubIds.length > 0 ? 'missing' : 'unlinked',
        expectedSubIds,
        expectedSubLinks: expectedLinks.map((link) => link.link),
        issues,
        linkedClient,
        orphanCandidates: [],
      } as ServerReconciliationResult;
    } catch (error) {
      return {
        serverId: server.id,
        serverName: server.name,
        status: 'error',
        expectedSubIds,
        expectedSubLinks: expectedLinks.map((link) => link.link),
        issues: [{
          type: 'panel_error',
          message: error instanceof Error ? error.message : String(error),
        }],
        linkedClient: null,
        orphanCandidates: [],
      } as ServerReconciliationResult;
    }
  });

  const finalResults = firstPassResults.map((result) => {
    if (result.status === 'error') return result;

    const clients = listedByServer.get(result.serverId) || [];
    const linkedSubIds = new Set(result.expectedSubIds);
    const server = servers.find((item) => item.id === result.serverId);
    const orphanCandidates = server
      ? clients
        .filter((client) => {
          const subId = String(client.subId || '').toLowerCase();
          if (subId && linkedSubIds.has(subId)) return false;
          return isMultiServerClientEmailMatch(String(client.email || ''), record, server, linkedClientsForMatching);
        })
        .map(snapshotClient)
      : [];

    const issues = [...result.issues];
    if (orphanCandidates.length > 0) {
      issues.push({
        type: 'orphan_candidate',
        message: `${orphanCandidates.length} unlinked matching client(s) found on this panel`,
        actual: orphanCandidates.length,
      });
    }

    const status: ReconciliationStatus = result.linkedClient
      ? result.status
      : orphanCandidates.length > 0
        ? 'orphan'
        : result.status;

    return {
      ...result,
      status,
      issues,
      orphanCandidates,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    expected: {
      expiryTime: numberValue(record.expiryTime, 0),
      devices: Math.max(1, Math.trunc(numberValue(record.devices, 1))),
      totalGB: expectedTotalBytes(record),
      enable: expectedEnable(record),
    },
    summary: summarize(finalResults),
    servers: finalResults,
  };
}
