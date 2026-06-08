import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import dbConnect from '@/lib/mongodb';
import { createLogger } from '@/lib/logger';
import { findClientByConfigLinkAcrossServers, findClientBySubIdAcrossServers, listServerClients, type XuiClientInfo } from '@/lib/xui';
import { getEnabledServers } from '@/lib/vpn-servers';
import { isMultiServerClientEmailMatch } from '@/lib/multi-server-key-match';

const log = createLogger({ route: '/api/admin/multi-server-keys/details' });

type ResolvedClient = {
  serverId: string;
  serverName: string;
  source: 'config' | 'sub' | 'name';
  link?: string;
  client: XuiClientInfo;
};

function toObjectId(id: string) {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return null;
  }
}

function normalizeUrlToken(value?: string): string {
  if (!value) return '';
  const raw = String(value).trim();
  const urlPart = raw.includes('://') ? (() => {
    try {
      const url = new URL(raw);
      return `${url.pathname}${url.search}`;
    } catch {
      return raw;
    }
  })() : raw;
  const match = urlPart.match(/(?:\/api\/vpn)?\/sub\/([a-zA-Z0-9-]{8,64})/i);
  return (match ? match[1] : raw).trim();
}

export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id')?.trim() || '';
    const objectId = toObjectId(id);

    if (!objectId) {
      return NextResponse.json({ success: false, error: 'Missing or invalid record id' }, { status: 400 });
    }

    const mongooseConn = await dbConnect();
    const db = mongooseConn.connection.getClient().db();
    const record = await db.collection('vpn_keys').findOne({ _id: objectId });

    if (!record) {
      return NextResponse.json({ success: false, error: 'Record not found' }, { status: 404 });
    }

    const enabledServers = await getEnabledServers();
    const resolved = new Map<string, ResolvedClient>();
    const unresolvedLinks: string[] = [];

    const pushResolved = (payload: ResolvedClient) => {
      const existing = resolved.get(payload.serverId);
      if (!existing || payload.source === 'config' || existing.source === 'name') {
        resolved.set(payload.serverId, payload);
      }
    };

    const tryResolveByServerName = async (serverId: string) => {
      const server = enabledServers.find((s) => s.id === serverId);
      if (!server || resolved.has(server.id)) return;

      try {
        const clients = await listServerClients(server.id);
        if (!clients) return;

        const matched = clients.find((client: any) => {
          const email = String(client.email || '').trim();
          return isMultiServerClientEmailMatch(email, record, server, Array.from(resolved.values()).map((item) => item.client));
        });

        if (matched) {
          pushResolved({
            serverId: server.id,
            serverName: server.name,
            source: 'name',
            client: {
              ...matched,
              serverId: server.id,
              serverName: server.name,
            } as XuiClientInfo,
          });
        }
      } catch (error) {
        log.warn('Failed to resolve client by server name', {
          serverId: server.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    const cfgLinks: string[] = Array.isArray(record.serverConfigLinks) ? record.serverConfigLinks : [];
    const subLinks: string[] = Array.isArray(record.serverSubLinks) ? record.serverSubLinks : [];

    for (const cfg of cfgLinks) {
      const client = await findClientByConfigLinkAcrossServers(String(cfg));
      if (client) {
        pushResolved({
          serverId: client.serverId,
          serverName: client.serverName,
          source: 'config',
          link: String(cfg),
          client,
        });
      } else {
        unresolvedLinks.push(String(cfg));
      }
    }

    for (const sub of subLinks) {
      const token = normalizeUrlToken(String(sub));
      const client = await findClientBySubIdAcrossServers(token, String(sub));
      if (client) {
        pushResolved({
          serverId: client.serverId,
          serverName: client.serverName,
          source: 'sub',
          link: String(sub),
          client,
        });
      } else {
        unresolvedLinks.push(String(sub));
      }
    }

    for (const server of enabledServers) {
      await tryResolveByServerName(server.id);
    }

    return NextResponse.json({
      success: true,
      data: {
        record: {
          ...record,
          _id: String(record._id),
        },
        clients: Array.from(resolved.values()),
        unresolvedLinks,
        summary: {
          resolvedServers: resolved.size,
          totalServers: enabledServers.length,
          totalLinks: cfgLinks.length + subLinks.length,
        },
      },
    });
  } catch (error) {
    log.error('Admin multi-server key details error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false, error: 'Failed to load key details' }, { status: 500 });
  }
}
