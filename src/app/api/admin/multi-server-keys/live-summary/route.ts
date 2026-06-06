import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import dbConnect from '@/lib/mongodb';
import { createLogger } from '@/lib/logger';
import { getEnabledServers, type VpnServer } from '@/lib/vpn-servers';
import { listServerClients } from '@/lib/xui';
import { isMultiServerClientEmailMatch } from '@/lib/multi-server-key-match';

const log = createLogger({ route: '/api/admin/multi-server-keys/live-summary' });

type VpnKeyRecordLike = Record<string, unknown> & {
  _id: mongoose.Types.ObjectId;
  serverSubLinks?: unknown;
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
  subId: string;
};

type ResolvedLiveClient = ListedClient & {
  serverId: string;
  serverName: string;
  source: 'sub' | 'name';
};

function toObjectIds(ids: unknown): mongoose.Types.ObjectId[] {
  if (!Array.isArray(ids)) return [];
  return ids
    .map((value) => {
      try {
        return new mongoose.Types.ObjectId(String(value));
      } catch {
        return null;
      }
    })
    .filter((value): value is mongoose.Types.ObjectId => Boolean(value));
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseSubIds(record: VpnKeyRecordLike): Set<string> {
  const links = Array.isArray(record.serverSubLinks) ? record.serverSubLinks.map(String) : [];
  const subIds = new Set<string>();

  for (const link of links) {
    try {
      const raw = link.trim();
      const parsed = raw.includes('://') ? new URL(raw) : null;
      const path = parsed ? `${parsed.pathname}${parsed.search}` : raw;
      const match = path.match(/(?:\/api\/vpn)?\/sub\/([a-zA-Z0-9-]{8,64})/i);
      if (match) subIds.add(match[1].toLowerCase());
    } catch {
      const match = link.match(/(?:\/api\/vpn)?\/sub\/([a-zA-Z0-9-]{8,64})/i);
      if (match) subIds.add(match[1].toLowerCase());
    }
  }

  return subIds;
}

function snapshotClient(client: ListedClient, server: VpnServer, source: ResolvedLiveClient['source']): ResolvedLiveClient {
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
    serverId: server.id,
    serverName: server.name,
    source,
  };
}

function chooseMatchedClient(matches: ListedClient[]): ListedClient | null {
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  const enabled = matches.filter((client) => client.enable !== false);
  if (enabled.length === 1) return enabled[0];

  const withSubId = matches.filter((client) => String(client.subId || '').trim());
  if (withSubId.length === 1) return withSubId[0];

  return null;
}

function representative(clients: ResolvedLiveClient[]) {
  const active = clients.find((client) =>
    client.enable !== false && (client.expiryTime <= 0 || client.expiryTime > Date.now())
  );
  return active || clients.find((client) => client.enable !== false) || clients[0] || null;
}

function isConsistent(clients: ResolvedLiveClient[]) {
  if (clients.length <= 1) return true;
  const values = clients.map((client) => [
    client.expiryTime,
    client.limitIp,
    client.totalGB,
    client.enable !== false,
  ].join(':'));
  return new Set(values).size <= 1;
}

function statusFromClient(client: ResolvedLiveClient | null) {
  if (!client) return 'unknown';
  if (client.enable === false) return 'disabled';
  if (client.expiryTime > 0 && client.expiryTime < Date.now()) return 'expired';
  return 'active';
}

function buildRecordSummary(record: VpnKeyRecordLike, servers: VpnServer[], clientsByServer: Map<string, ListedClient[]>) {
  const subIds = parseSubIds(record);
  const resolved: ResolvedLiveClient[] = [];

  for (const server of servers) {
    const clients = clientsByServer.get(server.id) || [];
    const bySubId = chooseMatchedClient(
      clients.filter((client) => subIds.has(String(client.subId || '').toLowerCase()))
    );

    if (bySubId) {
      const snapshot = snapshotClient(bySubId, server, 'sub');
      resolved.push(snapshot);
      continue;
    }

    const byName = chooseMatchedClient(
      clients.filter((client) =>
        isMultiServerClientEmailMatch(String(client.email || ''), record, server, resolved)
      )
    );

    if (byName) {
      resolved.push(snapshotClient(byName, server, 'name'));
    }
  }

  const main = representative(resolved);

  return {
    recordId: String(record._id),
    generatedAt: new Date().toISOString(),
    resolvedServers: resolved.length,
    totalServers: servers.length,
    consistent: isConsistent(resolved),
    status: statusFromClient(main),
    devices: main ? main.limitIp : null,
    expiryTime: main ? main.expiryTime : null,
    dataLimitBytes: main ? main.totalGB : null,
    usedBytes: main ? main.up + main.down : null,
    sourceServerName: main?.serverName || '',
    clients: resolved.map((client) => ({
      serverId: client.serverId,
      serverName: client.serverName,
      source: client.source,
      email: client.email,
      enable: client.enable,
      expiryTime: client.expiryTime,
      limitIp: client.limitIp,
      totalGB: client.totalGB,
      up: client.up,
      down: client.down,
      subId: client.subId,
    })),
  };
}

export async function POST(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const objectIds = toObjectIds(body.ids).slice(0, 50);

    if (objectIds.length === 0) {
      return NextResponse.json({ success: true, data: { summaries: {} } });
    }

    const mongooseConn = await dbConnect();
    const db = mongooseConn.connection.getClient().db();
    const records = await db.collection('vpn_keys')
      .find({ _id: { $in: objectIds } })
      .toArray() as VpnKeyRecordLike[];
    const servers = await getEnabledServers();
    const clientsByServer = new Map<string, ListedClient[]>();

    await Promise.all(servers.map(async (server) => {
      try {
        clientsByServer.set(server.id, (await listServerClients(server.id) || []) as ListedClient[]);
      } catch (error) {
        log.warn('Failed to load live clients for summary', {
          serverId: server.id,
          error: error instanceof Error ? error.message : String(error),
        });
        clientsByServer.set(server.id, []);
      }
    }));

    const summaries: Record<string, ReturnType<typeof buildRecordSummary>> = {};
    for (const record of records) {
      const summary = buildRecordSummary(record, servers, clientsByServer);
      summaries[summary.recordId] = summary;
    }

    return NextResponse.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        serverCalls: servers.length,
        recordCount: records.length,
        summaries,
      },
    });
  } catch (error) {
    log.error('Admin multi-server live summary error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: 'Failed to load live 3xUI summary' }, { status: 500 });
  }
}
