import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { getEnabledServers } from '@/lib/vpn-servers';
import { findClientByConfigLinkAcrossServers, findClientBySubIdAcrossServers, listServerClients, provisionVpnKey, revokeVpnKey } from '@/lib/xui';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

interface MigrationOldKey {
  token: string;
  username: string;
  devices: number;
  expiryTime: number;
  dataLimitGB: number;
  protocol: string;
  userId: string;
  oldServerId?: string;
  oldClientEmail?: string | null;
  oldClientId?: string | null;
}

async function findStoredMigrationRecord(db: any, input: string) {
  const value = input.trim();
  if (!value) return null;

  const subLinkMatch = value.match(/\/(?:api\/vpn\/)?sub\/([a-zA-Z0-9-]{8,64})/i);
  const token = subLinkMatch ? subLinkMatch[1] : value;

  return db.collection('vpn_keys').findOne({
    $or: [
      { token: value },
      { token },
      { migratedFromToken: token },
      { serverConfigLinks: value },
      { serverSubLinks: value },
      { serverConfigLinks: token },
      { serverSubLinks: token },
    ],
  });
}

// ==========================================
// POST /api/migration/upgrade
// Migrates an old single-server VPN key to a new multi-server key.
// Body: { oldKey: "<sub-link or token>" }
//
// Steps:
//   1. Verify the old key exists and is valid.
//   2. Provision new keys on all enabled servers.
//   3. Save new multi-server vpn_keys record.
//   4. DELETE the old key from the database.
//   5. Return the new sub-link.
// ==========================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const oldKeyInput: string = (body.oldKey ?? '').trim();

    if (!oldKeyInput) {
      return NextResponse.json({ error: 'Missing oldKey in request body' }, { status: 400 });
    }

    const configLinkMatch = oldKeyInput.match(/^(vmess|vless|trojan|ss):\/\//i);
    let token = oldKeyInput;
    if (!configLinkMatch) {
      const subLinkMatch = oldKeyInput.match(/\/(?:api\/vpn\/)?sub\/([a-zA-Z0-9-]{8,64})/i);
      if (subLinkMatch) {
        token = subLinkMatch[1];
      }

      if (!token || !/^[a-zA-Z0-9-]{8,64}$/i.test(token)) {
        return NextResponse.json(
          { error: 'Invalid key format. Please provide a valid config link, sub-link or token.' },
          { status: 400 }
        );
      }
    }

    const mongoose = await connectDB();
    const db = mongoose.connection.getClient().db();

    if (configLinkMatch) {
      const storedRecord = await findStoredMigrationRecord(db, oldKeyInput);
      if (storedRecord) {
        if (storedRecord.keyType === 'migrated_web' || storedRecord.is_migrated === true) {
          return NextResponse.json(
            { error: 'This key has already been migrated to the new multi-server format.' },
            { status: 409 }
          );
        }
      }
    }

    // Prevent attempting to migrate an already-migrated or generated multi-server token
    const existingCheck = await db.collection('vpn_keys').findOne({ token });
    if (existingCheck) {
      if (existingCheck.is_migrated === true) {
        return NextResponse.json(
          { error: 'This key has already been migrated to the new multi-server format.' },
          { status: 409 }
        );
      } else {
        return NextResponse.json(
          { error: 'Provided key is already a multi-server subscription and cannot be migrated.' },
          { status: 400 }
        );
      }
    }


    let oldKey: MigrationOldKey | null = null;
    let shouldRollbackClaim = false;

    if (!configLinkMatch) {
      // --- Security: try to create a lock so parallel requests fail ---
      try {
        await db.collection('vpn_keys').insertOne({
          token,
          keyType: 'migration_lock',
          is_migrated: true,
          migratingAt: new Date()
        });
        shouldRollbackClaim = true;
      } catch (e) {
        // If insert fails due to unique index, handle it. But MongoDB might not have unique index on token.
        // The earlier existingCheck covers the normal sequential case.
      }

        const panelClient = await findClientBySubIdAcrossServers(token, oldKeyInput);
        if (!panelClient) {
            if (shouldRollbackClaim) await db.collection('vpn_keys').deleteOne({ token, keyType: 'migration_lock' });
              return NextResponse.json(
                { error: 'Key not found. Please check your sub-link and try again.' },
                { status: 404 }
              );
            }

        const dataLimitGB = panelClient.totalGB ? Math.floor(panelClient.totalGB / 1024 / 1024 / 1024) : 0;
        const userId = panelClient.tgId || 'migration_web';
        const username = panelClient.email || 'migration_user';
        const devices = panelClient.limitIp || 1;
        const expiryTime = panelClient.expiryTime || Date.now() + 30 * 24 * 60 * 60 * 1000;
        const protocol = panelClient.protocol || 'trojan';

        oldKey = {
            token,
            username,
            devices,
            expiryTime,
            dataLimitGB,
            protocol,
            userId,
            oldServerId: panelClient.serverId,
            oldClientEmail: panelClient.email || panelClient.clientId,
            oldClientId: panelClient.clientId || panelClient.clientPassword || null,
          };
    } else {
      const panelClient = await findClientByConfigLinkAcrossServers(oldKeyInput);
      if (!panelClient) {
        return NextResponse.json(
          { error: 'Key not found. Please check your config link and try again.' },
          { status: 404 }
        );
      }

      const dataLimitGB = panelClient.totalGB ? Math.floor(panelClient.totalGB / 1024 / 1024 / 1024) : 0;
      const userId = panelClient.tgId || 'migration_web';
      const username = panelClient.email || 'migration_user';
      const devices = panelClient.limitIp || 1;
      const expiryTime = panelClient.expiryTime || Date.now() + 30 * 24 * 60 * 60 * 1000;
      const protocol = panelClient.protocol || 'trojan';

      oldKey = {
        token: oldKeyInput,
        username,
        devices,
        expiryTime,
        dataLimitGB,
        protocol,
        userId,
        oldServerId: panelClient.serverId,
        oldClientEmail: panelClient.email || panelClient.clientId,
        oldClientId: panelClient.clientId || panelClient.clientPassword || null,
      };
    }

    if (!oldKey) {
      return NextResponse.json({ error: 'Key not found.' }, { status: 404 });
    }

    // Check expiry
    if (oldKey.expiryTime && Date.now() > oldKey.expiryTime) {
      if (shouldRollbackClaim) {
        await db.collection('vpn_keys').deleteOne({ token, keyType: 'migration_lock' });
      }
      return NextResponse.json(
        { error: 'This key has already expired and cannot be migrated.' },
        { status: 410 }
      );
    }

    // Prevent duplicate migration: check DB for any migrated record that references
    // this client by token, sub link, client id, or client email.
    try {
      const duplicateQuery: any[] = [];
      if (token) duplicateQuery.push({ migratedFromToken: token });
      if (oldKey.oldClientId) duplicateQuery.push({ migratedFromClientId: String(oldKey.oldClientId) });
      if (oldKey.oldClientEmail) duplicateQuery.push({ migratedFromClientEmail: String(oldKey.oldClientEmail) });
      // Also check serverSubLinks / serverConfigLinks containing token
      if (token) {
        duplicateQuery.push({ serverSubLinks: { $elemMatch: { $regex: String(token), $options: 'i' } } });
        duplicateQuery.push({ serverConfigLinks: { $elemMatch: { $regex: String(token), $options: 'i' } } });
      }

      if (duplicateQuery.length > 0) {
        const already = await db.collection('vpn_keys').findOne({ $or: duplicateQuery });
        if (already) {
          if (shouldRollbackClaim) await db.collection('vpn_keys').deleteOne({ token, keyType: 'migration_lock' });
          return NextResponse.json(
            { error: 'This key has already been converted to the multi-server format and cannot be migrated again.' },
            { status: 409 }
          );
        }
      }
    } catch (err) {
      console.warn('[migration/upgrade] duplicate detection failed', String(err));
    }

    const username: string = oldKey.username || 'user';
    const devices: number = Number(oldKey.devices) || 1;
    const expiryTime: number = oldKey.expiryTime || Date.now() + 30 * 24 * 60 * 60 * 1000;
    const dataLimitGB: number = Number(oldKey.dataLimitGB) || 0;
    const protocol: string = oldKey.protocol || 'trojan';

    const msRemaining = expiryTime - Date.now();
    const days = Math.max(1, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));

    // --- Provision new keys on all enabled servers ---
    const targetServers = await getEnabledServers();
    if (targetServers.length === 0) {
      if (shouldRollbackClaim) await db.collection('vpn_keys').deleteOne({ token, keyType: 'migration_lock' });
      return NextResponse.json({ error: 'No active VPN servers available' }, { status: 503 });
    }

    const sanitizedName = username.replace(/\s+/g, '-').slice(0, 20);
    const prefix = `mig_${crypto.randomBytes(2).toString('hex')}_${sanitizedName}`;
    const newToken = crypto.randomBytes(16).toString('hex');
    const newSubLink = `https://burmesedigital.store/api/vpn/sub/${newToken}`;

    const serverSubLinks: string[] = [];
    const serverConfigLinks: string[] = [];
    const successServerNames: string[] = [];

    const provisionPromises = targetServers.map(async (server) => {
      try {
        const finalUsername = `${prefix}_${server.name.replace(/\s+/g, '-')}`;
        const keyData = await provisionVpnKey({
          serverId: server.id,
          userId: 'migration_web',
          devices,
          expiryDays: days,
          dataLimitGB,
          protocol,
          username: finalUsername,
        });
        if (keyData && keyData.success) {
          return { serverName: server.name, subLink: keyData.subLink, configLink: keyData.configLink };
        }
        return null;
      } catch (err) {
        console.error(`[migration/upgrade] Failed to provision on server ${server.id}:`, err);
        return null;
      }
    });

    const results = await Promise.all(provisionPromises);
    for (const res of results) {
      if (res) {
        successServerNames.push(res.serverName);
        serverSubLinks.push(res.subLink);
        if (res.configLink) serverConfigLinks.push(res.configLink);
      }
    }

    if (successServerNames.length === 0) {
      if (shouldRollbackClaim) await db.collection('vpn_keys').deleteOne({ token, keyType: 'migration_lock' });
      return NextResponse.json(
        { error: 'Failed to provision new keys on any active server. Please try again later.' },
        { status: 500 }
      );
    }

    // --- Save new multi-server key record ---
    await db.collection('vpn_keys').insertOne({
      userId: oldKey.userId || 'migration_web',
      token: newToken,
      username: sanitizedName,
      keyType: 'migrated_web',
      protocol,
      devices,
      expiryDays: days,
      expiryTime,
      dataLimitGB,
      createdAt: new Date(),
      status: 'active',
      serverSubLinks,
      serverConfigLinks,
      migratedFromToken: token,
      migratedFromClientId: oldKey.oldClientId || null,
      migratedFromClientEmail: oldKey.oldClientEmail || null,
    });

    // Mark any existing records that reference the original token as migrated
    try {
      const updateQuery: any = {
        $or: [
          { token },
          { migratedFromToken: token },
          { serverSubLinks: { $elemMatch: { $regex: String(token), $options: 'i' } } },
          { serverConfigLinks: { $elemMatch: { $regex: String(token), $options: 'i' } } },
        ],
      };
      await db.collection('vpn_keys').updateMany(updateQuery, {
        $set: { is_migrated: true, migratedTo: newToken, migratedAt: new Date() },
      });
    } catch (err) {
      console.warn('[migration/upgrade] failed to mark original keys as migrated', String(err));
    }

    // --- CRITICAL: Attempt to revoke any matching old clients from all enabled panels.
    try {
      const enabledServers = await getEnabledServers();
      const revokeMatches: Array<{ serverId: string; clientEmail: string | null }> = [];

      // Helper to inspect clients on a server and collect matches
      for (const s of enabledServers) {
        try {
          const clients = await listServerClients(s.id);
          if (!clients) continue;

          for (const c of clients) {
            const cEmail = c.email || c.clientId || null;
            const cId = (c.clientId || c.clientPassword || '').toString();
            const cSub = (c.subId || '').toString();

            // Match by any of: oldClientEmail, oldClientId, token/subId
            if (
              (oldKey.oldClientEmail && cEmail && String(cEmail) === String(oldKey.oldClientEmail)) ||
              (oldKey.oldClientId && cId && cId.toLowerCase() === String(oldKey.oldClientId).toLowerCase()) ||
              (String(cSub).toLowerCase() === String(token).toLowerCase())
            ) {
              revokeMatches.push({ serverId: s.id, clientEmail: cEmail ?? null });
            }
          }
        } catch (err) {
          console.warn('[migration/upgrade] Failed to list clients for server', s.id, String(err));
          continue;
        }
      }

      // Deduplicate by serverId+clientEmail
      const unique = new Map<string, { serverId: string; clientEmail: string | null }>();
      for (const r of revokeMatches) {
        const keyStr = `${r.serverId}::${r.clientEmail}`;
        if (!unique.has(keyStr)) unique.set(keyStr, r);
      }

      for (const entry of unique.values()) {
        if (entry.clientEmail) {
          try {
            const ok = await revokeVpnKey(entry.serverId, entry.clientEmail);
            if (!ok) console.warn('[migration/upgrade] revoke returned false', entry.serverId, entry.clientEmail);
          } catch (err) {
            console.warn('[migration/upgrade] revoke error', entry.serverId, entry.clientEmail, String(err));
          }
        }
      }
    } catch (err) {
      console.warn('[migration/upgrade] Failed to revoke old key on panels', String(err));
    }

    if (shouldRollbackClaim) {
      await db.collection('vpn_keys').deleteOne({ token, keyType: 'migration_lock' });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully migrated key to ${successServerNames.length} servers`,
      data: {
        subLink: newSubLink,
        servers: successServerNames,
        username: sanitizedName,
        devices,
        expiryTime,
        remainingDays: days,
        protocol,
      },
    });
  } catch (error) {
    console.error('[migration/upgrade] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
