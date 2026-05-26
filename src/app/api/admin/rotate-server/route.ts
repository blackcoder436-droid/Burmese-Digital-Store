import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import connectDB from '@/lib/mongodb';
import RotateJobModel from '@/models/RotateJob';
import {
  actionBackupServer,
  actionInstall3xUI,
  actionRecreateServer,
  actionUpdateDNS,
} from '@/lib/rotationActions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 900;

const PROCESS_STARTED_AT = new Date();
const STALE_RUNNING_JOB_MS = 45 * 60 * 1000;

type JobStatus = 'running' | 'success' | 'error';

async function cleanupRotateJobs() {
  const cutoff = new Date(Date.now() - STALE_RUNNING_JOB_MS);
  await RotateJobModel.updateMany(
    {
      action: 'one_click_rotate',
      status: 'running',
      $or: [
        { updatedAt: { $lt: cutoff } },
        { updatedAt: { $lt: PROCESS_STARTED_AT } },
      ],
    },
    {
      $set: {
        status: 'error',
        error: 'One-click rotation was interrupted or timed out.',
        message: 'One-click rotation was interrupted or timed out.',
        updatedAt: new Date(),
      },
    }
  );
}

async function updateJob(jobId: string, updates: { status?: JobStatus; message?: string; result?: any; error?: string }) {
  await RotateJobModel.updateOne(
    { jobId },
    { $set: { ...updates, updatedAt: new Date() } }
  );
}

async function startOneClickJob(serverId: string) {
  await cleanupRotateJobs();

  const existingJob = await RotateJobModel.findOne({
    action: 'one_click_rotate',
    serverId,
    status: 'running',
  }).lean();
  if (existingJob) return existingJob;

  const now = Date.now();
  const job = await RotateJobModel.create({
    jobId: `one_click_rotate:${serverId}:${now}`,
    action: 'one_click_rotate',
    serverId,
    status: 'running',
    message: 'One-click rotation is starting...',
    startedAt: new Date(now),
    updatedAt: new Date(now),
    expiresAt: new Date(now + 24 * 60 * 60 * 1000),
  });

  const progress = (message: string) => updateJob(job.jobId, { message });

  void (async () => {
    await progress('Step 1/4: backing up the current 3x-ui database and certificates...');
    const backupResult = await actionBackupServer(serverId);

    await progress('Step 2/4: recreating the DigitalOcean VPS...');
    const recreateResult = await actionRecreateServer(serverId);

    await progress('Step 3/4: updating Cloudflare DNS...');
    const dnsResult = await actionUpdateDNS(serverId);

    await progress('Step 4/4: installing 3x-ui, restoring backup, and restarting panel/Xray...');
    const panelResult = await actionInstall3xUI(serverId, progress);

    await updateJob(job.jobId, {
      status: 'success',
      message: `One-click rotation completed successfully. ${panelResult.message || ''}`.trim(),
      result: {
        success: true,
        message: `One-click rotation completed successfully. ${panelResult.message || ''}`.trim(),
        steps: {
          backup: backupResult,
          recreate: recreateResult,
          dns: dnsResult,
          panel: panelResult,
        },
      },
    });
  })().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    void updateJob(job.jobId, {
      status: 'error',
      error: message,
      message: `One-click rotation stopped: ${message}`,
    });
  });

  return job;
}

// POST: Trigger the same safe sequence as the manual wizard.
export async function POST(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
    await connectDB();
    const body = await request.json();
    const serverId = body.serverId;

    if (!serverId) {
      return NextResponse.json({ success: false, error: 'Server ID is required' }, { status: 400 });
    }

    const job = await startOneClickJob(serverId);

    return NextResponse.json({
      success: true,
      pending: true,
      jobId: job.jobId,
      status: job.status,
      message: job.message,
    });
  } catch (error: any) {
    if (error.message === 'Admin access required') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
