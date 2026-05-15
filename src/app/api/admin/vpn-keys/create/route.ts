import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import { getEnabledServers } from '@/lib/vpn-servers';
import { provisionVpnKey } from '@/lib/xui';
import { logActivity } from '@/models/ActivityLog';

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate Admin
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, protocol = 'vless' } = body;
    let { days = 30, deviceLimit = 2 } = body;

    days = Number(days);
    deviceLimit = Number(deviceLimit);

    if (!name) {
      return NextResponse.json({ error: 'Key name is required' }, { status: 400 });
    }

    await connectDB();

    // 2. Provision Keys on ALL active servers
    const activeServers = await getEnabledServers();
    if (activeServers.length === 0) {
      return NextResponse.json({ error: 'No active VPN servers available' }, { status: 503 });
    }

    const multiServerLinks: string[] = [];
    const sanitizedName = name.replace(/\s+/g, '-').slice(0, 20);
    const prefix = `web_${crypto.randomUUID().slice(0, 4)}_${sanitizedName}`;

    for (const server of activeServers) {
      try {
        const username = prefix + '_' + server.name.replace(/\s+/g, '-');
        
        const keyData = await provisionVpnKey({
          serverId: server.id,
          username,
          userId: 'admin_web',
          devices: deviceLimit,
          expiryDays: days,
          dataLimitGB: 0,
          protocol
        });

        if (keyData && keyData.subLink) {
          multiServerLinks.push(keyData.subLink);
        }
      } catch (err) {
        console.error(`Failed to provision key on server ${server.id}:`, err);
        // Continue with other servers even if one fails
      }
    }

    if (multiServerLinks.length === 0) {
      return NextResponse.json({ error: 'Failed to provision keys on any active server' }, { status: 500 });
    }

    // 3. Log Activity
    await logActivity({
      admin: user.id || 'unknown',
      action: 'vpn_key_generated' as any,
      details: `Admin via Web generated multi-server VPN key "${name}" for ${days} days, limit ${deviceLimit} IP. Configured on ${multiServerLinks.length} servers.`
    });

    return NextResponse.json({
      success: true,
      message: `Successfully created key on ${multiServerLinks.length} servers`,
      subLinks: multiServerLinks
    });
  } catch (error: any) {
    console.error('Error creating admin VPN key:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create VPN key' },
      { status: 500 }
    );
  }
}
