'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Copy,
  Eye,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Trash2,
  Wrench,
  XCircle,
  X,
} from 'lucide-react';

interface MultiServerKeyRecord {
  _id: string;
  token: string;
  username: string;
  devices: number;
  expiryTime?: number;
  dataLimitGB?: number;
  status?: string;
  createdAt?: string;
  serverSubLinks?: string[];
  serverConfigLinks?: string[];
  migratedFromToken?: string;
}

interface ResolvedClient {
  serverId: string;
  serverName: string;
  source: 'config' | 'sub' | 'name';
  link?: string;
  client: {
    email: string;
    protocol: string;
    enable: boolean;
    expiryTime: number;
    limitIp: number;
    totalGB: number;
    up: number;
    down: number;
    tgId: string;
    subId: string;
    serverId: string;
    serverName: string;
  };
}

interface MultiServerKeyDetailsResponse {
  record: MultiServerKeyRecord;
  clients: ResolvedClient[];
  unresolvedLinks: string[];
  summary: {
    resolvedServers: number;
    totalServers: number;
    totalLinks: number;
  };
}

type ReconciliationStatus = 'ok' | 'drift' | 'missing' | 'orphan' | 'unlinked' | 'error';

interface ReconciliationClientSnapshot {
  email: string;
  protocol: string;
  enable: boolean;
  expiryTime: number;
  limitIp: number;
  totalGB: number;
  up: number;
  down: number;
  subId: string;
  clientId: string;
  clientPassword: string;
}

interface ReconciliationIssue {
  type: string;
  message: string;
  expected?: string | number | boolean;
  actual?: string | number | boolean;
}

interface ServerReconciliationResult {
  serverId: string;
  serverName: string;
  status: ReconciliationStatus;
  expectedSubIds: string[];
  expectedSubLinks: string[];
  issues: ReconciliationIssue[];
  linkedClient: ReconciliationClientSnapshot | null;
  orphanCandidates: ReconciliationClientSnapshot[];
}

interface ReconciliationReport {
  generatedAt: string;
  expected: {
    expiryTime: number;
    devices: number;
    totalGB: number;
    enable: boolean;
  };
  summary: {
    totalServers: number;
    ok: number;
    drift: number;
    missing: number;
    orphan: number;
    unlinked: number;
    error: number;
    orphanCandidates: number;
  };
  servers: ServerReconciliationResult[];
}

interface ReconciliationResponse {
  record: MultiServerKeyRecord;
  report: ReconciliationReport;
}

interface RepairAction {
  serverId: string;
  serverName: string;
  type: 'linked_client' | 'orphan_candidate' | 'missing_server' | 'panel_error';
  status: 'updated' | 'linked' | 'skipped' | 'failed';
  email?: string;
  message: string;
}

interface RepairResponse {
  actions: RepairAction[];
  before: ReconciliationReport;
  after: ReconciliationReport;
  subLinksChanged: boolean;
}

type CleanupRecommendation =
  | 'none'
  | 'link_with_repair'
  | 'sync_missing'
  | 'review_disable_duplicate'
  | 'review_delete_disabled_duplicate'
  | 'manual_review'
  | 'panel_error';

interface OrphanCleanupItem {
  serverId: string;
  serverName: string;
  recommendation: CleanupRecommendation;
  risk: 'low' | 'medium' | 'high';
  reason: string;
  linkedClientEmail?: string;
  candidate?: ReconciliationClientSnapshot;
}

interface OrphanCleanupReport {
  dryRun: true;
  generatedAt: string;
  record: MultiServerKeyRecord;
  summary: {
    totalItems: number;
    affectedServerIds: string[];
    affectedServers: number;
    orphanCandidates: number;
    none: number;
    link_with_repair: number;
    sync_missing: number;
    review_disable_duplicate: number;
    review_delete_disabled_duplicate: number;
    manual_review: number;
    panel_error: number;
  };
  items: OrphanCleanupItem[];
  reconciliation: ReconciliationReport;
}

interface PanelMutationReport {
  generatedAt: string;
  source: '3xui';
  webDbKeyFieldsChanged: false;
  mutation: 'update' | 'delete';
  summary: {
    total: number;
    updated: number;
    deleted: number;
    skipped: number;
    failed: number;
  };
  actions: Array<{
    serverId: string;
    serverName: string;
    mutation: 'update' | 'delete';
    status: 'updated' | 'deleted' | 'skipped' | 'failed';
    email?: string;
    source?: string;
    message: string;
  }>;
}

interface LiveKeySummary {
  recordId: string;
  generatedAt: string;
  resolvedServers: number;
  totalServers: number;
  consistent: boolean;
  status: 'active' | 'disabled' | 'expired' | 'unknown';
  devices: number | null;
  expiryTime: number | null;
  dataLimitBytes: number | null;
  usedBytes: number | null;
  sourceServerName: string;
}

interface SummaryCounts {
  active: number;
  expired: number;
  disabled: number;
  total: number;
}

type CreateKeyMode = 'test' | 'sell';

interface CreateKeyForm {
  mode: CreateKeyMode;
  username: string;
  protocol: 'trojan' | 'vless' | 'vmess' | 'shadowsocks';
  devices: number;
  expiryDays: number;
  dataLimitGB: number;
}

const DEFAULT_CREATE_FORM: CreateKeyForm = {
  mode: 'test',
  username: '',
  protocol: 'vless',
  devices: 1,
  expiryDays: 3,
  dataLimitGB: 3,
};

