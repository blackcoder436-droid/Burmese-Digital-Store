import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { sendDocumentToTelegram } from '@/lib/telegram';
import { logActivity } from '@/models/ActivityLog';
import { createLogger } from '@/lib/logger';
import mongoose from 'mongoose';

const log = createLogger({ route: '/api/admin/backup' });

// POST /api/admin/backup — Manual MongoDB backup to Telegram
export async function POST(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const admin = await requireAdmin();
    await connectDB();

    const startTime = Date.now();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Get all collection names from the database
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not connected' },
        { status: 500 }
      );
    }

    const collections = await db.listCollections().toArray();
    const backupData: Record<string, unknown[]> = {};
    let totalDocuments = 0;

    // Sensitive fields to redact from backup
    const REDACT_FIELDS = ['password', 'resetToken', 'resetTokenExpiry', 'tokenVersion'];

    function redactDoc(doc: Record<string, unknown>): Record<string, unknown> {
      const cleaned = { ...doc };
      for (const field of REDACT_FIELDS) {
        if (field in cleaned) {
          cleaned[field] = '[REDACTED]';
        }
      }
      return cleaned;
    }

    for (const col of collections) {
      try {
        const docs = await db.collection(col.name).find({}).toArray();
        // Redact sensitive fields from user-related collections
        const shouldRedact = col.name.toLowerCase().includes('user');
        backupData[col.name] = shouldRedact ? docs.map(d => redactDoc(d as Record<string, unknown>)) : docs;
        totalDocuments += docs.length;
      } catch (err) {
        log.warn(`Failed to backup collection ${col.name}`, {
          error: err instanceof Error ? err.message : String(err),
        });
        backupData[col.name] = [];
      }
    }

    // Convert to JSON
    const jsonStr = JSON.stringify(backupData, null, 0); // minified for size
    const buffer = Buffer.from(jsonStr, 'utf-8');
    const fileSizeKB = (buffer.length / 1024).toFixed(1);
    const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

    // Telegram Bot API limit: 50MB for documents
    if (buffer.length > 50 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: `Backup too large (${fileSizeMB} MB). Telegram limit is 50MB.` },
        { status: 400 }
      );
    }

    const filename = `backup_burmese-digital-store_${timestamp}.json`;
    const dbName = db.databaseName;
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    const caption = [
      `🗄 <b>Manual DB Backup</b>`,
      ``,
      `📅 ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`,
      `📛 Database: <code>${dbName}</code>`,
      `📊 Collections: ${collections.length}`,
      `📄 Documents: ${totalDocuments.toLocaleString()}`,
      `📦 Size: ${Number(fileSizeKB) > 1024 ? `${fileSizeMB} MB` : `${fileSizeKB} KB`}`,
      `⏱ Duration: ${duration}s`,
      `👤 By: ${admin.email || 'Admin'}`,
    ].join('\n');

    const sent = await sendDocumentToTelegram(buffer, filename, caption);

    if (!sent) {
      return NextResponse.json(
        { success: false, error: 'Failed to send backup to Telegram. Check bot token and chat ID.' },
        { status: 500 }
      );
    }

    // Log activity
    try {
      await logActivity({
        admin: admin.userId,
        action: 'database_backup',
        target: `Manual backup — ${dbName}`,
        details: `${collections.length} collections, ${totalDocuments} docs, ${Number(fileSizeKB) > 1024 ? `${fileSizeMB} MB` : `${fileSizeKB} KB`}`,
      });
    } catch { /* non-blocking */ }

    log.info('Manual backup sent to Telegram', {
      collections: collections.length,
      documents: totalDocuments,
      sizeKB: fileSizeKB,
      duration,
    });

    return NextResponse.json({
      success: true,
      data: {
        collections: collections.length,
        documents: totalDocuments,
        size: `${Number(fileSizeKB) > 1024 ? `${fileSizeMB} MB` : `${fileSizeKB} KB`}`,
        duration: `${duration}s`,
      },
      message: 'Backup sent to Telegram successfully',
    });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    log.error('Backup error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Backup failed' },
      { status: 500 }
    );
  }
}
