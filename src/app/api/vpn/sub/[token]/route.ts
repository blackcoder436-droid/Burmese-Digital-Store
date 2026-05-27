import { NextRequest, NextResponse } from 'next/server';
import connectDB, { default as clientPromise } from '@/lib/mongodb';
import Order from '@/models/Order';
import { rateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

const subLimiter = rateLimit({ windowMs: 60000, maxRequests: 30, prefix: 'sub' });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const limited = await subLimiter(req);
  if (limited) return limited;

  try {
    const { token } = await params;
    if (!token) return new NextResponse('Missing token', { status: 400 });

    await connectDB();

    // Check custom VPN keys collection first
    const _mongoose = await connectDB();
    const db = _mongoose.connection.getClient().db();
    const adminKey = await db.collection('vpn_keys').findOne({ token });
    // Debug: report presence and link counts (non-sensitive)
    try {
      if (adminKey) {
        console.debug('[api/vpn/sub] found adminKey for token', { tokenPreview: String(token).slice(0,6) + '...', serverSubLinks: Array.isArray(adminKey.serverSubLinks) ? adminKey.serverSubLinks.length : 0, serverConfigLinks: Array.isArray(adminKey.serverConfigLinks) ? adminKey.serverConfigLinks.length : 0 });
      } else {
        console.debug('[api/vpn/sub] no adminKey found for token', { tokenPreview: String(token).slice(0,6) + '...' });
      }
    } catch (dbgErr) {
      console.debug('[api/vpn/sub] debug log failure', String(dbgErr));
    }
    
    if (adminKey) {
      // Check expiry
      if (adminKey.expiryTime && Date.now() > adminKey.expiryTime) {
         return new NextResponse('Subscription expired', { status: 403 });
      }

      const configs: string[] = [];

      // If direct config URIs were saved when provisioning (e.g. trojan://, vless://), prefer them
      if (Array.isArray(adminKey.serverConfigLinks) && adminKey.serverConfigLinks.length > 0) {
        for (const cfg of adminKey.serverConfigLinks) {
          if (cfg && String(cfg).trim()) configs.push(String(cfg).trim());
        }
      } else {
        const subLinksToFetch: string[] = adminKey.serverSubLinks || [];
        // Fetch in parallel (fallback when we only stored subscription endpoints)
        const fetchPromises = subLinksToFetch.map(async (subLink) => {
            if (!subLink) return [];
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 8000);
              const res = await fetch(subLink, { signal: controller.signal, next: { revalidate: 300 } });
              clearTimeout(timeoutId);
              if (res.ok) {
                const body = await res.text();
                if (!body || !body.trim()) return [];
                // Try to decode as base64 first (3x-UI returns base64 encoded subscription)
                try {
                  const decoded = Buffer.from(body.trim(), 'base64').toString('utf-8');
                  const lines = decoded.split('\n').map((l) => l.trim()).filter(Boolean);
                  if (lines.length > 0) return lines;
                } catch (decodeErr) {
                  // ignore and try fallback
                }

                // Fallback: treat response as plain text list of configs
                const rawLines = body.split('\n').map((l) => l.trim()).filter(Boolean);
                if (rawLines.length > 0) return rawLines;
              } else {
                console.warn('[api/vpn/sub] subLink fetch non-ok', { subLink, status: res.status });
              }
            } catch(err) {
              console.warn('[api/vpn/sub] failed to fetch subLink', { subLink, err: String(err) });
            }
            return [];
        });
        const results = await Promise.all(fetchPromises);
        for (const lines of results) {
            configs.push(...lines);
        }
      }

      if (configs.length === 0) return new NextResponse('No active server configs found array.', { status: 503 });

      const finalBase64 = Buffer.from(configs.join('\n')).toString('base64');
      return new NextResponse(finalBase64, {
        headers: { 'Content-Type': 'text/plain', 'Cache-Control': 's-maxage=60' }
      });
    }

    // Fallback exactly to previous Order logic
    const order = await Order.findOne({ multiSubToken: token }).lean();
    if (!order) return new NextResponse('Invalid or expired subscription token', { status: 404 });

    if (order.vpnProvisionStatus !== 'provisioned' || !order.vpnKeys || order.vpnKeys.length < 2) {
      return new NextResponse('Subscription not active', { status: 403 });
    }

    const firstKey = order.vpnKeys[0] || order.vpnKey;
    if ((firstKey as any).expiryTime && Date.now() > (firstKey as any).expiryTime) {
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
          const body = await res.text();
          if (!body || !body.trim()) return [];
          try {
            const decoded = Buffer.from(body.trim(), 'base64').toString('utf-8');
            const lines = decoded.split('\n').map((l: string) => l.trim()).filter(Boolean);
            if (lines.length > 0) return lines;
          } catch (_) {}
          const rawLines = body.split('\n').map((l: string) => l.trim()).filter(Boolean);
          if (rawLines.length > 0) return rawLines;
        } else {
          console.warn('[api/vpn/sub] order subLink fetch non-ok', { subLink: key.subLink, status: res.status });
        }
      } catch (err) {
        console.warn('[api/vpn/sub] failed to fetch order subLink', { subLink: key.subLink, err: String(err) });
      }
      return [];
    });

    const results = await Promise.all(fetchPromises);
    for (const lines of results) {
       configs.push(...lines);
    }

    if (configs.length === 0) {
       return new NextResponse('No server configurations available right now. Please try again later.', { status: 503 });
    }

    const finalBase64 = Buffer.from(configs.join('\n')).toString('base64');
    return new NextResponse(finalBase64, {
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 's-maxage=60' }
    });
  } catch (error) {
    console.error('Multi-server subscription error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
