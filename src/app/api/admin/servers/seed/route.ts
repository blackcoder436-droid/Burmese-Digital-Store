import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import VpnServer from '@/models/VpnServer';
import { requireAdmin } from '@/lib/auth';
import { invalidateServerCache } from '@/lib/vpn-servers';

// POST /api/admin/servers/seed — Seed database with default static servers
// Only creates servers that don't already exist
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectDB();

    const defaults = [
      {
        serverId: 'sg1',
        name: 'Singapore 1',
        flag: '🇸🇬',
        url: 'https://jan.burmesedigital.store:8080',
        panelPath: '/mka',
        domain: 'jan.burmesedigital.store',
        subPort: 2096,
        trojanPort: 22716,
        protocol: 'trojan',
        enabled: true,
        online: true,
      },
      {
        serverId: 'sg2',
        name: 'Singapore 2',
        flag: '🇸🇬',
        url: 'https://sg2.burmesedigital.store:8080',
        panelPath: '/mka',
        domain: 'sg2.burmesedigital.store',
        subPort: 2096,
        protocol: 'trojan',
        enabled: true,
        online: true,
      },
      {
        serverId: 'sg3',
        name: 'Singapore 3',
        flag: '🇸🇬',
        url: 'https://sg3.burmesedigital.store:8080',
        panelPath: '/mka',
        domain: 'sg3.burmesedigital.store',
        subPort: 2096,
        protocol: 'trojan',
        enabled: true,
        online: true,
      },
      {
        serverId: 'us1',
        name: 'United States',
        flag: '🇺🇸',
        url: 'https://us.burmesedigital.store:8080',
        panelPath: '/mka',
        domain: 'us.burmesedigital.store',
        subPort: 8080,
        protocol: 'trojan',
        enabled: true,
        online: true,
      },
    ];

    let created = 0;
    let skipped = 0;

    for (const server of defaults) {
      const exists = await VpnServer.findOne({ serverId: server.serverId });
      if (exists) {
        skipped++;
        continue;
      }
      await VpnServer.create(server);
      created++;
    }

    invalidateServerCache();

    return NextResponse.json({
      success: true,
      message: `Seed complete: ${created} created, ${skipped} already existed`,
      data: { created, skipped },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'Seed failed: ' + (err instanceof Error ? err.message : 'Unknown') },
      { status: 500 }
    );
  }
}