export default function AdminMultiServerKeysPage() {
  const [keys, setKeys] = useState<MultiServerKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveSummaries, setLiveSummaries] = useState<Record<string, LiveKeySummary>>({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryCounts>({ active: 0, expired: 0, disabled: 0, total: 0 });
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MultiServerKeyRecord | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<MultiServerKeyDetailsResponse | null>(null);
  const [reconciliation, setReconciliation] = useState<ReconciliationResponse | null>(null);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcileError, setReconcileError] = useState('');
  const [repairingId, setRepairingId] = useState<string | null>(null);
  const [repairMessage, setRepairMessage] = useState('');
  const [repairError, setRepairError] = useState('');
  const [repairResult, setRepairResult] = useState<RepairResponse | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupError, setCleanupError] = useState('');
  const [cleanupReport, setCleanupReport] = useState<OrphanCleanupReport | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<any>(null);
  const [bulkDryRunResult, setBulkDryRunResult] = useState<any>(null);
  const [bulkError, setBulkError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MultiServerKeyRecord | null>(null);
  const [editDevices, setEditDevices] = useState(1);
  const [editExpiryDate, setEditExpiryDate] = useState<string>('');
  const [editUnlimitedExpiry, setEditUnlimitedExpiry] = useState<boolean>(false);
  const [editDataLimit, setEditDataLimit] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingKey, setCreatingKey] = useState(false);
  const [createForm, setCreateForm] = useState<CreateKeyForm>(DEFAULT_CREATE_FORM);

  useEffect(() => {
    fetchKeys();
  }, [page, search, statusFilter]);

  async function fetchKeys() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      });
      if (search.trim()) {
        params.set('q', search.trim());
      }
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const res = await fetch(`/api/admin/multi-server-keys?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        const nextKeys = data.data.keys as MultiServerKeyRecord[];
        setKeys(nextKeys);
        setTotalPages(data.data.totalPages);
        setSummary(data.data.summary || { active: 0, expired: 0, disabled: 0, total: 0 });
        void fetchLiveSummaries(nextKeys);
      } else {
        setError(data.error || 'Failed to load records');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchLiveSummaries(records: MultiServerKeyRecord[]) {
    if (records.length === 0) {
      setLiveSummaries({});
      return;
    }

    setLiveLoading(true);
    try {
      const res = await fetch('/api/admin/multi-server-keys/live-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: records.map((record) => record._id) }),
      });
      const data = await res.json();
      if (data.success) {
        setLiveSummaries(data.data?.summaries || {});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLiveLoading(false);
    }
  }

  async function openDetails(record: MultiServerKeyRecord) {
    setSelectedRecord(record);
    setSelectedDetails(null);
    setReconciliation(null);
    setDetailsError('');
    setReconcileError('');
    setRepairMessage('');
    setRepairError('');
    setRepairResult(null);
    setCleanupError('');
    setCleanupReport(null);
    setDetailsLoading(true);
    setShowDetailsModal(true);
    try {
      const res = await fetch(`/api/admin/multi-server-keys/details?id=${encodeURIComponent(record._id)}`);
      const data = await res.json();
      if (data.success) {
        setSelectedDetails(data.data as MultiServerKeyDetailsResponse);
      } else {
        setDetailsError(data.error || 'Failed to load key details');
      }
    } catch (err) {
      setDetailsError('Network error. Please try again.');
      console.error(err);
    } finally {
      setDetailsLoading(false);
    }

    fetchReconciliation(record);
  }

  async function fetchReconciliation(record: MultiServerKeyRecord) {
    setReconcileLoading(true);
    setReconcileError('');
    try {
      const res = await fetch(`/api/admin/multi-server-keys/reconcile?id=${encodeURIComponent(record._id)}`);
      const data = await res.json();
      if (data.success) {
        setReconciliation(data.data as ReconciliationResponse);
      } else {
        setReconcileError(data.error || 'Failed to run reconciliation');
      }
    } catch (err) {
      setReconcileError('Network error while running reconciliation.');
      console.error(err);
    } finally {
      setReconcileLoading(false);
    }
  }

  async function refreshDetails(record: MultiServerKeyRecord) {
    try {
      const res = await fetch(`/api/admin/multi-server-keys/details?id=${encodeURIComponent(record._id)}`);
      const data = await res.json();
      if (data.success) {
        setSelectedDetails(data.data as MultiServerKeyDetailsResponse);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function loadDetails(record: MultiServerKeyRecord) {
    const res = await fetch(`/api/admin/multi-server-keys/details?id=${encodeURIComponent(record._id)}`);
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to load live 3xUI details');
    }
    return data.data as MultiServerKeyDetailsResponse;
  }

  const MMT_OFFSET_MS = 6 * 60 * 60 * 1000 + 30 * 60 * 1000;
  const MMT_SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function pad2(value: number) {
    return String(value).padStart(2, '0');
  }

  function formatDate(ms?: number) {
    if (!ms || ms <= 0) return 'Unlimited';
    const date = new Date(ms + MMT_OFFSET_MS);
    return `${pad2(date.getUTCDate())} ${MMT_SHORT_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  }

  function formatDateTime(ms?: number) {
    if (!ms || ms <= 0) return 'Unlimited';
    const date = new Date(ms + MMT_OFFSET_MS);
    return `${pad2(date.getUTCDate())} ${MMT_SHORT_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()} ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}`;
  }

  function getDriftWarningBadge(reconciliation?: ReconciliationResponse | null, recordId?: string) {
    if (!reconciliation || reconciliation.record._id !== recordId) return null;
    const { drift, missing, orphanCandidates, unlinked, error } = reconciliation.report.summary;
    if (error > 0) {
      return { label: 'Panel errors detected', variant: 'border-red-500/20 bg-red-500/10 text-red-300' };
    }
    if (missing > 0) {
      return { label: 'Missing panel clients', variant: 'border-red-500/20 bg-red-500/10 text-red-300' };
    }
    if (unlinked > 0) {
      return { label: 'Unlinked server(s) detected', variant: 'border-orange-500/20 bg-orange-500/10 text-orange-200' };
    }
    if (orphanCandidates > 0) {
      return { label: 'Potential orphan client(s)', variant: 'border-amber-500/20 bg-amber-500/10 text-amber-300' };
    }
    if (drift > 0) {
      return { label: 'Panel drift detected', variant: 'border-amber-500/20 bg-amber-500/10 text-amber-300' };
    }
    return null;
  }

  function formatGb(bytes?: number) {
    if (!bytes || bytes <= 0) return '∞';
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  function formatTraffic(bytes?: number | null) {
    if (!bytes || bytes <= 0) return '0.00 GB';
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  function getStatusBadge(status?: string) {
    if (status === 'disabled') {
      return 'bg-red-500/10 text-red-300 border-red-500/20';
    }
    if (status === 'expired') {
      return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
    }
    return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
  }

  function getReconciliationBadge(status: ReconciliationStatus) {
    if (status === 'ok') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
    if (status === 'drift') return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
    if (status === 'missing' || status === 'error') return 'border-red-500/20 bg-red-500/10 text-red-300';
    if (status === 'orphan') return 'border-orange-500/20 bg-orange-500/10 text-orange-300';
    return 'border-slate-500/20 bg-slate-500/10 text-slate-300';
  }

  function getCleanupRiskBadge(risk: OrphanCleanupItem['risk']) {
    if (risk === 'low') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
    if (risk === 'medium') return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
    return 'border-red-500/20 bg-red-500/10 text-red-300';
  }

  function getCleanupRecommendationLabel(recommendation: CleanupRecommendation) {
    const labels: Record<CleanupRecommendation, string> = {
      none: 'No action',
      link_with_repair: 'Repair can link',
      sync_missing: 'Use Create',
      review_disable_duplicate: 'Review disable',
      review_delete_disabled_duplicate: 'Review delete',
      manual_review: 'Manual review',
      panel_error: 'Panel error',
    };
    return labels[recommendation];
  }

  function formatPanelMutationSummary(panel?: PanelMutationReport | null) {
    if (!panel) return '';
    if (panel.mutation === 'delete') {
      return `3xUI live delete: ${panel.summary.deleted} deleted, ${panel.summary.skipped} skipped, ${panel.summary.failed} failed. WEB record kept.`;
    }
    return `3xUI live update: ${panel.summary.updated} updated, ${panel.summary.skipped} skipped, ${panel.summary.failed} failed. WEB key fields unchanged.`;
  }

  function formatIssueValue(value?: string | number | boolean) {
    if (value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'enabled' : 'disabled';
    if (typeof value === 'number' && value > 1_000_000_000_000) return formatDateTime(value);
    if (typeof value === 'number' && value > 1024 * 1024) return formatGb(value);
    return String(value);
  }

  async function copyToClipboard(value: string, id: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      setError('Unable to copy to clipboard');
      console.error(err);
    }
  }

  async function updateRecord(id: string, updates: Record<string, unknown>) {
    try {
      const res = await fetch('/api/admin/multi-server-keys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Update failed');
      }
      const panel = data.data?.panel as PanelMutationReport | null | undefined;
      const panelMessage = formatPanelMutationSummary(panel);
      if (panelMessage) {
        window.alert(panelMessage);
      }
      await fetchKeys();
      if (selectedRecord?._id === id) {
        await refreshDetails(selectedRecord);
      }
      return data.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update record');
      console.error(err);
      return null;
    }
  }

  async function deleteRecord(id: string) {
    if (!window.confirm('Delete live 3xUI clients for this key? WEB order/history record will be kept.')) {
      return;
    }
    try {
      const res = await fetch('/api/admin/multi-server-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Delete failed');
      }
      const panel = data.data?.panel as PanelMutationReport | null | undefined;
      window.alert(formatPanelMutationSummary(panel) || data.message || '3xUI live clients deleted.');
      await fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete record');
      console.error(err);
    }
  }

  async function toggleStatus(record: MultiServerKeyRecord) {
    setSyncingId(record._id);
    try {
      const details = selectedDetails?.record._id === record._id ? selectedDetails : await loadDetails(record);
      const liveClient = details.clients[0]?.client;
      const liveEnabled = liveClient ? liveClient.enable !== false && !(liveClient.expiryTime > 0 && liveClient.expiryTime < Date.now()) : record.status !== 'disabled';
      const nextStatus = liveEnabled ? 'disabled' : 'active';
      await updateRecord(record._id, { status: nextStatus });
      if (selectedRecord?._id === record._id) {
        await refreshDetails(record);
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to update live 3xUI status');
      console.error(err);
    } finally {
      setSyncingId(null);
    }
  }

  async function syncRecord(record: MultiServerKeyRecord) {
    setSyncingId(record._id);
    try {
      const res = await fetch('/api/admin/multi-server-keys/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: record._id }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Refresh failed');
      }
      const refreshed = data.data as ReconciliationResponse;
      if (refreshed?.report) {
        setReconciliation(refreshed);
      }
      window.alert(data.message || 'Live 3xUI refresh complete.');
      await Promise.all([fetchKeys(), refreshDetails(record)]);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to refresh live 3xUI state');
      console.error(err);
    } finally {
      setSyncingId(null);
    }
  }

  function openEditModal(record: MultiServerKeyRecord, liveClient?: ResolvedClient['client']) {
    setEditingRecord(record);
    setEditDevices(liveClient?.limitIp || record.devices || 1);
    
    const expiryTime = liveClient?.expiryTime ?? record.expiryTime;
    if (expiryTime && expiryTime > 0) {
      setEditUnlimitedExpiry(false);
      // Convert stored UTC expiryTime to Myanmar local date (MMT UTC+6:30)
      const MMT_OFFSET_MS = 6 * 60 * 60 * 1000 + 30 * 60 * 1000; // 6h30m
      const mmtDate = new Date(Number(expiryTime) + MMT_OFFSET_MS);
      const year = mmtDate.getUTCFullYear();
      const month = String(mmtDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(mmtDate.getUTCDate()).padStart(2, '0');
      setEditExpiryDate(`${year}-${month}-${day}`);
    } else {
      setEditUnlimitedExpiry(true);
      setEditExpiryDate('');
    }
    
    const liveDataLimitGB = liveClient?.totalGB ? Math.round(liveClient.totalGB / (1024 * 1024 * 1024)) : undefined;
    setEditDataLimit(liveDataLimitGB ?? record.dataLimitGB ?? 0);
    setShowEditModal(true);
  }

  async function openLiveEditModal(record: MultiServerKeyRecord) {
    setEditingId(record._id);
    try {
      const details = selectedDetails?.record._id === record._id ? selectedDetails : await loadDetails(record);
      openEditModal(record, details.clients[0]?.client);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to load live 3xUI values');
      console.error(err);
    } finally {
      setEditingId(null);
    }
  }

  async function repairRecord(record: MultiServerKeyRecord) {
    // Step 1: Dry-run to preview actions
    setRepairingId(record._id);
    setRepairMessage('Running dry-run...');
    setRepairError('');
    setRepairResult(null);
    setCleanupError('');
    setCleanupReport(null);

    try {
      const res = await fetch('/api/admin/multi-server-keys/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: record._id, includeOrphans: true, dryRun: true }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Dry-run failed');

      const dryRunData = data.data as RepairResponse;
      setRepairResult(dryRunData);
      setRepairMessage('Dry-run completed.');

      // Ask admin to confirm applying changes
      const proceed = window.confirm(
        `Dry-run found ${dryRunData.actions.length} action(s). Apply changes now?`
      );
      if (!proceed) return;

      // Step 2: Apply changes
      setRepairMessage('Applying changes...');
      const res2 = await fetch('/api/admin/multi-server-keys/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: record._id, includeOrphans: true, dryRun: false }),
      });
      const data2 = await res2.json();
      if (!data2.success) throw new Error(data2.error || 'Repair failed');

      const repairData = data2.data as RepairResponse;
      setRepairResult(repairData);
      setRepairMessage(data2.message || 'Repair applied.');
      setReconciliation({ record, report: repairData.after });
      await Promise.all([fetchKeys(), refreshDetails(record)]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to repair record';
      setRepairError(message);
      window.alert(message);
      console.error(err);
    } finally {
      setRepairingId(null);
    }
  }

  async function runCleanupDryRun(record: MultiServerKeyRecord) {
    setCleanupLoading(true);
    setCleanupError('');
    setCleanupReport(null);

    try {
      const res = await fetch(`/api/admin/multi-server-keys/orphan-cleanup?id=${encodeURIComponent(record._id)}`);
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Cleanup dry-run failed');
      }

      const report = data.data as OrphanCleanupReport;
      setCleanupReport(report);
      setReconciliation({ record, report: report.reconciliation });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to run cleanup dry-run';
      setCleanupError(message);
      console.error(err);
    } finally {
      setCleanupLoading(false);
    }
  }

  function toggleSelectId(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleBulkRepair() {
    if (selectedIds.length === 0) return;
    setBulkLoading(true);
    setBulkError('');
    setBulkResult(null);
    setBulkDryRunResult(null);
    try {
      // Dry-run first
      const res = await fetch('/api/admin/multi-server-keys/repair-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, dryRun: true, includeOrphans: true }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Dry-run failed');
      setBulkDryRunResult(data.data || []);

      const proceed = window.confirm(`Dry-run completed for ${selectedIds.length} record(s). Proceed to apply changes?`);
      if (!proceed) return;

      const res2 = await fetch('/api/admin/multi-server-keys/repair-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, dryRun: false, includeOrphans: true }),
      });
      const data2 = await res2.json();
      if (!data2.success) throw new Error(data2.error || 'Bulk repair failed');
      setBulkResult(data2.data || []);
      setBulkDryRunResult(null);
      window.alert('Bulk repair applied.');
      await fetchKeys();
      setSelectedIds([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setBulkError(message);
      window.alert(message);
      console.error(err);
    } finally {
      setBulkLoading(false);
    }
  }

  function openCreateModal(mode: CreateKeyMode) {
    setCreateForm(mode === 'test'
      ? { ...DEFAULT_CREATE_FORM, mode, protocol: 'vless', devices: 1, expiryDays: 3, dataLimitGB: 3 }
      : { ...DEFAULT_CREATE_FORM, mode, protocol: 'trojan', devices: 2, expiryDays: 30, dataLimitGB: 0 });
    setShowCreateModal(true);
  }

  async function handleCreateKey() {
    const username = createForm.username.trim();
    if (!username) {
      window.alert('Key name is required');
      return;
    }

    setCreatingKey(true);
    try {
      const res = await fetch('/api/admin/vpn-keys/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId: 'all',
          type: createForm.mode,
          protocol: createForm.protocol,
          username,
          devices: createForm.devices,
          expiryDays: createForm.expiryDays,
          dataLimitGB: createForm.dataLimitGB,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to create key');
      }

      setShowCreateModal(false);
      setCreateForm(DEFAULT_CREATE_FORM);
      await fetchKeys();
      window.alert(`Created key for ${data.data?.servers?.length || 0} server(s).`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to create key');
    } finally {
      setCreatingKey(false);
    }
  }

  async function handleSaveEdit() {
    if (!editingRecord) return;
    
    setEditingId(editingRecord._id);
    setShowEditModal(false); // Close modal immediately
    
    try {
      let expiryTime = 0;
      if (!editUnlimitedExpiry && editExpiryDate) {
        // Interpret the selected date as Myanmar local day end (23:59:59.999 MMT)
        // and convert to UTC epoch ms for storage.
        const parts = editExpiryDate.split('-').map((p) => Number(p));
        if (parts.length === 3) {
          const [y, m, d] = parts;
          const MMT_OFFSET_MS = 6 * 60 * 60 * 1000 + 30 * 60 * 1000; // 6h30m
          // Date.UTC gives ms for the given Y/M/D 23:59:59.999 in UTC,
          // subtract MMT offset to get the UTC instant that corresponds to 23:59:59.999 MMT.
          expiryTime = Date.UTC(y, m - 1, d, 23, 59, 59, 999) - MMT_OFFSET_MS;
        }
      }
      
      await updateRecord(editingRecord._id, { expiryTime, dataLimitGB: editDataLimit, devices: editDevices });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to update record');
      console.error(err);
    } finally {
      setEditingId(null);
      setEditingRecord(null);
    }
  }

  const driftBadge = getDriftWarningBadge(reconciliation, selectedRecord?._id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Multi-Server Key Management</h1>
          <p className="text-sm text-gray-400 mt-1">All bot/web VPN orders and migrated multi-server keys live here in one place.</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => openCreateModal('test')}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
          >
            <Sparkles className="h-4 w-4" />
            Free Test Key
          </button>
          <button
            type="button"
            onClick={() => openCreateModal('sell')}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
          >
            <Plus className="h-4 w-4" />
            Sell Key
          </button>
          <button
            type="button"
            onClick={() => handleBulkRepair()}
            disabled={selectedIds.length === 0 || bulkLoading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-40"
          >
            <Wrench className="h-4 w-4" />
            Bulk Repair
          </button>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search token or username"
            className="min-w-[220px] rounded-2xl border border-white/10 bg-[#0b0b19] px-4 py-2 text-sm text-white outline-none focus:border-purple-400"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-2xl border border-white/10 bg-[#0b0b19] px-4 py-2 text-sm text-white outline-none focus:border-purple-400"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {(bulkError || bulkDryRunResult || bulkResult) && (
        <div
          className={`rounded-3xl border p-4 text-sm space-y-3 mt-3 ${bulkError ? 'border-red-500/20 bg-red-500/10 text-red-200' : bulkResult ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100' : 'border-amber-500/20 bg-amber-500/10 text-amber-100'}`}>
          {bulkError ? (
            <div>
              <div className="font-semibold">Bulk repair error</div>
              <div className="text-gray-200 mt-1">{bulkError}</div>
            </div>
          ) : null}

          {bulkDryRunResult && !bulkResult ? (
            <div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">Bulk repair dry-run completed</div>
                  <div className="text-gray-300">Selected records: {selectedIds.length}</div>
                </div>
                <div className="text-xs uppercase tracking-[0.2em] text-gray-400">Preview only</div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-xs text-gray-400">Records</div>
                  <div className="mt-1 text-xl font-semibold text-white">{bulkDryRunResult.length}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-xs text-gray-400">Actions</div>
                  <div className="mt-1 text-xl font-semibold text-emerald-300">{bulkDryRunResult.reduce((sum: number, item: any) => sum + ((item?.data?.actions?.length ?? 0)), 0)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-xs text-gray-400">Failed</div>
                  <div className="mt-1 text-xl font-semibold text-red-300">{bulkDryRunResult.reduce((sum: number, item: any) => sum + (item?.data?.actions?.filter((action: any) => action.status === 'failed').length ?? 0), 0)}</div>
                </div>
              </div>
            </div>
          ) : null}

          {bulkResult ? (
            <div>
              <div className="font-semibold">Bulk repair applied successfully</div>
              <div className="text-gray-300 mt-1">Updated {bulkResult.length} record(s).</div>
            </div>
          ) : null}
        </div>
      )}

      <div className="game-card p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="rounded-3xl border border-purple-500/10 bg-[#0d0d1f] p-4">
              <div className="text-sm text-gray-400">Total</div>
              <div className="mt-2 text-2xl font-semibold text-white">{summary.total}</div>
            </div>
            <div className="rounded-3xl border border-emerald-500/10 bg-[#0d0d1f] p-4">
              <div className="text-sm text-gray-400">Active</div>
              <div className="mt-2 text-2xl font-semibold text-emerald-300">{summary.active}</div>
            </div>
            <div className="rounded-3xl border border-amber-500/10 bg-[#0d0d1f] p-4">
              <div className="text-sm text-gray-400">Expired</div>
              <div className="mt-2 text-2xl font-semibold text-amber-300">{summary.expired}</div>
            </div>
            <div className="rounded-3xl border border-red-500/10 bg-[#0d0d1f] p-4">
              <div className="text-sm text-gray-400">Disabled</div>
              <div className="mt-2 text-2xl font-semibold text-red-300">{summary.disabled}</div>
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-gray-400">Loading multi-server keys…</div>
          ) : error ? (
            <div className="py-16 text-center text-red-400">{error}</div>
          ) : keys.length === 0 ? (
            <div className="py-16 text-center text-gray-400">No multi-server key records found.</div>
          ) : (
            <div className="overflow-x-auto pb-4">
              <table className="min-w-full border-collapse text-sm whitespace-nowrap">
              <thead>
                <tr className="text-left text-gray-400 border-b border-white/10 uppercase text-xs tracking-[0.2em]">
                  <th className="px-4 py-3 font-medium">
                    <input
                      type="checkbox"
                      checked={selectedIds.length > 0 && selectedIds.length === keys.length}
                      onChange={(e) => { if (e.target.checked) setSelectedIds(keys.map(k => k._id)); else setSelectedIds([]); }}
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">Token</th>
                  <th className="px-4 py-3 font-medium">Username</th>
                  <th className="px-4 py-3 font-medium">Devices</th>
                  <th className="px-4 py-3 font-medium">Expiry</th>
                  <th className="px-4 py-3 font-medium">Data Limit</th>
                  <th className="px-4 py-3 font-medium">Servers</th>
                  <th className="px-4 py-3 font-medium">Multi-sub</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((record) => {
                  const live = liveSummaries[record._id];
                  const displayStatus = live?.status && live.status !== 'unknown' ? live.status : (record.status || 'active');
                  const displayDevices = live?.devices ?? record.devices ?? 1;
                  const displayExpiry = live?.expiryTime ?? record.expiryTime;
                  const displayDataLimit = live?.dataLimitBytes ?? (
                    (record.dataLimitGB ?? 0) > 0 ? (record.dataLimitGB || 0) * 1024 * 1024 * 1024 : 0
                  );

                  return (
                  <tr
                    key={record._id}
                    onClick={() => openDetails(record)}
                    className="border-b border-white/10 hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-gray-200" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(record._id)}
                        onChange={() => toggleSelectId(record._id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-4 py-3 text-white">
                      <div className="font-medium">{record.token.slice(0, 8)}…</div>
                      <div className="text-[10px] text-gray-500">{record.migratedFromToken ? `from ${record.migratedFromToken.slice(0, 8)}…` : 'direct'}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-200">{record.username}</td>
                    <td className="px-4 py-3 text-gray-200">
                      <div>{displayDevices}</div>
                      {live && <div className="text-[10px] text-emerald-300">live</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-200 text-xs">
                      <div>{formatDate(displayExpiry)}</div>
                      {live && !live.consistent && <div className="text-[10px] text-amber-300">mixed panels</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-200 text-xs">
                      <div>{formatGb(displayDataLimit)}</div>
                      {live?.usedBytes !== null && live?.usedBytes !== undefined && (
                        <div className="text-[10px] text-gray-500">used {formatTraffic(live.usedBytes)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-200 text-xs">
                      {live ? (
                        <div>
                          <div>{live.resolvedServers}/{live.totalServers} live</div>
                          {live.sourceServerName && <div className="text-[10px] text-gray-500">{live.sourceServerName}</div>}
                        </div>
                      ) : (
                        <div>
                          <div>{record.serverSubLinks?.length ?? 0} sub / {record.serverConfigLinks?.length ?? 0} cfg</div>
                          {liveLoading && <div className="text-[10px] text-cyan-300">checking live...</div>}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-200">
                      {(() => {
                        try {
                          const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://burmesedigital.store');
                          const link = `${appUrl}/api/vpn/sub/${record.token}`;
                          return (
                            <div className="flex items-center gap-2">
                              <a href={link} target="_blank" rel="noreferrer" className="text-xs text-cyan-300 truncate max-w-[140px] block hover:underline">{link}</a>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(link, record._id)}
                                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white hover:bg-white/10 transition-colors"
                              >{copiedId === record._id ? 'Copied' : 'Copy'}</button>
                            </div>
                          );
                        } catch {
                          return <span className="text-xs text-gray-400">-</span>;
                        }
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${getStatusBadge(displayStatus)}`}>
                        {displayStatus}
                      </span>
                      {live && <div className="mt-1 text-[10px] text-emerald-300">3xUI</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openDetails(record); }}
                          disabled={detailsLoading && selectedRecord?._id === record._id}
                          className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1.5 text-xs text-cyan-300 hover:bg-cyan-500/20 transition-colors disabled:opacity-50 min-w-[66px] flex justify-center"
                          title="Open details, reconcile, repair, and cleanup checks"
                        >
                          {detailsLoading && selectedRecord?._id === record._id ? (
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-cyan-300 border-t-transparent animate-spin inline-block"></span>
                          ) : 'Details'}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openLiveEditModal(record); }}
                          disabled={syncingId === record._id || editingId === record._id}
                          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white hover:bg-white/10 transition-colors disabled:opacity-50 min-w-[56px] flex justify-center"
                          title="Edit live 3xUI clients. WEB key fields are not changed."
                        >
                          {editingId === record._id ? (
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block"></span>
                          ) : 'Edit'}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); syncRecord(record); }}
                          disabled={syncingId === record._id}
                          className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1.5 text-xs text-blue-300 hover:bg-blue-500/20 transition-colors disabled:opacity-50 min-w-[56px] flex justify-center"
                          title="Refresh live 3xUI state. No WEB DB key fields are changed."
                        >
                          {syncingId === record._id ? (
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-blue-300 border-t-transparent animate-spin inline-block"></span>
                          ) : 'Refresh'}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleStatus(record); }}
                          disabled={syncingId === record._id}
                          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                          title="Enable/disable live 3xUI clients. WEB key fields are not changed."
                        >{displayStatus === 'disabled' ? 'Enable' : 'Disable'}</button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); deleteRecord(record._id); }}
                          disabled={syncingId === record._id}
                          className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                          title="Delete live 3xUI clients only. WEB history record is kept."
                        >3xUI Del</button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
      </div>

      <div className="flex items-center justify-between text-sm text-gray-400">
          <div>{keys.length} records</div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40"
            >Previous</button>
            <span>Page {page} / {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40"
            >Next</button>
          </div>
        </div>
      {/* Details Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#10101f] border border-white/10 rounded-3xl w-full max-w-5xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-4 p-5 border-b border-white/10">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-cyan-300" />
                  <h2 className="text-xl font-bold text-white truncate">Multi-Server Key Details</h2>
                </div>
                <p className="text-sm text-gray-400 mt-1 truncate">
                  {selectedRecord?.username || 'Selected key'} · {selectedRecord?.token?.slice(0, 10)}…
                </p>
                {driftBadge && (
                  <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${driftBadge.variant}`}>
                    {driftBadge.label}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedRecord && (
                  <>
                    <button
                      onClick={() => fetchReconciliation(selectedRecord)}
                      disabled={reconcileLoading || detailsLoading || cleanupLoading || repairingId === selectedRecord._id}
                      className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                    >
                      {reconcileLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                      Reconcile
                    </button>
                    <button
                      onClick={() => repairRecord(selectedRecord)}
                      disabled={repairingId === selectedRecord._id || detailsLoading || reconcileLoading || cleanupLoading}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                    >
                      {repairingId === selectedRecord._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
                      Repair
                    </button>
                    <button
                      onClick={() => runCleanupDryRun(selectedRecord)}
                      disabled={cleanupLoading || detailsLoading || reconcileLoading || repairingId === selectedRecord._id}
                      className="inline-flex items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-sm text-orange-300 hover:bg-orange-500/20 transition-colors disabled:opacity-50"
                    >
                      {cleanupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListChecks className="w-4 h-4" />}
                      Cleanup
                    </button>
                    <button
                      onClick={() => syncRecord(selectedRecord)}
                      disabled={syncingId === selectedRecord._id || detailsLoading || cleanupLoading || repairingId === selectedRecord._id}
                      className="inline-flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-300 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                    >
                      {syncingId === selectedRecord._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      Refresh
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedRecord(null);
                    setSelectedDetails(null);
                    setReconciliation(null);
                    setDetailsError('');
                    setReconcileError('');
                    setRepairMessage('');
                    setRepairError('');
                    setRepairResult(null);
                    setCleanupError('');
                    setCleanupReport(null);
                  }}
                  className="p-2 text-gray-400 hover:text-white rounded-xl transition-colors hover:bg-white/5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {detailsLoading ? (
                <div className="py-16 text-center text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
                  Loading live 3xUI client info...
                </div>
              ) : detailsError ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-300">
                  {detailsError}
                </div>
              ) : selectedDetails ? (
                <>
                  <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="rounded-3xl border border-white/10 bg-[#0b0b19] p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Record</div>
                          <div className="text-lg font-semibold text-white mt-1">{selectedDetails.record.username}</div>
                        </div>
                        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${getStatusBadge(selectedDetails.record.status)}`}>
                          {selectedDetails.record.status || 'active'}
                        </span>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 text-sm">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                          <div className="text-xs text-gray-500">Token</div>
                          <div className="mt-1 font-mono text-white break-all">{selectedDetails.record.token}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                          <div className="text-xs text-gray-500">Migrated From</div>
                          <div className="mt-1 text-white">{selectedDetails.record.migratedFromToken ? selectedDetails.record.migratedFromToken : 'Direct'}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                          <div className="text-xs text-gray-500">Devices</div>
                          <div className="mt-1 text-white">{selectedDetails.record.devices || 1}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                          <div className="text-xs text-gray-500">Expiry</div>
                          <div className="mt-1 text-white">{formatDate(selectedDetails.record.expiryTime)}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                          <div className="text-xs text-gray-500">Data Limit</div>
                          <div className="mt-1 text-white">{(selectedDetails.record.dataLimitGB ?? 0) === 0 ? 'Unlimited' : `${selectedDetails.record.dataLimitGB} GB`}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                          <div className="text-xs text-gray-500">Link Count</div>
                          <div className="mt-1 text-white">{selectedDetails.summary.totalLinks} total links</div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-[#0b0b19] p-4 space-y-3">
                      <div className="flex items-center gap-2 text-white font-semibold">
                        <Shield className="w-4 h-4 text-cyan-300" />
                        Live API Summary
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                          <div className="text-xs text-gray-500">Resolved Servers</div>
                          <div className="mt-1 text-2xl font-semibold text-emerald-300">{selectedDetails.summary.resolvedServers}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                          <div className="text-xs text-gray-500">Total Servers</div>
                          <div className="mt-1 text-2xl font-semibold text-white">{selectedDetails.summary.totalServers}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                          <div className="text-xs text-gray-500">Sub Links</div>
                          <div className="mt-1 text-xl font-semibold text-cyan-300">{selectedDetails.record.serverSubLinks?.length || 0}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                          <div className="text-xs text-gray-500">Config Links</div>
                          <div className="mt-1 text-xl font-semibold text-purple-300">{selectedDetails.record.serverConfigLinks?.length || 0}</div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
                        <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Subscription Link</div>
                        <div className="flex items-center justify-between gap-3">
                          <a
                            href={`/api/vpn/sub/${selectedDetails.record.token}`}
                            target="_blank"
                            rel="noreferrer"
                            className="min-w-0 truncate text-cyan-300 hover:underline"
                          >
                            /api/vpn/sub/{selectedDetails.record.token}
                          </a>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(`/api/vpn/sub/${selectedDetails.record.token}`, selectedDetails.record._id)}
                            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white hover:bg-white/10 transition-colors"
                          >
                            {copiedId === selectedDetails.record._id ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>

                      {selectedDetails.unresolvedLinks.length > 0 && (
                        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
                          <div className="font-semibold mb-1">Unresolved links</div>
                          <div className="space-y-1">
                            {selectedDetails.unresolvedLinks.map((link) => (
                              <div key={link} className="break-all text-amber-100/90">
                                {link}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {(cleanupLoading || cleanupError || cleanupReport) && (
                    <div className="rounded-3xl border border-white/10 bg-[#0b0b19] p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Cleanup Dry-Run</div>
                          <div className="text-lg font-semibold text-white mt-1">Orphan and duplicate recommendations</div>
                        </div>
                        {cleanupReport && (
                          <div className="text-xs text-gray-500">
                            Checked {new Date(cleanupReport.generatedAt).toLocaleString()}
                          </div>
                        )}
                      </div>

                      {cleanupLoading ? (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-gray-400">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                          Running dry-run only. No panel clients will be changed.
                        </div>
                      ) : cleanupError ? (
                        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-300">
                          {cleanupError}
                        </div>
                      ) : cleanupReport ? (
                        <>
                          <div className="mb-4 rounded-2xl border border-orange-500/20 bg-orange-500/10 p-3 text-sm text-orange-100">
                            Dry-run only: this report does not delete, disable, rename, or relink any panel client.
                          </div>

                          <div className="grid grid-cols-2 gap-3 md:grid-cols-6 mb-4">
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                              <div className="text-xs text-gray-500">Items</div>
                              <div className="mt-1 text-xl font-semibold text-white">{cleanupReport.summary.totalItems}</div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                              <div className="text-xs text-gray-500">Servers</div>
                              <div className="mt-1 text-xl font-semibold text-cyan-300">{cleanupReport.summary.affectedServers}</div>
                            </div>
                            <div className="rounded-2xl border border-emerald-500/10 bg-white/[0.03] p-3">
                              <div className="text-xs text-gray-500">Linkable</div>
                              <div className="mt-1 text-xl font-semibold text-emerald-300">{cleanupReport.summary.link_with_repair}</div>
                            </div>
                            <div className="rounded-2xl border border-amber-500/10 bg-white/[0.03] p-3">
                              <div className="text-xs text-gray-500">Disable</div>
                              <div className="mt-1 text-xl font-semibold text-amber-300">{cleanupReport.summary.review_disable_duplicate}</div>
                            </div>
                            <div className="rounded-2xl border border-orange-500/10 bg-white/[0.03] p-3">
                              <div className="text-xs text-gray-500">Delete Review</div>
                              <div className="mt-1 text-xl font-semibold text-orange-300">{cleanupReport.summary.review_delete_disabled_duplicate}</div>
                            </div>
                            <div className="rounded-2xl border border-red-500/10 bg-white/[0.03] p-3">
                              <div className="text-xs text-gray-500">Manual</div>
                              <div className="mt-1 text-xl font-semibold text-red-300">{cleanupReport.summary.manual_review + cleanupReport.summary.panel_error}</div>
                            </div>
                          </div>

                          {cleanupReport.items.length === 0 ? (
                            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-200">
                              No cleanup candidates found for this record.
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="min-w-full border-collapse text-sm">
                                <thead>
                                  <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.18em] text-gray-500">
                                    <th className="px-3 py-2 font-medium">Server</th>
                                    <th className="px-3 py-2 font-medium">Candidate</th>
                                    <th className="px-3 py-2 font-medium">Recommendation</th>
                                    <th className="px-3 py-2 font-medium">Risk</th>
                                    <th className="px-3 py-2 font-medium">Reason</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {cleanupReport.items.map((item, index) => (
                                    <tr key={`${item.serverId}-${item.candidate?.subId || item.recommendation}-${index}`} className="border-b border-white/10 align-top">
                                      <td className="px-3 py-3">
                                        <div className="font-medium text-white">{item.serverName}</div>
                                        <div className="text-xs text-gray-500">{item.serverId}</div>
                                      </td>
                                      <td className="px-3 py-3 text-gray-300">
                                        {item.candidate ? (
                                          <div className="max-w-[260px]">
                                            <div className="truncate">{item.candidate.email}</div>
                                            <div className="text-xs text-gray-500">{item.candidate.enable ? 'enabled' : 'disabled'} - {formatDate(item.candidate.expiryTime)}</div>
                                            <div className="text-xs text-gray-500 truncate">{item.candidate.subId || 'no subId'}</div>
                                          </div>
                                        ) : (
                                          <span className="text-gray-500">No client candidate</span>
                                        )}
                                        {item.linkedClientEmail && (
                                          <div className="mt-1 text-xs text-gray-500 truncate">
                                            linked: {item.linkedClientEmail}
                                          </div>
                                        )}
                                      </td>
                                      <td className="px-3 py-3">
                                        <span className="inline-flex rounded-full border border-orange-500/20 bg-orange-500/10 px-2 py-1 text-[11px] font-medium text-orange-300">
                                          {getCleanupRecommendationLabel(item.recommendation)}
                                        </span>
                                      </td>
                                      <td className="px-3 py-3">
                                        <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium ${getCleanupRiskBadge(item.risk)}`}>
                                          {item.risk}
                                        </span>
                                      </td>
                                      <td className="px-3 py-3 text-gray-300">
                                        {item.reason}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </>
                      ) : null}
                    </div>
                  )}

                  {(reconcileLoading || reconcileError || reconciliation) && (
                    <div className="rounded-3xl border border-white/10 bg-[#0b0b19] p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Reconciliation</div>
                          <div className="text-lg font-semibold text-white mt-1">DB vs live 3xUI panels</div>
                        </div>
                        {reconciliation && (
                          <div className="text-xs text-gray-500">
                            Last checked {new Date(reconciliation.report.generatedAt).toLocaleString()}
                          </div>
                        )}
                      </div>

                      {(repairMessage || repairError || repairResult) && (
                        <div className={`mb-4 rounded-2xl border p-3 text-sm ${
                          repairError
                            ? 'border-red-500/20 bg-red-500/10 text-red-300'
                            : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                        }`}>
                          <div className="font-semibold">{repairError || repairMessage}</div>
                          {repairResult && (
                            <div className="mt-2 grid gap-2 sm:grid-cols-3">
                              <div>
                                <span className="text-gray-400">Updated: </span>
                                {repairResult.actions.filter((action) => action.status === 'updated' || action.status === 'linked').length}
                              </div>
                              <div>
                                <span className="text-gray-400">Skipped: </span>
                                {repairResult.actions.filter((action) => action.status === 'skipped').length}
                              </div>
                              <div>
                                <span className="text-gray-400">Failed: </span>
                                {repairResult.actions.filter((action) => action.status === 'failed').length}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {reconcileLoading ? (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-gray-400">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                          Checking panel state...
                        </div>
                      ) : reconcileError ? (
                        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-300">
                          {reconcileError}
                        </div>
                      ) : reconciliation ? (
                        <>
                          <div className="grid grid-cols-2 gap-3 md:grid-cols-6 mb-4">
                            <div className="rounded-2xl border border-emerald-500/10 bg-white/[0.03] p-3">
                              <div className="text-xs text-gray-500">OK</div>
                              <div className="mt-1 text-xl font-semibold text-emerald-300">{reconciliation.report.summary.ok}</div>
                            </div>
                            <div className="rounded-2xl border border-amber-500/10 bg-white/[0.03] p-3">
                              <div className="text-xs text-gray-500">Drift</div>
                              <div className="mt-1 text-xl font-semibold text-amber-300">{reconciliation.report.summary.drift}</div>
                            </div>
                            <div className="rounded-2xl border border-red-500/10 bg-white/[0.03] p-3">
                              <div className="text-xs text-gray-500">Missing</div>
                              <div className="mt-1 text-xl font-semibold text-red-300">{reconciliation.report.summary.missing}</div>
                            </div>
                            <div className="rounded-2xl border border-orange-500/10 bg-white/[0.03] p-3">
                              <div className="text-xs text-gray-500">Orphan</div>
                              <div className="mt-1 text-xl font-semibold text-orange-300">{reconciliation.report.summary.orphanCandidates}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-500/10 bg-white/[0.03] p-3">
                              <div className="text-xs text-gray-500">Unlinked</div>
                              <div className="mt-1 text-xl font-semibold text-slate-300">{reconciliation.report.summary.unlinked}</div>
                            </div>
                            <div className="rounded-2xl border border-red-500/10 bg-white/[0.03] p-3">
                              <div className="text-xs text-gray-500">Errors</div>
                              <div className="mt-1 text-xl font-semibold text-red-300">{reconciliation.report.summary.error}</div>
                            </div>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="min-w-full border-collapse text-sm">
                              <thead>
                                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.18em] text-gray-500">
                                  <th className="px-3 py-2 font-medium">Server</th>
                                  <th className="px-3 py-2 font-medium">State</th>
                                  <th className="px-3 py-2 font-medium">Linked Client</th>
                                  <th className="px-3 py-2 font-medium">Panel Expiry</th>
                                  <th className="px-3 py-2 font-medium">Issues</th>
                                </tr>
                              </thead>
                              <tbody>
                                {reconciliation.report.servers.map((server) => (
                                  <tr key={server.serverId} className="border-b border-white/10 align-top">
                                    <td className="px-3 py-3">
                                      <div className="font-medium text-white">{server.serverName}</div>
                                      <div className="text-xs text-gray-500">{server.serverId}</div>
                                    </td>
                                    <td className="px-3 py-3">
                                      <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium ${getReconciliationBadge(server.status)}`}>
                                        {server.status}
                                      </span>
                                    </td>
                                    <td className="px-3 py-3 text-gray-300">
                                      {server.linkedClient ? (
                                        <div className="max-w-[240px]">
                                          <div className="truncate">{server.linkedClient.email}</div>
                                          <div className="text-xs text-gray-500">{server.linkedClient.subId || 'no subId'}</div>
                                        </div>
                                      ) : (
                                        <span className="text-gray-500">No linked client</span>
                                      )}
                                      {server.orphanCandidates.length > 0 && (
                                        <div className="mt-2 rounded-lg border border-orange-500/20 bg-orange-500/10 px-2 py-1 text-xs text-orange-200">
                                          {server.orphanCandidates.length} orphan candidate{server.orphanCandidates.length !== 1 ? 's' : ''}
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-3 py-3 text-gray-300">
                                      {server.linkedClient?.expiryTime ? formatDateTime(server.linkedClient.expiryTime) : '-'}
                                    </td>
                                    <td className="px-3 py-3">
                                      {server.issues.length === 0 ? (
                                        <span className="text-emerald-300">No issues</span>
                                      ) : (
                                        <div className="space-y-1">
                                          {server.issues.map((issue, index) => (
                                            <div key={`${server.serverId}-${issue.type}-${index}`} className="text-xs text-gray-300">
                                              <span className="text-amber-300">{issue.type}</span>
                                              <span className="text-gray-500"> - </span>
                                              <span>{issue.message}</span>
                                              {(issue.expected !== undefined || issue.actual !== undefined) && (
                                                <div className="text-gray-500">
                                                  expected {formatIssueValue(issue.expected)} / actual {formatIssueValue(issue.actual)}
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}

                  <div className="rounded-3xl border border-white/10 bg-[#0b0b19] p-4">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Live 3xUI Client Info</div>
                        <div className="text-lg font-semibold text-white mt-1">Connected clients across servers</div>
                      </div>
                      <div className="text-sm text-gray-400">
                        {selectedDetails.clients.length} server{selectedDetails.clients.length !== 1 ? 's' : ''} resolved
                      </div>
                    </div>

                    {selectedDetails.clients.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-gray-400">
                        No live client data resolved yet. Try Refresh to re-check the panels.
                      </div>
                    ) : (
                      <div className="grid gap-3 lg:grid-cols-2">
                        {selectedDetails.clients.map(({ serverId, serverName, source, client }) => {
                          const usedGb = (client.up + client.down) / (1024 * 1024 * 1024);
                          const expired = client.expiryTime > 0 && client.expiryTime < Date.now();
                          return (
                            <div key={serverId} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="font-semibold text-white">{serverName}</div>
                                  <div className="text-xs text-gray-500">{serverId} · {source}</div>
                                </div>
                                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium ${client.enable && !expired ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-red-500/20 bg-red-500/10 text-red-300'}`}>
                                  {client.enable && !expired ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                  {client.enable && !expired ? 'Active' : expired ? 'Expired' : 'Disabled'}
                                </span>
                              </div>

                              <div className="space-y-1 text-sm text-gray-300">
                                <div><span className="text-gray-500">Email:</span> {client.email}</div>
                                <div><span className="text-gray-500">Protocol:</span> {client.protocol.toUpperCase()}</div>
                                <div><span className="text-gray-500">Devices:</span> {client.limitIp || 0}</div>
                                <div><span className="text-gray-500">Expiry:</span> {client.expiryTime > 0 ? formatDateTime(client.expiryTime) : 'Unlimited'}</div>
                                <div><span className="text-gray-500">Usage:</span> {usedGb.toFixed(2)} GB / {formatGb(client.totalGB)}</div>
                                <div><span className="text-gray-500">Telegram ID:</span> {client.tgId || '—'}</div>
                                <div className="break-all"><span className="text-gray-500">Sub ID:</span> {client.subId || '—'}</div>
                              </div>

                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(client.email, `${serverId}-email`)}
                                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-white/10 transition-colors"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  Copy email
                                </button>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(client.subId, `${serverId}-sub`)}
                                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-white/10 transition-colors"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  Copy sub ID
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    {selectedRecord && (
                      <>
                        <button
                          onClick={() => {
                            setShowDetailsModal(false);
                            openLiveEditModal(selectedRecord);
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                          title="Edit live 3xUI clients. WEB key fields are not changed."
                        >
                          <Pencil className="w-4 h-4" />
                          Edit 3xUI
                        </button>
                        <button
                          onClick={() => toggleStatus(selectedRecord)}
                          disabled={syncingId === selectedRecord._id}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                          title="Enable/disable live 3xUI clients. WEB key fields are not changed."
                        >
                          {selectedRecord.status === 'disabled' ? 'Enable' : 'Disable'}
                        </button>
                        <button
                          onClick={() => deleteRecord(selectedRecord._id)}
                          disabled={syncingId === selectedRecord._id}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                          title="Delete live 3xUI clients only. WEB history record is kept."
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete 3xUI
                        </button>
                      </>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Create Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#10101f] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-cyan-300" />
                  <h2 className="text-xl font-bold text-white">
                    {createForm.mode === 'test' ? 'Free Test Key' : 'Sell Key'}
                  </h2>
                </div>
                <p className="mt-1 text-sm text-gray-400">
                  Creates live 3xUI clients across enabled servers and keeps a WEB index/history record.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-xl p-2 text-gray-400 transition hover:bg-white/5 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">Key name</label>
                <input
                  type="text"
                  value={createForm.username}
                  onChange={(e) => setCreateForm((current) => ({ ...current, username: e.target.value }))}
                  placeholder={createForm.mode === 'test' ? 'Free Test Key' : 'Customer name'}
                  className="w-full rounded-2xl border border-white/10 bg-[#0b0b19] px-4 py-3 text-sm text-white outline-none transition focus:border-purple-500"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Protocol</label>
                  <select
                    value={createForm.protocol}
                    onChange={(e) => setCreateForm((current) => ({ ...current, protocol: e.target.value as CreateKeyForm['protocol'] }))}
                    className="w-full rounded-2xl border border-white/10 bg-[#0b0b19] px-4 py-3 text-sm text-white outline-none transition focus:border-purple-500"
                  >
                    <option value="trojan">Trojan</option>
                    <option value="vless">VLESS</option>
                    <option value="vmess">VMess</option>
                    <option value="shadowsocks">Shadowsocks</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Devices</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={createForm.devices}
                    onChange={(e) => setCreateForm((current) => ({ ...current, devices: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="w-full rounded-2xl border border-white/10 bg-[#0b0b19] px-4 py-3 text-sm text-white outline-none transition focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Expiry days</label>
                  <input
                    type="number"
                    min="1"
                    max="3650"
                    value={createForm.expiryDays}
                    onChange={(e) => setCreateForm((current) => ({ ...current, expiryDays: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="w-full rounded-2xl border border-white/10 bg-[#0b0b19] px-4 py-3 text-sm text-white outline-none transition focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">Data limit GB</label>
                  <input
                    type="number"
                    min="0"
                    value={createForm.dataLimitGB}
                    onChange={(e) => setCreateForm((current) => ({ ...current, dataLimitGB: Math.max(0, parseInt(e.target.value) || 0) }))}
                    className="w-full rounded-2xl border border-white/10 bg-[#0b0b19] px-4 py-3 text-sm text-white outline-none transition focus:border-purple-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-gray-300 transition hover:bg-white/10 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateKey}
                disabled={creatingKey}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creatingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Create key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#10101f] border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button 
              onClick={() => setShowEditModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            
            <h2 className="text-xl font-bold text-white mb-6">Edit Live 3xUI Key</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
                <div className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-gray-400 text-sm cursor-not-allowed">
                  {editingRecord.username}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Devices Limit</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={editDevices}
                  onChange={(e) => setEditDevices(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-[#0b0b19] border border-white/10 focus:border-purple-500 rounded-xl px-4 py-2 text-white text-sm outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Expiry Date</label>
                <div className="flex items-center gap-3 mb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editUnlimitedExpiry}
                      onChange={(e) => setEditUnlimitedExpiry(e.target.checked)}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 bg-[#0b0b19] w-4 h-4"
                    />
                    <span className="text-sm text-gray-400">Unlimited Expiry</span>
                  </label>
                </div>
                {!editUnlimitedExpiry && (
                  <input
                    type="date"
                    value={editExpiryDate}
                    onChange={(e) => setEditExpiryDate(e.target.value)}
                    className="w-full bg-[#0b0b19] border border-white/10 focus:border-purple-500 rounded-xl px-4 py-2 text-white text-sm outline-none transition-colors"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Data Limit in GB (0 = unlimited)</label>
                <input
                  type="number"
                  min="0"
                  value={editDataLimit}
                  onChange={(e) => setEditDataLimit(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-[#0b0b19] border border-white/10 focus:border-purple-500 rounded-xl px-4 py-2 text-white text-sm outline-none transition-colors"
                />
              </div>
            </div>

            <div className="mt-8 flex gap-3 justify-end">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-5 py-2 rounded-xl text-sm font-medium text-gray-300 hover:bg-white/5 transition-colors border border-transparent"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 transition-colors shadow-lg shadow-purple-500/20"
              >
                Update 3xUI
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
