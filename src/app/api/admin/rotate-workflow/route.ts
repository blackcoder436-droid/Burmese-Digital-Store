import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { actionBackupServer, actionRecreateServer, actionUpdateDNS, actionInstall3xUI } from '@/lib/rotationActions';
import connectDB from '@/lib/mongodb';
import RotateJobModel from '@/models/RotateJob';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 900;
const PROCESS_STARTED_AT = new Date();
const STALE_RUNNING_JOB_MS = 20 * 60 * 1000;
const ROTATE_JOB_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;

type RotateJobUpdate = {
  jobId: string;
  action: string;
  serverId: string;
  status: 'running' | 'success' | 'error';
  message: string;
  result?: any;
  error?: string;
  startedAt: number;
  updatedAt: number;
};

async function cleanupRotateJobs() {
  const cutoff = new Date(Date.now() - STALE_RUNNING_JOB_MS);
  await RotateJobModel.updateMany(
    {
      status: 'running',
      $or: [
        { updatedAt: { $lt: cutoff } },
        { updatedAt: { $lt: PROCESS_STARTED_AT } },
      ],
    },
    { $set: { status: 'error', error: 'Background job was interrupted or timed out.', message: 'Background job was interrupted or timed out.', updatedAt: new Date() } }
  );
}

async function findRunningJob(action: string, serverId: string) {
  return RotateJobModel.findOne({ action, serverId, status: 'running' }).lean();
}

async function updateRotateJob(jobId: string, updates: Partial<RotateJobUpdate>) {
  await RotateJobModel.updateOne(
    { jobId },
    { $set: { ...updates, updatedAt: new Date() } }
  );
}

async function recordCompletedRotateJob(action: string, serverId: string, result: any, status: 'success' | 'error' = 'success') {
  const now = Date.now();
  await RotateJobModel.create({
    jobId: `${action}:${serverId}:${now}`,
    action,
    serverId,
    status,
    message: status === 'success' ? (result?.message || 'Step completed successfully') : (result?.error || result?.message || 'Step failed'),
    result: status === 'success' ? result : null,
    error: status === 'error' ? (result?.error || result?.message || 'Step failed') : '',
    startedAt: new Date(now),
    updatedAt: new Date(now),
    expiresAt: new Date(now + ROTATE_JOB_RETENTION_MS),
  });
}

async function runTrackedAction(action: string, serverId: string, runner: () => Promise<any>) {
  try {
    const result = await runner();
    await recordCompletedRotateJob(action, serverId, result, 'success');
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordCompletedRotateJob(action, serverId, { error: message, message }, 'error');
    throw error;
  }
}

async function startRotateJob(action: string, serverId: string, runner: (progress: (message: string) => Promise<void>) => Promise<any>) {
  await cleanupRotateJobs();

  const existingJob = await findRunningJob(action, serverId);
  if (existingJob) return existingJob;

  const now = Date.now();
  const job = await RotateJobModel.create({
    jobId: `${action}:${serverId}:${now}`,
    action,
    serverId,
    status: 'running',
    message: 'Panel install/restore is running in the background.',
    startedAt: new Date(now),
    updatedAt: new Date(now),
    expiresAt: new Date(now + ROTATE_JOB_RETENTION_MS),
  });

  void runner((message: string) => updateRotateJob(job.jobId, { message }))
    .then((result) => {
      void updateRotateJob(job.jobId, {
        status: 'success',
        result,
        message: result?.message || 'Step completed successfully',
      });
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      void updateRotateJob(job.jobId, {
        status: 'error',
        error: message,
        message: message || 'Step failed',
      });
    });

  return job;
}

export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
    await connectDB();
    const jobId = request.nextUrl.searchParams.get('jobId');
    if (!jobId) {
      return NextResponse.json({ success: false, error: 'Job ID is required' }, { status: 400 });
    }

    const job = await RotateJobModel.findOne({ jobId }).lean();
    if (!job) {
      return NextResponse.json({ success: false, error: 'Job not found or expired' }, { status: 404 });
    }

    if (job.status === 'running') {
      return NextResponse.json({
        success: true,
        pending: true,
        jobId: job.jobId,
        status: job.status,
        message: job.message,
      });
    }

    if (job.status === 'success') {
      return NextResponse.json({
        success: true,
        pending: false,
        jobId: job.jobId,
        status: job.status,
        ...(job.result || {}),
        message: job.message,
      });
    }

    return NextResponse.json({
      success: false,
      pending: false,
      jobId: job.jobId,
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
      return runTrackedAction(action, serverId, () => actionBackupServer(serverId));
    }
    
    if (action === 'recreate_vps') {
      return runTrackedAction(action, serverId, () => actionRecreateServer(serverId));
    }

    if (action === 'update_dns') {
      return runTrackedAction(action, serverId, () => actionUpdateDNS(serverId));
    }

    if (action === 'install_3xui') {
      const job = await startRotateJob(action, serverId, (progress) => actionInstall3xUI(serverId, progress));
      return NextResponse.json({
        success: true,
        pending: true,
        jobId: job.jobId,
        status: job.status,
        message: job.message,
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
