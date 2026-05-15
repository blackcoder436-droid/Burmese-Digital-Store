import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import clientPromise from '@/lib/mongodb';
import { getActiveServers, generateVpnUrl } from '@/lib/vpn-servers';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, protocol = 'vless' } = body;
    let { days = 30, deviceLimit = 2 } = body;
    
    days = Number(days);
    deviceLimit = Number(deviceLimit);

    const mongoClient = await clientPromise;
    const db = mongoClient.db();

    const activeServers = await getActiveServers();
    if (activeServers.length === 0) {
      return NextResponse.json({ error: 'No active VPN servers available' }, { status: 503 });
    }

    const multiServerLinks = [];
    const expiryTime = new Date().getTime() + (days * 24 * 60 * 60 * 1000);
    const token = uuidv4();
    const prefix = name ? name.replace(/\s+/g, '-') : `VIP-${Math.floor(Math.random() * 10000)}`;

    for (const server of activeServers) {
      try {
        const result = await generateVpnUrl({
          name: `${prefix}-${server.country}`,
          protocol: protocol,
          days: days,
          limitIp: deviceLimit,
          serverName: server.name 
        });

        if (result && result.subLink) {
          multiServerLinks.push({
            server: server.name,
            subLink: result.subLink,
            configLink: result.configLink
          });
        }
      } catch (err: any) {
        console.error('Target server failed', err.message);
      }
    }

    if (multiServerLinks.length === 0) {
      return NextResponse.json({ error: 'Failed to provision on any server' }, { status: 500 });
    }

    const newKey = {
      token, name: prefix, type: 'premium', status: 'active',
      duration: days * 24 * 60 * 60 * 1000, deviceLimit, protocol, dataLimit: 0,
      createdAt: new Date(), expiresAt: new Date(expiryTime), subLinks: multiServerLinks, createdBy: 'admin'
    };

    await db.collection('vpn_keys').insertOne(newKey);
    return NextResponse.json({ success: true, key: newKey });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
