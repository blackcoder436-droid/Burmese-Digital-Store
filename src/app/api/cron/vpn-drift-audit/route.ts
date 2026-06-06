import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { createLogger } from '@/lib/logger';
import { reconcileMultiServerKey } from '@/lib/vpn-reconciliation';

const log = createLogger({ route: '/api/cron/vpn-drift-audit' });

function verifyCronSecret(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  return !cronSecret || authHeader === `Bearer ${cronSecret}`;
}

function parseLimit(value: string | null) {
  const parsed = Number(value || '50');
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(200, Math.max(1, Math.trunc(parsed)));
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get('limit'));

    const mongooseConn = await dbConnect();
    const db = mongooseConn.connection.getClient().db();
    const records = await db.collection('vpn_keys')
      .find({
        $or: [
          { keyType: 'migrated_web' },
          { serverSubLinks: { $exists: true, $ne: [] } },
          { serverConfigLinks: { $exists: true, $ne: [] } },
        ],
      })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(limit)
      .toArray();

    const results = [];
    const summary = {
      mode: 'read-only',
      scanned: records.length,
      driftRecords: 0,
      ok: 0,
      drift: 0,
      missing: 0,
      orphan: 0,
      unlinked: 0,
      error: 0,
      orphanCandidates: 0,
    };

    for (const record of records) {
      const recordId = String(record._id);
      const report = await reconcileMultiServerKey(record);
      const hasDrift = report.summary.drift > 0
        || report.summary.missing > 0
        || report.summary.orphan > 0
        || report.summary.unlinked > 0
        || report.summary.error > 0;
      if (hasDrift) summary.driftRecords += 1;
      summary.ok += report.summary.ok;
      summary.drift += report.summary.drift;
      summary.missing += report.summary.missing;
      summary.orphan += report.summary.orphan;
      summary.unlinked += report.summary.unlinked;
      summary.error += report.summary.error;
      summary.orphanCandidates += report.summary.orphanCandidates;
      results.push({
        recordId,
        username: record.username || record.token || '',
        mode: 'read-only',
        summary: report.summary,
      });
    }

    log.info('Cron: vpn-drift-audit completed', summary);

    return NextResponse.json({
      success: true,
      data: { summary, results },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Cron: vpn-drift-audit failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
