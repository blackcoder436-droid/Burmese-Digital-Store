import { NextResponse } from 'next/server';
import { getOnlineServers } from '@/lib/vpn-servers';

// GET /api/vpn/servers - Public list of online VPN servers
export async function GET() {
  const onlineServers = await getOnlineServers();
  const servers = onlineServers.map((s) => ({
    id: s.id,
    name: s.name,
    flag: s.flag,
    online: s.online,
    protocol: s.protocol,
    enabledProtocols: s.enabledProtocols,
  }));

  return NextResponse.json({ success: true, data: { servers } });
}
