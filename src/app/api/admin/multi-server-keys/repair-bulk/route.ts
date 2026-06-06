import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import dbConnect from '@/lib/mongodb';
import { createLogger } from '@/lib/logger';
import { getEnabledServers } from '@/lib/vpn-servers';
import {
  reconcileMultiServerKey,
  type ReconciliationClientSnapshot,
  type ReconciliationIssue,
} from '@/lib/vpn-reconciliation';
import { updateVpnClient } from '@/lib/xui';

const log = createLogger({ route: '/api/admin/multi-server-keys/repair-bulk' });

type RepairActionStatus = 'updated' | 'linked' | 'skipped' | 'failed';
type RepairActionType = 'linked_client' | 'orphan_candidate' | 'missing_server' | 'panel_error';

interface RepairAction {
  serverId: string;
  serverName: string;
  type: RepairActionType;
  status: RepairActionStatus;
  email?: string;
  message: string;
  wouldPerform?: boolean; // present when dryRun
}

function toObjectId(id: string) {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return null;
  }
}

function numberValue(value: unknown, fallback = 0): number {
  const valueNumber = Number(value);
  return Number.isFinite(valueNumber) ? valueNumber : fallback;
}

function buildPanelUpdates(record: Record<string, unknown>, includeEnable: boolean) {
  const updates: {
    expiryTime?: number;
    devices?: number;
    dataLimitGB?: number;
    enable?: boolean;
  } = {};

  if (record.expiryTime !== undefined) {
    updates.expiryTime = numberValue(record.expiryTime, 0);
  }
  if (record.devices !== undefined) {
    updates.devices = Math.max(1, Math.trunc(numberValue(record.devices, 1)));
  }
  if (record.dataLimitGB !== undefined) {
    updates.dataLimitGB = numberValue(record.dataLimitGB, 0);
  }
  if (includeEnable) {
    updates.enable = String(record.status || 'active') === 'active';
  }

  return updates;
}

function hasRepairableDrift(issues: ReconciliationIssue[]) {
  const DRIFT_ISSUES = new Set([
    'expiry_mismatch',
    'devices_mismatch',
    'data_limit_mismatch',
    'enable_mismatch',
  ]);
  return issues.some((issue) => DRIFT_ISSUES.has(issue.type));
}

function existingSubLinks(record: Record<string, unknown>) {
  return Array.isArray(record.serverSubLinks) ? record.serverSubLinks.map(String).filter(Boolean) : [];
}

