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
        subPort: 2096,
        protocol: 'trojan',
        enabled: true,
        online: true,
      },
    ];

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const server of defaults) {
      const exists = await VpnServer.findOne({ serverId: server.serverId });
      if (exists) {
        // Fix any stale values (e.g. wrong subPort) on existing records
        let needsUpdate = false;
        if (exists.subPort !== server.subPort) needsUpdate = true;
        if (exists.domain !== server.domain) needsUpdate = true;

        if (needsUpdate) {
          await VpnServer.updateOne(
            { serverId: server.serverId },
            { $set: { subPort: server.subPort, domain: server.domain } }
          );
          updated++;
        } else {
          skipped++;
        }
        continue;
      }
      await VpnServer.create(server);
      created++;
    }

    invalidateServerCache();

    return NextResponse.json({
      success: true,
      message: `Seed complete: ${created} created, ${updated} updated, ${skipped} unchanged`,
      data: { created, updated, skipped },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'Seed failed: ' + (err instanceof Error ? err.message : 'Unknown') },
      { status: 500 }
    );
  }
}
