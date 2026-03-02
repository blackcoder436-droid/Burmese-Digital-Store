import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { syncEnabledProtocols } from '@/lib/xui';
import { getAllServers } from '@/lib/vpn-servers';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/admin/servers/sync-protocols' });

// POST /api/admin/servers/sync-protocols
// Sync enabledProtocols from actual 3xUI panel inbound status for all (or specific) servers
export async function POST(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const targetServerId = body.serverId as string | undefined;

    const servers = await getAllServers();
    const serverIds = targetServerId
      ? [targetServerId].filter((id) => id in servers)
      : Object.keys(servers);

    if (serverIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No matching servers found' },
        { status: 404 }
      );
    }

    const results: Record<string, { success: boolean; enabledProtocols?: string[]; error?: string }> = {};

    for (const serverId of serverIds) {
      try {
        const protocols = await syncEnabledProtocols(serverId);
        if (protocols) {
          results[serverId] = { success: true, enabledProtocols: protocols };
        } else {
          results[serverId] = { success: false, error: 'Could not connect to panel or no inbounds found' };
        }
      } catch (err) {
        results[serverId] = {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    const successCount = Object.values(results).filter((r) => r.success).length;
    log.info('Protocol sync completed', { admin: admin.userId, successCount, total: serverIds.length });

    return NextResponse.json({
      success: true,
      data: {
        results,
        synced: successCount,
        total: serverIds.length,
      },
    });
  } catch (err) {
    log.error('Failed to sync protocols', { error: err });
    return NextResponse.json(
      { success: false, error: 'Failed to sync protocols' },
      { status: 500 }
    );
  }
}
