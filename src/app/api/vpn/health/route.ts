import { NextRequest, NextResponse } from 'next/server';
import { getEnabledServers, type VpnServer } from '@/lib/vpn-servers';
import { apiLimiter } from '@/lib/rateLimit';
import { getAuthUser } from '@/lib/auth';
import { validateExternalHttpUrl, validatePanelPath } from '@/lib/security';

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
  checkedAt: string;
}

// Simple in-memory cache
let cachedHealth: ServerHealth[] | null = null;
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
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return {
      id: server.id,
      name: server.name,
      flag: server.flag,
      online: false,
      checkedAt: new Date().toISOString(),
    };
  }
}

export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  // Require authentication to prevent infrastructure reconnaissance
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    );
  }

  // Return cached result if still fresh
  if (cachedHealth && Date.now() - cacheTime < CACHE_TTL_MS) {
    return NextResponse.json({
      success: true,
      data: { servers: cachedHealth, cached: true },
    });
  }

  // Ping all enabled panels in parallel
  const servers = await getEnabledServers();
  const healthChecks = await Promise.all(servers.map(pingPanel));

  // Update cache
  cachedHealth = healthChecks;
  cacheTime = Date.now();

  return NextResponse.json({
    success: true,
    data: { servers: healthChecks, cached: false },
  });
}
