import { writeFile, mkdir, rename, unlink, access, constants } from 'fs/promises';
import path from 'path';
import { createLogger } from '@/lib/logger';

// ==========================================
// Upload Quarantine System (S7)
// Burmese Digital Store
//
// Payment screenshots are quarantined before serving.
// Flow: upload → quarantine dir → admin verify → move to public
// Prevents unscanned/unapproved files from being served publicly.
// ==========================================

const log = createLogger({ module: 'quarantine' });

// Quarantine directory (NOT under public — files are not served)
const QUARANTINE_ROOT = path.join(process.cwd(), 'quarantine');
// Public directory (files served after approval)
const PUBLIC_ROOT = path.join(process.cwd(), 'public');

/**
 * Save a file to the quarantine directory (not publicly accessible).
 * Returns the quarantine-relative path for tracking.
 */
export async function saveToQuarantine(
  buffer: Buffer,
  relativePath: string
): Promise<{ quarantinePath: string; publicPath: string }> {
  const quarantineFullPath = path.join(QUARANTINE_ROOT, relativePath);
  const dir = path.dirname(quarantineFullPath);
  await mkdir(dir, { recursive: true });
  await writeFile(quarantineFullPath, buffer);

  log.info('File quarantined', {
    path: relativePath,
    size: buffer.length,
  });

  return {
    quarantinePath: relativePath,
    publicPath: `/${relativePath}`, // Future public URL after approval
  };
}

/**
 * Move a file from quarantine to public directory (after admin approval).
 * Called when admin approves/completes an order.
 */
export async function releaseFromQuarantine(relativePath: string): Promise<boolean> {
  const quarantineSrc = path.join(QUARANTINE_ROOT, relativePath);
  const publicDest = path.join(PUBLIC_ROOT, relativePath);

  try {
    // Check quarantine file exists
    await access(quarantineSrc, constants.F_OK);
  } catch {
    // File not in quarantine — may already be released or using legacy direct upload
    log.warn('Quarantine file not found (may already be released)', { path: relativePath });
    return false;
  }

  try {
    // Ensure target directory exists
    await mkdir(path.dirname(publicDest), { recursive: true });
    // Move file from quarantine to public
    await rename(quarantineSrc, publicDest);
    log.info('File released from quarantine', { path: relativePath });
    return true;
  } catch (error) {
    log.error('Failed to release file from quarantine', {
      path: relativePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Delete a file from quarantine (e.g., when order is rejected).
 */
export async function deleteFromQuarantine(relativePath: string): Promise<boolean> {
  const quarantinePath = path.join(QUARANTINE_ROOT, relativePath);

  try {
    await access(quarantinePath, constants.F_OK);
    await unlink(quarantinePath);
    log.info('Quarantine file deleted', { path: relativePath });
    return true;
  } catch {
    log.warn('Quarantine file not found for deletion', { path: relativePath });
    return false;
  }
}

/**
 * Check if a file is still in quarantine.
 */
export async function isInQuarantine(relativePath: string): Promise<boolean> {
  const quarantinePath = path.join(QUARANTINE_ROOT, relativePath);
  try {
    await access(quarantinePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the full filesystem path for serving a quarantined file
 * (used by admin-only API to preview screenshots before approval).
 */
export function getQuarantineFullPath(relativePath: string): string {
  return path.join(QUARANTINE_ROOT, relativePath);
}
