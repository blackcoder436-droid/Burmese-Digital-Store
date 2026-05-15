import fs from 'fs';

const routeContent = `import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import connectDB, { default as clientPromise } from '@/lib/mongodb';
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
    const { serverId = 'all', protocol = 'vless', username, devices = 2, expiryDays = 30, dataLimitGB = 0 } = body;

    const days = Number(expiryDays) || 30;
    const deviceLimit = Number(devices) || 2;
    const limitGB = Number(dataLimitGB) || 0;

    if (!username) {
      return NextResponse.json({ error: 'Key name (username) is required' }, { status: 400 });
    }

    await connectDB();

    let targetServers = [];
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
    const sanitizedName = username.replace(/\\s+/g, '-').slice(0, 20);
    const prefix = \`web_\${crypto.randomBytes(2).toString('hex')}_\${sanitizedName}\`;

    const token = crypto.randomBytes(16).toString('hex');
    const subLink = \`https://burmesedigital.store/api/vpn/sub/\${token}\`;

    for (const server of targetServers) {
      try {
        const finalUsername = serverId === 'all' ? prefix + '_' + server.name.replace(/\\s+/g, '-') : prefix;
        
        const keyData = await provisionVpnKey(
          server.id,
          (user.id || 'admin_web').toString(),
          deviceLimit,
          days,
          limitGB,
          protocol,
          finalUsername
        );

        if (keyData && keyData.success) {
          multiServerLinks.push(server.name);
        }
      } catch (err) {
        console.error(\`Failed to provision key on server \${server.id}:\`, err);
      }
    }

    if (multiServerLinks.length === 0) {
      return NextResponse.json({ error: 'Failed to provision keys on any active server' }, { status: 500 });
    }

    const client = await clientPromise;
    const db = client.db();
    await db.collection('vpn_keys').insertOne({
        userId: user.id || 'admin_web',
        token: token,
        username: sanitizedName,
        keyType: body.type || 'admin_web',
        protocol,
        devices: deviceLimit,
        expiryDays: days,
        dataLimitGB: limitGB,
        createdAt: new Date(),
        status: 'active'
    });

    await logActivity({
      admin: (user.id || 'unknown').toString(),
      action: 'vpn_key_generated' as any,
      details: \`Admin via Web generated \${serverId === 'all' ? 'multi-server' : 'single-server'} VPN key "\${sanitizedName}" for \${days} days. Configured on \${multiServerLinks.length} servers.\`
    });

    return NextResponse.json({
      success: true,
      message: \`Successfully created key on \${multiServerLinks.length} servers\`,
      data: {
        username: sanitizedName,
        subLink,
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
`;

fs.writeFileSync('src/app/api/admin/vpn-keys/create/route.ts', routeContent);
console.log('Fixed Web Admin Create Key API');
