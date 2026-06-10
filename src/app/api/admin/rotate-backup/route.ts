import fs from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

function normalizeServerId(value: string) {
  const serverId = value.trim().toLowerCase();
  return /^[a-z0-9_-]{2,32}$/.test(serverId) ? serverId : '';
}

function getBackupExtension(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.tar.gz')) return '.tar.gz';
  if (lower.endsWith('.dump')) return '.dump';
  if (lower.endsWith('.db')) return '.db';
  return '';
}

export async function POST(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }

  try {
    const form = await request.formData();
    const serverId = normalizeServerId(String(form.get('serverId') || ''));
    const file = form.get('file');

    if (!serverId) {
      return NextResponse.json({ success: false, error: 'Missing or invalid server id' }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'Backup file is required' }, { status: 400 });
    }

    const extension = getBackupExtension(file.name);
    if (!extension) {
      return NextResponse.json({ success: false, error: 'Unsupported backup file. Upload .tar.gz, .dump, or .db.' }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ success: false, error: 'Backup file is empty' }, { status: 400 });
    }

    if (file.size > MAX_BACKUP_BYTES) {
      return NextResponse.json({ success: false, error: 'Backup file is too large. Maximum size is 50 MB.' }, { status: 400 });
    }

    const backupsDir = path.join(process.cwd(), 'backups');
    await fs.mkdir(backupsDir, { recursive: true });

    const targetPath = path.join(backupsDir, `${serverId}_backup${extension}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(targetPath, buffer, { mode: 0o600 });

    return NextResponse.json({
      success: true,
      message: `Backup uploaded for ${serverId}. Run Step 5 to restore it.`,
      data: {
        serverId,
        filename: path.basename(targetPath),
        size: file.size,
        format: extension,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload backup',
    }, { status: 500 });
  }
}
