import { NextRequest, NextResponse } from 'next/server';
import connectDB, { default as clientPromise } from '@/lib/mongodb';
import Order from '@/models/Order';
import { rateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

const subLimiter = rateLimit({ windowMs: 60000, maxRequests: 30, prefix: 'sub' });
const CONFIG_URI_RE = /^(?:vless|vmess|trojan|ss|hysteria|hysteria2|hy2|tuic):\/\//i;

function extractConfigLines(body: string): string[] {
  if (!body || !body.trim()) return [];

  try {
    const decoded = Buffer.from(body.trim(), 'base64').toString('utf-8');
    const decodedLines = decoded.split('\n').map((line) => line.trim()).filter(Boolean);
    const configLines = decodedLines.filter((line) => CONFIG_URI_RE.test(line));
    if (configLines.length > 0) return configLines;
  } catch {
    // Fallback to plain text below.
  }

  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => CONFIG_URI_RE.test(line));
}

async function fetchSubscriptionConfigs(subLink: string): Promise<string[]> {
  if (!subLink) return [];
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(subLink, { signal: controller.signal, next: { revalidate: 60 } });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn('[api/vpn/sub] subLink fetch non-ok', { subLink, status: res.status });
      return [];
    }

    return extractConfigLines(await res.text());
  } catch (err) {
    console.warn('[api/vpn/sub] failed to fetch subLink', { subLink, err: String(err) });
    return [];
  }
}

function uniqueConfigLines(configs: string[]): string[] {
  return Array.from(new Set(configs.map((line) => line.trim()).filter(Boolean)));
}

function endpointKeyFromConfig(config: string): string | null {
  try {
    const value = config.trim();
    if (/^vmess:\/\//i.test(value)) {
      const parsed = JSON.parse(Buffer.from(value.slice('vmess://'.length), 'base64').toString('utf-8'));
      const host = String(parsed.add || '').toLowerCase();
      const port = parsed.port ? String(parsed.port) : '';
      return host ? `${host}:${port}` : null;
    }

    if (/^(?:vless|trojan|ss|hysteria|hysteria2|hy2|tuic):\/\//i.test(value)) {
      const parsed = new URL(value);
      return parsed.hostname ? `${parsed.hostname.toLowerCase()}:${parsed.port}` : null;
    }
  } catch {
    // Ignore malformed saved links.
  }

  return null;
}

function endpointKeyFromSubLink(subLink: string): string | null {
  try {
    const parsed = new URL(subLink);
    return parsed.hostname ? parsed.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

async function appendSavedFallbackConfigs(
  configs: string[],
  serverConfigLinks: unknown,
  liveEndpointKeys: Set<string>,
  liveHostKeys: Set<string>
) {
  if (!Array.isArray(serverConfigLinks)) return;

  for (const cfg of serverConfigLinks) {
    const value = String(cfg || '').trim();
    if (!value) continue;

    if (CONFIG_URI_RE.test(value)) {
      const endpointKey = endpointKeyFromConfig(value);
      const hostKey = endpointKey?.split(':')[0] || null;
      if (
        endpointKey &&
        !liveEndpointKeys.has(endpointKey) &&
        (!hostKey || !liveHostKeys.has(hostKey))
      ) {
        configs.push(value);
        liveEndpointKeys.add(endpointKey);
        if (hostKey) liveHostKeys.add(hostKey);
      }
      continue;
    }

    if (value.includes('/sub/')) {
      const fallbackLines = await fetchSubscriptionConfigs(value);
      for (const line of fallbackLines) {
        const endpointKey = endpointKeyFromConfig(line);
        const hostKey = endpointKey?.split(':')[0] || null;
        if (endpointKey && !liveEndpointKeys.has(endpointKey)) {
          configs.push(line);
          liveEndpointKeys.add(endpointKey);
          if (hostKey) liveHostKeys.add(hostKey);
        }
      }
    }
  }
}

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
      const liveEndpointKeys = new Set<string>();
      const liveHostKeys = new Set<string>();

      // Prefer live 3x-ui subscription endpoints so rotated servers return current
      // ports, TLS/Reality params, and only clients that still exist on the panel.
      const subLinksToFetch: string[] = Array.isArray(adminKey.serverSubLinks) ? adminKey.serverSubLinks : [];
      const liveResults = await Promise.all(subLinksToFetch.map((subLink) => fetchSubscriptionConfigs(String(subLink))));
      for (const lines of liveResults) {
        for (const line of lines) {
          configs.push(line);
          const endpointKey = endpointKeyFromConfig(line);
          const hostKey = endpointKey?.split(':')[0] || null;
          if (endpointKey) liveEndpointKeys.add(endpointKey);
          if (hostKey) liveHostKeys.add(hostKey);
        }
      }
      for (let index = 0; index < subLinksToFetch.length; index++) {
        const hostKey = endpointKeyFromSubLink(String(subLinksToFetch[index]));
        if (hostKey && liveResults[index]?.length) {
          liveHostKeys.add(hostKey);
        }
      }

      // Add saved direct configs only for hosts/ports that live subscriptions did
      // not return. This keeps old inbound links working while avoiding duplicate
      // or stale Jan entries after a rotate.
      await appendSavedFallbackConfigs(configs, adminKey.serverConfigLinks, liveEndpointKeys, liveHostKeys);

      if (configs.length === 0) return new NextResponse('No active server configs found array.', { status: 503 });

      const finalBase64 = Buffer.from(uniqueConfigLines(configs).join('\n')).toString('base64');
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
          return extractConfigLines(await res.text());
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

    const finalBase64 = Buffer.from(uniqueConfigLines(configs).join('\n')).toString('base64');
    return new NextResponse(finalBase64, {
      headers: { 'Content-Type': 'text/plain', 'Cache-Control': 's-maxage=60' }
    });
  } catch (error) {
    console.error('Multi-server subscription error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
