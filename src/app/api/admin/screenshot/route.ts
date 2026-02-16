import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { getQuarantineFullPath, isInQuarantine } from '@/lib/quarantine';
import { isPathWithinDir } from '@/lib/security';

// ==========================================
// Admin Screenshot Preview (S7 — Quarantine)
// Serves quarantined screenshots to admin only
// ==========================================

// GET /api/admin/screenshot?path=uploads/payments/pay-xxx.jpg
export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const relativePath = searchParams.get('path');

    if (!relativePath) {
      return NextResponse.json(
        { success: false, error: 'Path parameter required' },
        { status: 400 }
      );
    }

    // Security: ensure path stays within quarantine directory
    const quarantineRoot = path.join(process.cwd(), 'quarantine');
    const fullPath = getQuarantineFullPath(relativePath);

    if (!isPathWithinDir(fullPath, quarantineRoot)) {
      return NextResponse.json(
        { success: false, error: 'Invalid path' },
        { status: 400 }
      );
    }

    // Check if file is in quarantine
    const inQuarantine = await isInQuarantine(relativePath);
    if (!inQuarantine) {
      // File may have been released to public already — redirect
      return NextResponse.redirect(new URL(`/${relativePath}`, request.url));
    }

    // Read and serve the file
    const buffer = await readFile(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const contentType =
      ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.png'
          ? 'image/png'
          : ext === '.webp'
            ? 'image/webp'
            : 'application/octet-stream';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, no-store, no-cache',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: 'File not found or inaccessible' },
      { status: 404 }
    );
  }
}
