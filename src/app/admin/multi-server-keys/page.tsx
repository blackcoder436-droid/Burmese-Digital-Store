'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle,
  Copy,
  Eye,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Shield,
  Trash2,
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

interface SummaryCounts {
  active: number;
  expired: number;
  disabled: number;
  total: number;
}

export default function AdminMultiServerKeysPage() {
  const [keys, setKeys] = useState<MultiServerKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MultiServerKeyRecord | null>(null);
  const [editDevices, setEditDevices] = useState(1);
  const [editExpiryDate, setEditExpiryDate] = useState<string>('');
  const [editUnlimitedExpiry, setEditUnlimitedExpiry] = useState<boolean>(false);
  const [editDataLimit, setEditDataLimit] = useState(0);

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
        setKeys(data.data.keys);
        setTotalPages(data.data.totalPages);
        setSummary(data.data.summary || { active: 0, expired: 0, disabled: 0, total: 0 });
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

  async function openDetails(record: MultiServerKeyRecord) {
    setSelectedRecord(record);
    setSelectedDetails(null);
    setDetailsError('');
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
  }

  function formatDate(ms?: number) {
    if (!ms || ms <= 0) return 'Unlimited';
    return new Date(ms).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  function formatGb(bytes?: number) {
    if (!bytes || bytes <= 0) return '∞';
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
      await fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update record');
      console.error(err);
    }
  }

  async function deleteRecord(id: string) {
    if (!window.confirm('Are you sure you want to delete this multi-server key record?')) {
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
      await fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete record');
      console.error(err);
    }
  }

  async function toggleStatus(record: MultiServerKeyRecord) {
    const nextStatus = record.status === 'disabled' ? 'active' : 'disabled';
    await updateRecord(record._id, { status: nextStatus });
    await syncRecord(record);
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
        throw new Error(data.error || 'Sync failed');
      }
      window.alert(data.message || 'Synced successfully.');
      await fetchKeys();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to sync record');
      console.error(err);
    } finally {
      setSyncingId(null);
    }
  }

  function openEditModal(record: MultiServerKeyRecord) {
    setEditingRecord(record);
    setEditDevices(record.devices || 1);
    
    if (record.expiryTime && record.expiryTime > 0) {
      setEditUnlimitedExpiry(false);
      const dateObj = new Date(record.expiryTime);
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      setEditExpiryDate(`${year}-${month}-${day}`);
    } else {
      setEditUnlimitedExpiry(true);
      setEditExpiryDate('');
    }
    
    setEditDataLimit(record.dataLimitGB || 0);
    setShowEditModal(true);
  }

  async function handleSaveEdit() {
    if (!editingRecord) return;
    
    setEditingId(editingRecord._id);
    setShowEditModal(false); // Close modal immediately
    
    try {
      let expiryTime = 0;
      if (!editUnlimitedExpiry && editExpiryDate) {
        const dt = new Date(editExpiryDate);
        if (!isNaN(dt.getTime())) {
          dt.setHours(23, 59, 59, 999);
          expiryTime = dt.getTime();
        }
      }
      
      await updateRecord(editingRecord._id, { expiryTime, dataLimitGB: editDataLimit, devices: editDevices });
      
      // Auto-sync after successful update
      const res = await fetch('/api/admin/multi-server-keys/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingRecord._id }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Sync failed');
      }
      await fetchKeys();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to update and sync record');
      console.error(err);
    } finally {
      setEditingId(null);
      setEditingRecord(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Multi-Server Key Management</h1>
          <p className="text-sm text-gray-400 mt-1">All bot/web VPN orders and migrated multi-server keys live here in one place.</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
                {keys.map((record) => (
                  <tr
                    key={record._id}
                    onClick={() => openDetails(record)}
                    className="border-b border-white/10 hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-white">
                      <div className="font-medium">{record.token.slice(0, 8)}…</div>
                      <div className="text-[10px] text-gray-500">{record.migratedFromToken ? `from ${record.migratedFromToken.slice(0, 8)}…` : 'direct'}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-200">{record.username}</td>
                    <td className="px-4 py-3 text-gray-200">{record.devices || 1}</td>
                    <td className="px-4 py-3 text-gray-200 text-xs">{formatDate(record.expiryTime)}</td>
                    <td className="px-4 py-3 text-gray-200 text-xs">{(record.dataLimitGB ?? 0) === 0 ? 'Unlimited' : `${record.dataLimitGB} GB`}</td>
                    <td className="px-4 py-3 text-gray-200 text-xs">
                      {record.serverSubLinks?.length ?? 0} sub / {record.serverConfigLinks?.length ?? 0} cfg
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
                                onClick={() => {
                                  navigator.clipboard.writeText(link);
                                  setCopiedId(record._id);
                                  setTimeout(() => setCopiedId(null), 2000);
                                }}
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
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${getStatusBadge(record.status)}`}>
                        {record.status || 'active'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openEditModal(record); }}
                          disabled={syncingId === record._id || editingId === record._id}
                          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white hover:bg-white/10 transition-colors disabled:opacity-50 min-w-[56px] flex justify-center"
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
                          title="Sync expiry/data limits and automatically add missing new servers"
                        >
                          {syncingId === record._id ? (
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-blue-300 border-t-transparent animate-spin inline-block"></span>
                          ) : 'Sync'}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleStatus(record); }}
                          disabled={syncingId === record._id}
                          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                        >{record.status === 'disabled' ? 'Enable' : 'Disable'}</button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); deleteRecord(record._id); }}
                          disabled={syncingId === record._id}
                          className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                        >Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
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
              </div>
              <div className="flex items-center gap-2">
                {selectedRecord && (
                  <button
                    onClick={() => syncRecord(selectedRecord)}
                    disabled={syncingId === selectedRecord._id || detailsLoading}
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-300 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                  >
                    {syncingId === selectedRecord._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Sync
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedRecord(null);
                    setSelectedDetails(null);
                    setDetailsError('');
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
                        API / Sync Summary
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
                        No live client data resolved yet. Try Sync to re-check the panels.
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
                                <div><span className="text-gray-500">Expiry:</span> {client.expiryTime > 0 ? formatDate(client.expiryTime) : 'Unlimited'}</div>
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
                            openEditModal(selectedRecord);
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => toggleStatus(selectedRecord)}
                          disabled={syncingId === selectedRecord._id}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                        >
                          {selectedRecord.status === 'disabled' ? 'Enable' : 'Disable'}
                        </button>
                        <button
                          onClick={() => deleteRecord(selectedRecord._id)}
                          disabled={syncingId === selectedRecord._id}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
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
            
            <h2 className="text-xl font-bold text-white mb-6">Edit Multi-Server Key</h2>
            
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
                Save & Sync
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
