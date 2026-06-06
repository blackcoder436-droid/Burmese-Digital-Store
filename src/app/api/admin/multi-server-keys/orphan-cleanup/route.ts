import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import dbConnect from '@/lib/mongodb';
import { createLogger } from '@/lib/logger';
import {
  reconcileMultiServerKey,
  type MultiServerKeyReconciliationReport,
  type ReconciliationClientSnapshot,
  type ServerReconciliationResult,
} from '@/lib/vpn-reconciliation';

const log = createLogger({ route: '/api/admin/multi-server-keys/orphan-cleanup' });

type CleanupRecommendation =
  | 'none'
  | 'link_with_repair'
  | 'sync_missing'
  | 'review_disable_duplicate'
  | 'review_delete_disabled_duplicate'
  | 'manual_review'
  | 'panel_error';

type CleanupRisk = 'low' | 'medium' | 'high';

interface OrphanCleanupItem {
  serverId: string;
  serverName: string;
  recommendation: CleanupRecommendation;
  risk: CleanupRisk;
  reason: string;
  linkedClientEmail?: string;
  candidate?: ReconciliationClientSnapshot;
}

function toObjectId(id: string) {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return null;
  }
}

function buildCleanupItems(report: MultiServerKeyReconciliationReport): OrphanCleanupItem[] {
  const items: OrphanCleanupItem[] = [];

  for (const server of report.servers) {
    if (server.status === 'error') {
      items.push({
        serverId: server.serverId,
        serverName: server.serverName,
        recommendation: 'panel_error',
        risk: 'high',
        reason: 'Panel could not be checked. Fix panel/API connectivity before cleanup.',
      });
      continue;
    }

    if (!server.linkedClient && server.orphanCandidates.length === 0 && server.status === 'missing') {
      items.push({
        serverId: server.serverId,
        serverName: server.serverName,
        recommendation: 'sync_missing',
        risk: 'medium',
        reason: 'DB has a server sub link, but the panel client is missing. Use Sync to recreate or relink.',
      });
      continue;
    }

    if (server.orphanCandidates.length === 0) continue;

    if (!server.linkedClient && server.orphanCandidates.length === 1) {
      items.push({
        serverId: server.serverId,
        serverName: server.serverName,
        recommendation: 'link_with_repair',
        risk: 'low',
        reason: 'Exactly one matching unlinked client was found. Repair can safely link it to this DB record.',
        candidate: server.orphanCandidates[0],
      });
      continue;
    }

    if (!server.linkedClient && server.orphanCandidates.length > 1) {
      for (const candidate of server.orphanCandidates) {
        items.push({
          serverId: server.serverId,
          serverName: server.serverName,
          recommendation: 'manual_review',
          risk: 'high',
          reason: 'Multiple matching unlinked clients were found. Manual selection is required to avoid linking the wrong client.',
          candidate,
        });
      }
      continue;
    }

    for (const candidate of server.orphanCandidates) {
      items.push(buildDuplicateCleanupItem(server, candidate));
    }
  }

  return items;
}

function buildDuplicateCleanupItem(
  server: ServerReconciliationResult,
  candidate: ReconciliationClientSnapshot
): OrphanCleanupItem {
  const enabled = candidate.enable !== false;

  return {
    serverId: server.serverId,
    serverName: server.serverName,
    recommendation: enabled ? 'review_disable_duplicate' : 'review_delete_disabled_duplicate',
    risk: enabled ? 'medium' : 'low',
    reason: enabled
      ? 'A linked client already exists, and this matching orphan is still enabled. Review it, then disable if it is a duplicate.'
      : 'A linked client already exists, and this matching orphan is disabled. Review it before deleting or keeping it as an audit trail.',
    linkedClientEmail: server.linkedClient?.email,
    candidate,
  };
}

function buildSummary(items: OrphanCleanupItem[]) {
  return items.reduce(
    (acc, item) => {
      acc.totalItems += 1;
      acc[item.recommendation] += 1;
      if (item.candidate) acc.orphanCandidates += 1;
      if (!acc.affectedServerIds.includes(item.serverId)) acc.affectedServerIds.push(item.serverId);
      return acc;
    },
    {
      totalItems: 0,
      affectedServerIds: [] as string[],
      orphanCandidates: 0,
      none: 0,
      link_with_repair: 0,
      sync_missing: 0,
      review_disable_duplicate: 0,
      review_delete_disabled_duplicate: 0,
      manual_review: 0,
      panel_error: 0,
    }
  );
}

export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id')?.trim() || '';
    const objectId = toObjectId(id);

    if (!objectId) {
      return NextResponse.json({ success: false, error: 'Missing or invalid record id' }, { status: 400 });
    }

    const mongooseConn = await dbConnect();
    const db = mongooseConn.connection.getClient().db();
    const record = await db.collection('vpn_keys').findOne({ _id: objectId });

    if (!record) {
      return NextResponse.json({ success: false, error: 'Record not found' }, { status: 404 });
    }

    const reconciliation = await reconcileMultiServerKey(record);
    const items = buildCleanupItems(reconciliation);
    const summary = buildSummary(items);

    log.info('Orphan cleanup dry-run completed', {
      recordId: id,
      itemCount: items.length,
      affectedServers: summary.affectedServerIds.length,
    });

    return NextResponse.json({
      success: true,
      message: items.length === 0
        ? 'Dry-run complete: no cleanup candidates found'
        : `Dry-run complete: ${items.length} cleanup recommendation(s) found`,
      data: {
        dryRun: true,
        generatedAt: new Date().toISOString(),
        record: {
          ...record,
          _id: String(record._id),
        },
        summary: {
          ...summary,
          affectedServers: summary.affectedServerIds.length,
        },
        items,
        reconciliation,
      },
    });
  } catch (error) {
    log.error('Admin orphan cleanup dry-run error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: 'Failed to run orphan cleanup dry-run' }, { status: 500 });
  }
}
