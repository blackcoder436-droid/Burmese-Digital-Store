import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { actionBackupServer, actionRecreateServer, actionUpdateDNS, actionInstall3xUI } from '@/lib/rotationActions';
import connectDB from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 900;

type RotateJob = {
  id: string;
  action: string;
  serverId: string;
  status: 'running' | 'success' | 'error';
  message: string;
  result?: any;
  error?: string;
  startedAt: number;
  updatedAt: number;
};

const globalForRotateJobs = globalThis as typeof globalThis & {
  rotateWorkflowJobs?: Map<string, RotateJob>;
};

const rotateWorkflowJobs = globalForRotateJobs.rotateWorkflowJobs || new Map<string, RotateJob>();
globalForRotateJobs.rotateWorkflowJobs = rotateWorkflowJobs;

function cleanupRotateJobs() {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of rotateWorkflowJobs.entries()) {
    if (job.updatedAt < cutoff) {
      rotateWorkflowJobs.delete(id);
    }
  }
}

function findRunningJob(action: string, serverId: string) {
  for (const job of rotateWorkflowJobs.values()) {
    if (job.action === action && job.serverId === serverId && job.status === 'running') {
      return job;
    }
  }
  return null;
}

function startRotateJob(action: string, serverId: string, runner: () => Promise<any>) {
  cleanupRotateJobs();

  const existingJob = findRunningJob(action, serverId);
  if (existingJob) return existingJob;

  const now = Date.now();
  const job: RotateJob = {
    id: `${action}:${serverId}:${now}`,
    action,
    serverId,
    status: 'running',
    message: 'Panel install/restore is running in the background.',
    startedAt: now,
    updatedAt: now,
  };

  rotateWorkflowJobs.set(job.id, job);

  void runner()
    .then((result) => {
      job.status = 'success';
      job.result = result;
      job.message = result?.message || 'Step completed successfully';
      job.updatedAt = Date.now();
    })
    .catch((error) => {
      job.status = 'error';
      job.error = error instanceof Error ? error.message : String(error);
      job.message = job.error || 'Step failed';
      job.updatedAt = Date.now();
    });

  return job;
}

export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
    const jobId = request.nextUrl.searchParams.get('jobId');
    if (!jobId) {
      return NextResponse.json({ success: false, error: 'Job ID is required' }, { status: 400 });
    }

    const job = rotateWorkflowJobs.get(jobId);
    if (!job) {
      return NextResponse.json({ success: false, error: 'Job not found or expired' }, { status: 404 });
    }

    if (job.status === 'running') {
      return NextResponse.json({
        success: true,
        pending: true,
        jobId: job.id,
        status: job.status,
        message: job.message,
      });
    }

    if (job.status === 'success') {
      return NextResponse.json({
        success: true,
        pending: false,
        jobId: job.id,
        status: job.status,
        ...(job.result || {}),
        message: job.message,
      });
    }

    return NextResponse.json({
      success: false,
      pending: false,
      jobId: job.id,
      status: job.status,
      error: job.error || job.message,
    }, { status: 500 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}

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
      const job = startRotateJob(action, serverId, () => actionInstall3xUI(serverId));
      return NextResponse.json({
        success: true,
        pending: true,
        jobId: job.id,
        status: job.status,
        message: job.message,
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
