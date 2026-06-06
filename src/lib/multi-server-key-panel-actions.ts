import { createLogger } from '@/lib/logger';
import { getEnabledServers, type VpnServer } from '@/lib/vpn-servers';
import {
  findClientByConfigLinkAcrossServers,
  findClientBySubIdAcrossServers,
  listServerClients,
  revokeVpnKey,
  updateVpnClient,
} from '@/lib/xui';
import { isMultiServerClientEmailMatch } from '@/lib/multi-server-key-match';

const log = createLogger({ module: 'multi-server-key-panel-actions' });

type VpnKeyRecordLike = Record<string, unknown> & {
  _id?: unknown;
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
  enable?: boolean;
  expiryTime?: number;
  subId?: string;
};

export type PanelMutation = 'update' | 'delete';
export type PanelActionStatus = 'updated' | 'deleted' | 'skipped' | 'failed';

export interface PanelMutationUpdates {
  expiryTime?: number;
  devices?: number;
  dataLimitGB?: number;
  status?: 'active' | 'disabled' | 'expired';
}

export interface PanelActionResult {
  serverId: string;
  serverName: string;
  mutation: PanelMutation;
  status: PanelActionStatus;
  email?: string;
  source?: 'config' | 'sub' | 'name';
  message: string;
}

export interface PanelMutationReport {
  generatedAt: string;
  source: '3xui';
  webDbKeyFieldsChanged: false;
  mutation: PanelMutation;
  summary: {
    total: number;
    updated: number;
    deleted: number;
    skipped: number;
    failed: number;
  };
  actions: PanelActionResult[];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function getClientEmail(client: ResolvedPanelClient): string {
  return String(client.email || client.clientEmail || client.client || client.clientId || '').trim();
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

function toPanelUpdates(updates: PanelMutationUpdates) {
  const panelUpdates: {
    expiryTime?: number;
    devices?: number;
    dataLimitGB?: number;
    enable?: boolean;
  } = {};

  if (updates.expiryTime !== undefined) panelUpdates.expiryTime = updates.expiryTime;
  if (updates.devices !== undefined) panelUpdates.devices = updates.devices;
  if (updates.dataLimitGB !== undefined) panelUpdates.dataLimitGB = updates.dataLimitGB;
  if (updates.status !== undefined) panelUpdates.enable = updates.status === 'active';

  return panelUpdates;
}

function summarize(actions: PanelActionResult[]): PanelMutationReport['summary'] {
  return actions.reduce(
    (acc, action) => {
      acc.total += 1;
      acc[action.status] += 1;
      return acc;
    },
    { total: 0, updated: 0, deleted: 0, skipped: 0, failed: 0 }
  );
}

async function mutateClient(
  server: VpnServer,
  client: ResolvedPanelClient,
  mutation: PanelMutation,
  updates: PanelMutationUpdates,
  source: PanelActionResult['source'],
  selectionNote = ''
): Promise<PanelActionResult> {
  const email = getClientEmail(client);
  if (!email) {
    return {
      serverId: server.id,
      serverName: server.name,
      mutation,
      status: 'failed',
      source,
      message: 'Panel client has no usable email/name identifier',
    };
  }

  const ok = mutation === 'delete'
    ? await revokeVpnKey(server.id, email)
    : await updateVpnClient(server.id, email, toPanelUpdates(updates));

  return {
    serverId: server.id,
    serverName: server.name,
    mutation,
    status: ok ? (mutation === 'delete' ? 'deleted' : 'updated') : 'failed',
    email,
    source,
    message: ok
      ? mutation === 'delete'
        ? 'Deleted live 3xUI client'
        : `Updated live 3xUI client${selectionNote ? ` (${selectionNote})` : ''}`
      : `Failed to ${mutation} live 3xUI client`,
  };
}

function chooseSingleCandidate(matches: ResolvedPanelClient[]) {
  if (matches.length === 1) {
    return { client: matches[0], note: '' };
  }

  const enabled = matches.filter((client) => client.enable !== false);
  if (enabled.length === 1) {
    return { client: enabled[0], note: 'selected the only enabled match among duplicates' };
  }

  const withSubId = matches.filter((client) => String(client.subId || '').trim());
  if (withSubId.length === 1) {
    return { client: withSubId[0], note: 'selected the only match with a subId among duplicates' };
  }

  return null;
}

export async function mutateMultiServerKeyPanels(
  record: VpnKeyRecordLike,
  mutation: PanelMutation,
  updates: PanelMutationUpdates = {}
): Promise<PanelMutationReport> {
  const enabledServers = await getEnabledServers();
  const serverById = new Map(enabledServers.map((server) => [server.id, server]));
  const resolvedByServer = new Map<string, { client: ResolvedPanelClient; source: 'config' | 'sub' }>();
  const linkedClientsForMatching: ResolvedPanelClient[] = [];
  const actions: PanelActionResult[] = [];

  for (const configLink of stringArray(record.serverConfigLinks)) {
    try {
      const client = await findClientByConfigLinkAcrossServers(configLink) as ResolvedPanelClient | null;
      if (!client?.serverId || resolvedByServer.has(String(client.serverId))) continue;
      resolvedByServer.set(String(client.serverId), { client, source: 'config' });
      linkedClientsForMatching.push(client);
    } catch (error) {
      log.warn('Failed to resolve config link for live panel mutation', {
        recordId: String(record._id || ''),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  for (const subLink of stringArray(record.serverSubLinks)) {
    try {
      const client = await findClientBySubIdAcrossServers(extractSubId(subLink), subLink) as ResolvedPanelClient | null;
      if (!client?.serverId || resolvedByServer.has(String(client.serverId))) continue;
      resolvedByServer.set(String(client.serverId), { client, source: 'sub' });
      linkedClientsForMatching.push(client);
    } catch (error) {
      log.warn('Failed to resolve sub link for live panel mutation', {
        recordId: String(record._id || ''),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  for (const [serverId, resolved] of resolvedByServer) {
    const server = serverById.get(serverId);
    if (!server) continue;
    actions.push(await mutateClient(server, resolved.client, mutation, updates, resolved.source));
  }

  for (const server of enabledServers) {
    if (resolvedByServer.has(server.id)) continue;

    try {
      const clients = (await listServerClients(server.id) || []) as ResolvedPanelClient[];
      const matches = clients.filter((client) =>
        isMultiServerClientEmailMatch(String(client.email || ''), record, server, linkedClientsForMatching)
      );

      const selected = chooseSingleCandidate(matches);
      if (selected) {
        actions.push(await mutateClient(server, selected.client, mutation, updates, 'name', selected.note));
        continue;
      }

      actions.push({
        serverId: server.id,
        serverName: server.name,
        mutation,
        status: 'skipped',
        source: 'name',
        message: matches.length > 1
          ? 'Multiple matching live clients found; skipped to avoid touching the wrong 3xUI client'
          : 'No linked or matching live 3xUI client found on this server',
      });
    } catch (error) {
      actions.push({
        serverId: server.id,
        serverName: server.name,
        mutation,
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    source: '3xui',
    webDbKeyFieldsChanged: false,
    mutation,
    summary: summarize(actions),
    actions,
  };
}