function buildServerSubLink(server: { domain: string; subPort: number }, client: ReconciliationClientSnapshot) {
  if (!client.subId) return '';
  return `https://${server.domain}:${server.subPort}/sub/${client.subId}`;
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
    const body = await request.json();
    const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
    const dryRun = body.dryRun !== false; // default to true
    const includeOrphans = body.includeOrphans !== false;

    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: 'Missing ids' }, { status: 400 });
    }

    const mongooseConn = await dbConnect();
    const db = mongooseConn.connection.getClient().db();

    const enabledServers = await getEnabledServers();
    const serverById = new Map(enabledServers.map((s) => [s.id, s]));

    const results: Array<Record<string, unknown>> = [];

    for (const id of ids) {
      const objectId = toObjectId(id);
      if (!objectId) {
        results.push({ id, success: false, error: 'Invalid id' });
        continue;
      }

      const record = await db.collection('vpn_keys').findOne({ _id: objectId });
      if (!record) {
        results.push({ id, success: false, error: 'Record not found' });
        continue;
      }

      const beforeReport = await reconcileMultiServerKey(record);
      const actions: RepairAction[] = [];
      let nextSubLinks = existingSubLinks(record);
      let subLinksChanged = false;

      for (const serverResult of beforeReport.servers) {
        const server = serverById.get(serverResult.serverId);

        if (serverResult.status === 'error') {
          actions.push({
            serverId: serverResult.serverId,
            serverName: serverResult.serverName,
            type: 'panel_error',
            status: 'skipped',
            message: 'Panel returned an error during reconciliation',
          });
          continue;
        }

        if (serverResult.linkedClient) {
          if (!hasRepairableDrift(serverResult.issues)) {
            actions.push({
              serverId: serverResult.serverId,
              serverName: serverResult.serverName,
              type: 'linked_client',
              status: 'skipped',
              email: serverResult.linkedClient.email,
              message: 'Linked client already matches DB values',
            });
            continue;
          }

          if (dryRun) {
            actions.push({
              serverId: serverResult.serverId,
              serverName: serverResult.serverName,
              type: 'linked_client',
              status: 'skipped',
              email: serverResult.linkedClient.email,
              message: 'Dry-run: would update linked client from DB values',
              wouldPerform: true,
            });
          } else {
            const ok = await updateVpnClient(
              serverResult.serverId,
              serverResult.linkedClient.email,
              buildPanelUpdates(record, true)
            );

            actions.push({
              serverId: serverResult.serverId,
              serverName: serverResult.serverName,
              type: 'linked_client',
              status: ok ? 'updated' : 'failed',
              email: serverResult.linkedClient.email,
              message: ok ? 'Linked client repaired from DB values' : 'Failed to update linked client on panel',
            });
          }

          if (includeOrphans && serverResult.orphanCandidates.length > 0) {
            for (const orphan of serverResult.orphanCandidates) {
              if (dryRun) {
                actions.push({
                  serverId: serverResult.serverId,
                  serverName: serverResult.serverName,
                  type: 'orphan_candidate',
                  status: 'skipped',
                  email: orphan.email,
                  message: 'Dry-run: would update orphan candidate (preserve enable state)',
                  wouldPerform: true,
                });
              } else {
                const orphanOk = await updateVpnClient(
                  serverResult.serverId,
                  orphan.email,
                  buildPanelUpdates(record, false)
                );
                actions.push({
                  serverId: serverResult.serverId,
                  serverName: serverResult.serverName,
                  type: 'orphan_candidate',
                  status: orphanOk ? 'updated' : 'failed',
                  email: orphan.email,
                  message: orphanOk
                    ? 'Orphan candidate repaired without changing enable/disable state'
                    : 'Failed to update orphan candidate',
                });
              }
            }
          }

          continue;
        }

        if (!includeOrphans || serverResult.orphanCandidates.length === 0) {
          actions.push({
            serverId: serverResult.serverId,
            serverName: serverResult.serverName,
            type: 'missing_server',
            status: 'skipped',
            message: 'No linked client found. Use Sync to provision a missing server client.',
          });
          continue;
        }

        if (serverResult.orphanCandidates.length > 1) {
          actions.push({
            serverId: serverResult.serverId,
            serverName: serverResult.serverName,
            type: 'orphan_candidate',
            status: 'skipped',
            message: 'Multiple orphan candidates found. Skipped to avoid linking the wrong client.',
          });
          continue;
        }

        const orphan = serverResult.orphanCandidates[0];
        if (dryRun) {
          actions.push({
            serverId: serverResult.serverId,
            serverName: serverResult.serverName,
            type: 'orphan_candidate',
            status: 'skipped',
            email: orphan.email,
            message: 'Dry-run: would link single orphan candidate to this DB record',
            wouldPerform: true,
          });
        } else {
          const ok = await updateVpnClient(
            serverResult.serverId,
            orphan.email,
            buildPanelUpdates(record, true)
          );

          if (ok && server && orphan.subId) {
            const replacementLink = buildServerSubLink(server, orphan);
            const expectedLinks = new Set(serverResult.expectedSubLinks);
            nextSubLinks = nextSubLinks.filter((link) => !expectedLinks.has(link));
            if (replacementLink && !nextSubLinks.includes(replacementLink)) {
              nextSubLinks.push(replacementLink);
            }
            subLinksChanged = true;
          }

          actions.push({
            serverId: serverResult.serverId,
            serverName: serverResult.serverName,
            type: 'orphan_candidate',
            status: ok ? 'linked' : 'failed',
            email: orphan.email,
            message: ok
              ? 'Single orphan candidate repaired and linked to this DB record'
              : 'Failed to update orphan candidate',
          });
        }
      }

      if (!dryRun && subLinksChanged) {
        await db.collection('vpn_keys').updateOne(
          { _id: objectId },
          { $set: { serverSubLinks: nextSubLinks } }
        );
      }

      const updatedRecord = !dryRun ? await db.collection('vpn_keys').findOne({ _id: objectId }) : record;
      const afterReport = await reconcileMultiServerKey(updatedRecord || record);
      // If we applied changes, sync DB expiryTime to the panel's actual expiryTime to avoid small mismatches.
      let dbExpiryUpdated = false;
      if (!dryRun) {
        const candidateTimes: number[] = [];
        for (const s of afterReport.servers) {
          if (s.linkedClient && s.linkedClient.expiryTime && Number(s.linkedClient.expiryTime) > 0) {
            candidateTimes.push(Number(s.linkedClient.expiryTime));
          }
          if (Array.isArray(s.orphanCandidates) && s.orphanCandidates.length > 0) {
            for (const o of s.orphanCandidates) {
              if (o.expiryTime && Number(o.expiryTime) > 0) candidateTimes.push(Number(o.expiryTime));
            }
          }
        }

        if (candidateTimes.length > 0) {
          const panelExpiry = Math.max(...candidateTimes);
          const currentDbExpiry = numberValue(updatedRecord?.expiryTime ?? record.expiryTime, 0);
          if (panelExpiry > 0 && panelExpiry !== currentDbExpiry) {
            await db.collection('vpn_keys').updateOne({ _id: objectId }, { $set: { expiryTime: panelExpiry } });
            dbExpiryUpdated = true;
          }
        }
      }

      results.push({ id, success: true, data: { actions, before: beforeReport, after: afterReport, subLinksChanged, dbExpiryUpdated } });
    }

    log.info('Bulk repair completed', { count: results.length, dryRun });

    return NextResponse.json({ success: true, message: `Bulk repair ${dryRun ? 'dry-run' : 'applied'} completed`, data: results });
  } catch (error) {
    log.error('Admin bulk repair error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false, error: 'Failed to perform bulk repair' }, { status: 500 });
  }
}
