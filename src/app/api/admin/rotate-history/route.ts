import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import connectDB from '@/lib/mongodb';
import RotateJobModel from '@/models/RotateJob';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function pickRotationDetails(job: any) {
  const result = job.result || {};
  const steps = result.steps || {};
  const backup = steps.backup || {};
  const recreate = steps.recreate || {};
  const dns = steps.dns || {};
  const panel = steps.panel || {};

  return {
    oldIp: result.oldIp || backup.oldIp || recreate.oldIp || null,
    newIp: result.newIp || dns.newIp || panel.newIp || null,
    domain: result.domain || dns.domain || panel.domain || backup.domain || null,
    panel: result.panelUrl || panel.panelUrl || result.panel || null,
    region: result.region || recreate.region || null,
    size: result.size || recreate.size || null,
    image: result.image || recreate.image || null,
  };
}

function labelAction(action: string) {
  const labels: Record<string, string> = {
    backup: 'Backup',
    recreate_vps: 'Recreate',
    update_dns: 'DNS',
    install_3xui: 'Panel',
    one_click_rotate: 'One-click',
  };

  return labels[action] || action;
}

export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
    await connectDB();

    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit')) || 30, 1), 100);
    const jobs = await RotateJobModel.find()
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        history: jobs.map((job: any) => ({
          id: job.jobId,
          action: job.action,
          actionLabel: labelAction(job.action),
          serverId: job.serverId,
          status: job.status,
          message: job.message || job.error || '',
          error: job.error || '',
          startedAt: job.startedAt,
          updatedAt: job.updatedAt,
          ...pickRotationDetails(job),
        })),
      },
    });
  } catch (error: any) {
    if (error.message === 'Admin access required') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load rotation history' },
      { status: 500 }
    );
  }
}
