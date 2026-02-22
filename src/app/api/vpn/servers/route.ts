import { NextResponse } from 'next/server';
import { getEnabledServers } from '@/lib/vpn-servers';

// Force dynamic — server list changes when admin adds/removes servers
export const dynamic = 'force-dynamic';

// GET /api/vpn/servers - Public list of enabled VPN servers
// Online/offline status is determined by health checks on the client side
export async function GET() {
  const enabledServers = await getEnabledServers();
  const servers = enabledServers.map((s) => ({
    id: s.id,
    name: s.name,
    flag: s.flag,
    online: s.online,
    protocol: s.protocol,
    enabledProtocols: s.enabledProtocols,
  }));

  return NextResponse.json({ success: true, data: { servers } });
}
