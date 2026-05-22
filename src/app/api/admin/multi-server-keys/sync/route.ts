import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import dbConnect from '@/lib/mongodb';
import { createLogger } from '@/lib/logger';
import { findClientByConfigLinkAcrossServers, findClientBySubIdAcrossServers, updateVpnClient, provisionVpnKey, listServerClients } from '@/lib/xui';
import { getEnabledServers } from '@/lib/vpn-servers';
import crypto from 'crypto';
import mongoose from 'mongoose';

const log = createLogger({ route: '/api/admin/multi-server-keys/sync' });

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
    const { id } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing record id' }, { status: 400 });
    }

    const m = await dbConnect();
    const db = m.connection.getClient().db();
    const objectId = new mongoose.Types.ObjectId(id);

    const record = await db.collection('vpn_keys').findOne({ _id: objectId });
    if (!record) {
      return NextResponse.json({ success: false, error: 'Record not found' }, { status: 404 });
    }

    const { expiryTime, dataLimitGB, status, devices, protocol, username, token } = record;

    const enabledServers = await getEnabledServers();
    if (enabledServers.length === 0) {
      return NextResponse.json({ success: false, error: 'No active VPN servers available' }, { status: 503 });
    }

    const cfgLinks: string[] = Array.isArray(record.serverConfigLinks) ? [...record.serverConfigLinks] : [];
    const subLinks: string[] = Array.isArray(record.serverSubLinks) ? [...record.serverSubLinks] : [];
    const targetUsername = String(record.username || '').trim();
    const targetDeviceLabel = `${devices || 1}D`;
    const targetBaseName = targetUsername ? `${targetUsername} - ${targetDeviceLabel}` : '';

    // First, find which servers we already have a client on
    const existingServerIds = new Set<string>();
    const existingClients = [];

    // Map existing clients and update them
    const resolveTasks = [];
    for (const cfg of cfgLinks) {
      resolveTasks.push((async () => {
        try {
          const client = await findClientByConfigLinkAcrossServers(String(cfg));
          if (client && client.serverId) {
            existingServerIds.add(client.serverId.toString());
            existingClients.push(client);
            // Sync it
            const cAny = client as any;
            const clientEmail = client.email || cAny.clientEmail || cAny.client || cAny.clientId;
            if (clientEmail) {
              const panelUpdates: any = {};
              if (expiryTime !== undefined) panelUpdates.expiryTime = expiryTime as number;
              if (dataLimitGB !== undefined) panelUpdates.dataLimitGB = dataLimitGB as number;
              if (devices !== undefined) panelUpdates.devices = devices as number;
              if (status !== undefined) panelUpdates.enable = status === 'active';
              await updateVpnClient(client.serverId, clientEmail, panelUpdates);
            }
          }
        } catch (err) {
          log.warn('Sync existing config failed', { recordId: id, cfg, err: err instanceof Error ? err.message : String(err) });
        }
      })());
    }

    for (const sub of subLinks) {
      resolveTasks.push((async () => {
        try {
          let tokenStr = String(sub);
          const urlPart = tokenStr.includes('://') ? new URL(tokenStr).pathname + new URL(tokenStr).search : tokenStr;
          const match = urlPart.match(/(?:\/api\/vpn)?\/sub\/([a-zA-Z0-9-]{8,64})/i);
          tokenStr = match ? match[1] : tokenStr;

          const client = await findClientBySubIdAcrossServers(tokenStr, String(sub));
          if (client && client.serverId) {
            existingServerIds.add(client.serverId.toString());
            existingClients.push(client);
            const cAny = client as any;
            const clientEmail = client.email || cAny.clientEmail || cAny.client || cAny.clientId;
            if (clientEmail) {
              const panelUpdates: any = {};
              if (expiryTime !== undefined) panelUpdates.expiryTime = expiryTime as number;
              if (dataLimitGB !== undefined) panelUpdates.dataLimitGB = dataLimitGB as number;
              if (devices !== undefined) panelUpdates.devices = devices as number;
              if (status !== undefined) panelUpdates.enable = status === 'active';
              await updateVpnClient(client.serverId, clientEmail, panelUpdates);
            }
          }
        } catch (err) {
          log.warn('Sync existing sub failed', { recordId: id, sub, err: err instanceof Error ? err.message : String(err) });
        }
      })());
    }

    await Promise.allSettled(resolveTasks);

    // Now, provision new keys on missing servers
    let newsAdded = 0;
    const msRemaining = expiryTime && expiryTime > 0 ? (expiryTime - Date.now()) : 0;
    const days = msRemaining > 0 ? Math.max(1, Math.ceil(msRemaining / (24 * 60 * 60 * 1000))) : 0;

    const provisionTasks = enabledServers.map(async (server) => {
      if (existingServerIds.has(server.id.toString())) return null; // Already exists
      try {
        const sanitizedName = (username || 'user').replace(/\s+/g, '-').slice(0, 20);
        const prefix = `sync_${crypto.randomBytes(2).toString('hex')}_${sanitizedName}`;
        const finalUsername = `${prefix}_${server.name.replace(/\s+/g, '-')}`;

        const keyData = await provisionVpnKey({
          serverId: server.id,
          userId: record.userId || 'admin_sync',
          devices: devices || 1,
          expiryDays: days,
          dataLimitGB: dataLimitGB || 0,
          protocol: protocol || 'trojan',
          username: finalUsername,
        });

        if (keyData && keyData.success) {
          return { serverName: server.name, subLink: keyData.subLink, configLink: keyData.configLink };
        }
        return null;
      } catch (err) {
        log.error(`Failed to provision on missing server ${server.id}`, { err: err instanceof Error ? err.message : String(err) });
        return null;
      }
    });

    const results = await Promise.all(provisionTasks);
    for (const res of results) {
      if (res) {
        newsAdded++;
        if (res.subLink && !subLinks.includes(res.subLink)) subLinks.push(res.subLink);
        if (res.configLink && !cfgLinks.includes(res.configLink)) cfgLinks.push(res.configLink);
      }
    }

    if (newsAdded > 0) {
      await db.collection('vpn_keys').updateOne(
        { _id: objectId },
        { $set: { serverSubLinks: subLinks, serverConfigLinks: cfgLinks } }
      );
    }

    if (targetBaseName) {
      const unresolvedServers = enabledServers.filter((server) => !existingServerIds.has(server.id.toString()));
      for (const server of unresolvedServers) {
        try {
          const clients = await listServerClients(server.id);
          const matched = (clients || []).filter((client: any) => {
            const email = String(client.email || '').trim();
            return email === targetBaseName || email.startsWith(`${targetBaseName} Key`);
          });

          for (const client of matched) {
            const cAny = client as any;
            const clientEmail = client.email || cAny.clientEmail || cAny.client || cAny.clientId;
            if (!clientEmail) continue;

            const panelUpdates: any = {};
            if (expiryTime !== undefined) panelUpdates.expiryTime = expiryTime as number;
            if (dataLimitGB !== undefined) panelUpdates.dataLimitGB = dataLimitGB as number;
            if (devices !== undefined) panelUpdates.devices = devices as number;
            if (status !== undefined) panelUpdates.enable = status === 'active';
            await updateVpnClient(server.id, clientEmail, panelUpdates);
          }
        } catch (err) {
          log.warn('Fallback name-based sync failed', { recordId: id, serverId: server.id, err: err instanceof Error ? err.message : String(err) });
        }
      }
    }

    return NextResponse.json({ success: true, message: `Synced existing nodes and added API to ${newsAdded} new servers` });
  } catch (error) {
    log.error('Admin sync error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false, error: 'Failed to sync record' }, { status: 500 });
  }
}
