import { NextRequest, NextResponse } from 'next/server';
import { getEnabledServers, type VpnServer } from '@/lib/vpn-servers';
import { apiLimiter } from '@/lib/rateLimit';
import { getAuthUser } from '@/lib/auth';
import { validateExternalHttpUrl, validatePanelPath } from '@/lib/security';

// Force dynamic — health status changes frequently
export const dynamic = 'force-dynamic';

// ==========================================
// GET /api/vpn/health
// Pings each 3xUI panel to check real online/offline status
// Requires authentication to prevent infrastructure reconnaissance
// Cached for 60 seconds to avoid spamming panels
// ==========================================

interface ServerHealth {
  id: string;
  name: string;
  flag: string;
  online: boolean;
  latencyMs: number | null;
  checkedAt: string;
}

// Simple in-memory cache
let cachedHealth: ServerHealth[] | null = null;
let cachedServerCount = 0; // track server count to invalidate when servers change
let cacheTime = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

async function pingPanel(server: VpnServer): Promise<ServerHealth> {
  const start = Date.now();
  try {
    const urlCheck = validateExternalHttpUrl(server.url, { requiredAllowlistEnv: 'VPN_SERVER_ALLOWED_HOSTS' });
    if (!urlCheck.ok || !validatePanelPath(server.panelPath)) {
      return {
        id: server.id,
        name: server.name,
        flag: server.flag,
        online: false,
        latencyMs: null,
        checkedAt: new Date().toISOString(),
      };
    }

    // Ping the panel login page (lightweight GET)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${server.url}${server.panelPath}/`, {
      method: 'GET',
      signal: controller.signal,
      // @ts-expect-error - Node.js fetch dispatcher for self-signed certs
      dispatcher: undefined,
    }).catch(() => null);

    clearTimeout(timeout);
    const latency = Date.now() - start;

    return {
      id: server.id,
      name: server.name,
      flag: server.flag,
      online: res !== null && res.status < 500,
      latencyMs: res !== null && res.status < 500 ? latency : null,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return {
      id: server.id,
      name: server.name,
      flag: server.flag,
      online: false,
      latencyMs: null,
      checkedAt: new Date().toISOString(),
    };
  }
}

export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  // Auth is optional — unauthenticated users get basic online/offline status
  // Authenticated users additionally get latency data
  const user = await getAuthUser();

  // Ping all enabled panels in parallel
  const enabledServers = await getEnabledServers();

  // Return cached result if still fresh AND server count hasn't changed
  const cacheValid = cachedHealth
    && Date.now() - cacheTime < CACHE_TTL_MS
    && cachedServerCount === enabledServers.length;

  if (cacheValid) {
    const servers = user
      ? cachedHealth!
      : cachedHealth!.map(({ latencyMs, ...rest }) => ({ ...rest, latencyMs: null }));
    return NextResponse.json({
      success: true,
      data: { servers, cached: true },
    });
  }

  const healthChecks = await Promise.all(enabledServers.map(pingPanel));

  // Update cache
  cachedHealth = healthChecks;
  cachedServerCount = enabledServers.length;
  cacheTime = Date.now();

  const result = user
    ? healthChecks
    : healthChecks.map(({ latencyMs, ...rest }) => ({ ...rest, latencyMs: null }));

  return NextResponse.json({
    success: true,
    data: { servers: result, cached: false },
  });
}
