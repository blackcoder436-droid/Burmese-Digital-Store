import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { getEnabledServers } from '@/lib/vpn-servers';
import { provisionVpnKey } from '@/lib/xui';
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

    // Extract token from URL or bare string. Support 3x-UI `/sub/{id}` links.
    let token = oldKeyInput;
    const subLinkMatch = oldKeyInput.match(/\/(?:api\/vpn\/)?sub\/([a-z0-9]+)/i);
    if (subLinkMatch) {
      token = subLinkMatch[1];
    }

    if (!token || !/^[a-z0-9]{8,64}$/i.test(token)) {
      return NextResponse.json(
        { error: 'Invalid key format. Please provide a valid sub-link or token.' },
        { status: 400 }
      );
    }

    const mongoose = await connectDB();
    const db = mongoose.connection.getClient().db();

    // --- Security: atomic "claim" to prevent duplicate migrations ---
    // Use findOneAndUpdate to atomically set is_migrated flag before heavy provisioning.
    const claimResult = await db.collection('vpn_keys').findOneAndUpdate(
      { token, is_migrated: { $ne: true } },
      { $set: { is_migrated: true, migratingAt: new Date() } },
      { returnDocument: 'before' }
    );

    const oldKey = claimResult;

    if (!oldKey) {
      // Either not found or already migrated
      const existing = await db.collection('vpn_keys').findOne({ token });
      if (!existing) {
        return NextResponse.json(
          { error: 'Key not found. Please check your sub-link and try again.' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'This key has already been migrated to the new multi-server format.' },
        { status: 409 }
      );
    }

    // Check expiry
    if (oldKey.expiryTime && Date.now() > oldKey.expiryTime) {
      // Roll back the claim flag since we won't proceed
      await db.collection('vpn_keys').updateOne({ token }, { $set: { is_migrated: false }, $unset: { migratingAt: '' } });
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

    // --- CRITICAL: Delete the old key from the database ---
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
