import { NextRequest, NextResponse } from 'next/server';
import { Agent } from 'undici';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import { validateExternalHttpUrl } from '@/lib/security';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/vpn/sub/[token]' });

const REQUEST_TIMEOUT_MS = 30_000;
const tlsAgent = process.env.XUI_ALLOW_INSECURE_TLS === 'true'
  ? new Agent({ connect: { rejectUnauthorized: false } })
  : null;

function decodeSubscriptionPayload(payload: string): string[] {
  const trimmed = payload.trim();
  if (!trimmed) return [];

  const plainLines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
  const looksPlain = plainLines.some((line) => line.includes('://'));
  if (looksPlain) return plainLines;

  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
    const decodedLines = decoded.split('\n').map((l) => l.trim()).filter(Boolean);
    if (decodedLines.some((line) => line.includes('://'))) {
      return decodedLines;
    }
  } catch {
    // fall back to plain lines
  }

  return plainLines;
}

async function fetchSubscriptionPayload(subUrl: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const requestOptions: RequestInit & { dispatcher?: Agent } = {
      signal: controller.signal,
    };
    if (tlsAgent) {
      requestOptions.dispatcher = tlsAgent;
    }
    const res = await fetch(subUrl, requestOptions);
    clearTimeout(timeout);
    if (!res.ok) return null;
    const body = await res.text();
    return body.trim() || null;
  } catch (error: unknown) {
    clearTimeout(timeout);
    log.warn('Subscription fetch failed', {
      subUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token: rawToken } = await params;
  const token = rawToken?.trim();
  if (!token) {
    return new NextResponse('Invalid token', { status: 400 });
  }

  try {
    await connectDB();
    const order = await Order.findOne({
      orderType: 'vpn',
      vpnSubToken: token,
      vpnProvisionStatus: 'provisioned',
    })
      .select('vpnKeys vpnKey vpnCombinedSubLink vpnSubToken')
      .lean();

    if (!order) {
      return new NextResponse('Not found', { status: 404 });
    }

    const storedLinks = Array.isArray(order.vpnKeys) ? order.vpnKeys.map((k) => k.subLink).filter(Boolean) : [];
    const fallbackLink = order.vpnKey?.subLink && order.vpnKey.subLink !== order.vpnCombinedSubLink
      ? [order.vpnKey.subLink]
      : [];
    const subLinks = [...storedLinks, ...fallbackLink].filter((link) => !link.includes('/api/vpn/sub/'));

    const safeLinks = subLinks.filter((link) => {
      const check = validateExternalHttpUrl(link, { requiredAllowlistEnv: 'VPN_SERVER_ALLOWED_HOSTS' });
      if (!check.ok) {
        log.warn('Blocked subscription URL', { link, error: check.error });
      }
      return check.ok;
    });

    if (safeLinks.length === 0) {
      return new NextResponse('No subscription links', { status: 404 });
    }

    const payloads = await Promise.all(safeLinks.map((link) => fetchSubscriptionPayload(link)));
    const lines = payloads
      .filter((p): p is string => !!p)
      .flatMap((payload) => decodeSubscriptionPayload(payload))
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return new NextResponse('Empty subscription', { status: 404 });
    }

    const merged = Array.from(new Set(lines));
    const encoded = Buffer.from(merged.join('\n')).toString('base64');

    return new NextResponse(encoded, {
      status: 200,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  } catch (error: unknown) {
    log.error('Subscription aggregation failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return new NextResponse('Internal error', { status: 500 });
  }
}
