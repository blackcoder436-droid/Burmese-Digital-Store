import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { actionBackupServer, actionRecreateServer, actionUpdateDNS, actionInstall3xUI } from '@/lib/rotationActions';
import connectDB from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 900;

export async function POST(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
    await connectDB();
    const body = await request.json();
    const { action, serverId } = body;

    if (!serverId || !action) {
      return NextResponse.json({ success: false, error: 'Server ID and action are required' }, { status: 400 });
    }

    if (action === 'backup') {
      const result = await actionBackupServer(serverId);
      return NextResponse.json(result);
    }
    
    if (action === 'recreate_vps') {
      const result = await actionRecreateServer(serverId);
      return NextResponse.json(result);
    }

    if (action === 'update_dns') {
      const result = await actionUpdateDNS(serverId);
      return NextResponse.json(result);
    }

    if (action === 'install_3xui') {
      const result = await actionInstall3xUI(serverId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
