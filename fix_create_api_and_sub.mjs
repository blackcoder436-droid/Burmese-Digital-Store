import fs from 'fs';

let createRoute = `import { NextRequest, NextResponse } from 'next/server';
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
    const { serverId = 'all', protocol = 'vless', username, devices = 2, expiryDays = 30, dataLimitGB = 0 } = body;

    const days = Number(expiryDays) || 30;
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
    const sanitizedName = username.replace(/\\s+/g, '-').slice(0, 20);
    const prefix = \`web_\${crypto.randomBytes(2).toString('hex')}_\${sanitizedName}\`;

    const token = crypto.randomBytes(16).toString('hex');
    const masterSubLink = \`https://burmesedigital.store/api/vpn/sub/\${token}\`;

    // Run in parallel to reduce loading time
    const provisionPromises = targetServers.map(async (server) => {
      try {
        const finalUsername = serverId === 'all' ? prefix + '_' + server.name.replace(/\\s+/g, '-') : prefix;
        
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
        console.error(\`Failed to provision key on server \${server.id}:\`, err);
        return null;
      }
    });

    const results = await Promise.all(provisionPromises);
    
    // Process results
    for (const res of results) {
       if (res) {
          multiServerLinks.push(res.serverName);
          serverSubLinks.push(res.subLink);
       }
    }

    if (multiServerLinks.length === 0) {
      return NextResponse.json({ error: 'Failed to provision keys on any active server' }, { status: 500 });
    }

    const mongoose = await import('mongoose');
    const db = mongoose.connection.getClient().db();
    
    const expiryTimeMs = Date.now() + days * 24 * 60 * 60 * 1000;
    
    await db.collection('vpn_keys').insertOne({
        userId: (user as any).id || 'admin_web',
        token: token,
        username: sanitizedName,
        keyType: body.type || 'admin_web',
        protocol,
        devices: deviceLimit,
        expiryDays: days,
        expiryTime: expiryTimeMs,
        dataLimitGB: limitGB,
        createdAt: new Date(),
        status: 'active',
        serverSubLinks  // Saving this so sub route can fetch configs
    });

    try {
      await logActivity({
        admin: ((user as any).id || 'unknown').toString(),
        action: 'vpn_key_generated' as any,
        target: 'system',
        details: \`Admin via Web generated \${serverId === 'all' ? 'multi-server' : 'single-server'} VPN key "\${sanitizedName}" for \${days} days. Configured on \${multiServerLinks.length} servers.\`
      });
    } catch(err) {
      console.warn("Could not log activity:", err);
    }

    return NextResponse.json({
      success: true,
      message: \`Successfully created key on \${multiServerLinks.length} servers\`,
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
`;

fs.writeFileSync('src/app/api/admin/vpn-keys/create/route.ts', createRoute);


let subRoute = `import { NextRequest, NextResponse } from 'next/server';
import connectDB, { default as clientPromise } from '@/lib/mongodb';
import Order from '@/models/Order';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token) return new NextResponse('Missing token', { status: 400 });

    await connectDB();

    // Check custom VPN keys collection first
    const client = await clientPromise;
    const adminKey = await client.db().collection('vpn_keys').findOne({ token });
    
    if (adminKey) {
      // Check expiry
      if (adminKey.expiryTime && Date.now() > adminKey.expiryTime) {
         return new NextResponse('Subscription expired', { status: 403 });
      }

      const configs: string[] = [];
      const subLinksToFetch: string[] = adminKey.serverSubLinks || [];
      
      // Fetch in parallel
      const fetchPromises = subLinksToFetch.map(async (subLink) => {
          if (!subLink) return [];
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(subLink, { signal: controller.signal, next: { revalidate: 300 } });
            clearTimeout(timeoutId);
            if (res.ok) {
              const b64Data = await res.text();
              const text = Buffer.from(b64Data.trim(), 'base64').toString('utf-8');
              return text.split('\\n').filter(l => l.trim().length > 0);
            }
          } catch(err) {}
          return [];
      });
      
      const results = await Promise.all(fetchPromises);
      for (const lines of results) {
          configs.push(...lines);
      }
      
      if (configs.length === 0) return new NextResponse('No active server configs found array.', { status: 503 });

      const finalBase64 = Buffer.from(configs.join('\\n')).toString('base64');
      return new NextResponse(finalBase64, {
        headers: { 'Content-Type': 'text/plain', 'Cache-Control': 's-maxage=60' }
      });
    }

    // Fallback exactly to previous Order logic
    const order = await Order.findOne({ multiSubToken: token }).lean();
    if (!order) return new NextResponse('Invalid or expired subscription token', { status: 404 });

    if (order.vpnProvisionStatus !== 'provisioned' || !order.vpnKeys || order.vpnKeys.length === 0) {
      if (order.vpnKey?.subLink) {
        const fallbackRes = await fetch(order.vpnKey.subLink, { next: { revalidate: 60 } });
        if (fallbackRes.ok) {
           const data = await fallbackRes.text();
           return new NextResponse(data, {
            headers: { 'Content-Type': 'text/plain', 'Cache-Control': 's-maxage=60' }
           });
        }
      }
      return new NextResponse('Subscription not active', { status: 403 });
    }

    const firstKey = order.vpnKeys[0] || order.vpnKey;
    if (firstKey.expiryTime && Date.now() > firstKey.expiryTime) {
       return new NextResponse('Subscription expired', { status: 403 });
    }

    const configs: string[] = [];
    const fetchPromises = order.vpnKeys.map(async (key: any) => {
      if (!key.subLink) return [];
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const res = await fetch(key.subLink, { 
          signal: controller.signal,
          next: { revalidate: 300 } 
        });
        clearTimeout(timeoutId);
        
        if (res.ok) {
          const b64Data = await res.text();
          const text = Buffer.from(b64Data.trim(), 'base64').toString('utf-8');
          return text.split('\\n').filter((l: string) => l.trim().length > 0);
        }
      } catch (err) {}
      return [];
    });

    const results = await Promise.all(fetchPromises);
    for (const lines of results) {
       configs.push(...lines);
    }

    if (configs.length === 0) {
       return new NextResponse('No server configurations available right now. Please try again later.', { status: 503 });
    }

    const finalBase64 = Buffer.from(configs.join('\\n')).toString('base64');
    return new NextResponse(finalBase64, {
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 's-maxage=60' }
    });
  } catch (error) {
    console.error('Multi-server subscription error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
`;

fs.writeFileSync('src/app/api/vpn/sub/[token]/route.ts', subRoute);

// Fix Mongoose validation inside ActivityLog model
let logModel = fs.readFileSync('src/models/ActivityLog.ts', 'utf8');
logModel = logModel.replace(/enum: \[\s*'order_approved',/, `enum: [
        'vpn_key_generated',
        'order_approved',`);
fs.writeFileSync('src/models/ActivityLog.ts', logModel);

console.log('Fixed api routes and validation');
