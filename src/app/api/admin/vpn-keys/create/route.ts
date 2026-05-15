import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import { getEnabledServers, getServer } from '@/lib/vpn-servers';
import { provisionVpnKey } from '@/lib/xui';
import { logActivity } from '@/models/ActivityLog';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const activeServers = await getEnabledServers();
    return NextResponse.json({
      success: true,
      data: { servers: activeServers }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { serverId = 'all', protocol = 'vless', username, devices = 2, expiryDays = 30, expiryDate, dataLimitGB = 0 } = body;

    // expiryDate takes precedence if provided (ISO date string or timestamp)
    let days = Number(expiryDays) || 30;
    let expiryTimeMs: number | undefined;
    if (expiryDate) {
      const parsed = typeof expiryDate === 'number' ? new Date(expiryDate) : new Date(String(expiryDate));
      if (!isNaN(parsed.getTime())) {
        expiryTimeMs = parsed.getTime();
        const msRemaining = expiryTimeMs - Date.now();
        if (msRemaining > 0) days = Math.max(1, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
      }
    }
    const deviceLimit = Number(devices) || 2;
    const limitGB = Number(dataLimitGB) || 0;

    if (!username) {
      return NextResponse.json({ error: 'Key name (username) is required' }, { status: 400 });
    }

    await connectDB();

    let targetServers: any[] = [];
    if (serverId === 'all') {
      targetServers = await getEnabledServers();
    } else {
      const s = await getServer(serverId);
      if (s) targetServers = [s];
    }

    if (targetServers.length === 0) {
      return NextResponse.json({ error: 'No active VPN servers available' }, { status: 503 });
    }

    const multiServerLinks: string[] = [];
    const serverSubLinks: string[] = [];
    const serverConfigLinks: string[] = [];
    const sanitizedName = username.replace(/\s+/g, '-').slice(0, 20);
    const prefix = `web_${crypto.randomBytes(2).toString('hex')}_${sanitizedName}`;

    const token = crypto.randomBytes(16).toString('hex');
    const masterSubLink = `https://burmesedigital.store/api/vpn/sub/${token}`;

    // Run in parallel to reduce loading time
    const provisionPromises = targetServers.map(async (server) => {
      try {
        const finalUsername = serverId === 'all' ? prefix + '_' + server.name.replace(/\s+/g, '-') : prefix;
        
        const keyData = await provisionVpnKey({
          serverId: server.id,
          userId: (user as any).id?.toString() || 'admin_web',
          devices: deviceLimit,
          expiryDays: days,
          dataLimitGB: limitGB,
          protocol,
          username: finalUsername
        });

        if (keyData && keyData.success) {
           return { serverName: server.name, subLink: keyData.subLink, configLink: keyData.configLink };
        }
        return null;
      } catch (err) {
        console.error(`Failed to provision key on server ${server.id}:`, err);
        return null;
      }
    });

    const results = await Promise.all(provisionPromises);
    
    // Process results
     for (const res of results) {
       if (res) {
         multiServerLinks.push(res.serverName);
         serverSubLinks.push(res.subLink);
         if (res.configLink) serverConfigLinks.push(res.configLink);
       }
     }

    if (multiServerLinks.length === 0) {
      return NextResponse.json({ error: 'Failed to provision keys on any active server' }, { status: 500 });
    }

    const mongoose = await import('mongoose');
    const db = mongoose.connection.getClient().db();
    
    const computedExpiryTimeMs = expiryTimeMs ?? (Date.now() + days * 24 * 60 * 60 * 1000);
    
    await db.collection('vpn_keys').insertOne({
        userId: (user as any).id || 'admin_web',
        token: token,
        username: sanitizedName,
        keyType: body.type || 'admin_web',
        protocol,
        devices: deviceLimit,
        expiryDays: days,
        expiryTime: computedExpiryTimeMs,
        dataLimitGB: limitGB,
        createdAt: new Date(),
        status: 'active',
      serverSubLinks, // Saving this so sub route can fetch configs
      serverConfigLinks // optional: direct config URIs (trojan://, vless://, etc.)
    });

    try {
      await logActivity({
        admin: (user as any).id,
        action: 'vpn_key_generated' as any,
        target: 'system',
        details: `Admin via Web generated ${serverId === 'all' ? 'multi-server' : 'single-server'} VPN key "${sanitizedName}" for ${days} days. Configured on ${multiServerLinks.length} servers.`
      });
    } catch(err) {
      console.warn("Could not log activity:", err);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully created key on ${multiServerLinks.length} servers`,
      data: {
        username: sanitizedName,
        subLink: masterSubLink,
        servers: multiServerLinks,
        protocol,
        devices: deviceLimit,
        expiryDays: days
      }
    });
  } catch (error: any) {
    console.error('Error creating admin VPN key:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create VPN key' },
      { status: 500 }
    );
  }
}
