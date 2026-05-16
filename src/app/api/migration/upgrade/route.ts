import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { getEnabledServers } from '@/lib/vpn-servers';
import { findClientByConfigLinkAcrossServers, findClientBySubIdAcrossServers, provisionVpnKey, revokeVpnKey } from '@/lib/xui';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

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

    let oldKey: Record<string, unknown> | null = null;
    let shouldRollbackClaim = false;

    if (!configLinkMatch) {
      // --- Security: atomic "claim" to prevent duplicate migrations ---
      // Use findOneAndUpdate to atomically set is_migrated flag before heavy provisioning.
      const claimResult = await db.collection('vpn_keys').findOneAndUpdate(
        { token, is_migrated: { $ne: true } },
        { $set: { is_migrated: true, migratingAt: new Date() } },
        { returnDocument: 'before' }
      );

      oldKey = claimResult && 'value' in claimResult ? (claimResult as any).value : claimResult;
      shouldRollbackClaim = true;

      if (!oldKey) {
        const existing = await db.collection('vpn_keys').findOne({ token });
        if (existing) {
          return NextResponse.json(
            { error: 'This key has already been migrated to the new multi-server format.' },
            { status: 409 }
          );
        }

        const panelClient = await findClientBySubIdAcrossServers(token, oldKeyInput);
        if (!panelClient) {
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
        };
      }
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
      };
    }

    // Check expiry
    if (oldKey.expiryTime && Date.now() > oldKey.expiryTime) {
      if (shouldRollbackClaim) {
        await db.collection('vpn_keys').updateOne({ token }, { $set: { is_migrated: false }, $unset: { migratingAt: '' } });
      }
      return NextResponse.json(
        { error: 'This key has already expired and cannot be migrated.' },
        { status: 410 }
      );
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
      // Roll back claim
      await db.collection('vpn_keys').updateOne({ token }, { $set: { is_migrated: false }, $unset: { migratingAt: '' } });
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
      // Roll back claim
      await db.collection('vpn_keys').updateOne({ token }, { $set: { is_migrated: false }, $unset: { migratingAt: '' } });
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
    });

    // --- CRITICAL: Revoke the old key from panels, then delete the old key from the database ---
    let revokeLog = '[migration/upgrade] Revoke attempt: ';
    try {
      // If original input was a config link or subId, try to locate and revoke on panels
      if (configLinkMatch) {
        revokeLog += 'Searching by config link...';
        const client = await findClientByConfigLinkAcrossServers(token);
        if (client && client.serverId && (client.email || client.clientEmail || client.clientId)) {
          const clientEmail = client.email || client.clientEmail || client.clientId;
          revokeLog += ` Found on server ${client.serverId}, email=${clientEmail}, revoking...`;
          const revoked = await revokeVpnKey(client.serverId, clientEmail);
          revokeLog += ` Revoke result: ${revoked}`;
        } else {
          revokeLog += ` Client not found (configLink=${token})`;
        }
      } else {
        // token may be subId
        revokeLog += 'Searching by subId...';
        const client = await findClientBySubIdAcrossServers(token);
        if (client && client.serverId && (client.email || client.clientEmail || client.clientId)) {
          const clientEmail = client.email || client.clientEmail || client.clientId;
          revokeLog += ` Found on server ${client.serverId}, email=${clientEmail}, revoking...`;
          const revoked = await revokeVpnKey(client.serverId, clientEmail);
          revokeLog += ` Revoke result: ${revoked}`;
        } else {
          revokeLog += ` Client not found (subId=${token})`;
        }
      }
      console.log(revokeLog);
    } catch (err) {
      revokeLog += ` ERROR: ${err instanceof Error ? err.message : String(err)}`;
      console.warn(revokeLog);
    }

    await db.collection('vpn_keys').deleteOne({ token });

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
