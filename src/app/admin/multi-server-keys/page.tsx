'use client';

import { useEffect, useState } from 'react';

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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [summary, setSummary] = useState<SummaryCounts>({ active: 0, expired: 0, disabled: 0, total: 0 });

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

  function formatDate(ms?: number) {
    if (!ms || ms <= 0) return 'Unlimited';
    return new Date(ms).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
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
  }

  async function editRecord(record: MultiServerKeyRecord) {
    const expiryPrompt = window.prompt(
      'Enter expiry days from today (0 = unlimited):',
      record.expiryTime && record.expiryTime > 0
        ? String(Math.max(0, Math.ceil((record.expiryTime - Date.now()) / (1000 * 60 * 60 * 24))))
        : '0'
    );

    if (expiryPrompt === null) return;
    const expiryDays = Number(expiryPrompt);
    if (Number.isNaN(expiryDays) || expiryDays < 0) {
      window.alert('Expiry days must be a non-negative number.');
      return;
    }

    const dataLimitPrompt = window.prompt(
      'Enter data limit in GB (0 = unlimited):',
      String(record.dataLimitGB ?? 0)
    );
    if (dataLimitPrompt === null) return;
    const dataLimitGB = Number(dataLimitPrompt);
    if (Number.isNaN(dataLimitGB) || dataLimitGB < 0) {
      window.alert('Data limit must be a non-negative number.');
      return;
    }

    const expiryTime = expiryDays === 0 ? 0 : Date.now() + expiryDays * 24 * 60 * 60 * 1000;
    await updateRecord(record._id, { expiryTime, dataLimitGB });
  }

  return (
    <div className="min-h-screen py-10 px-4">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Multi-Server Key Management</h1>
            <p className="text-sm text-gray-400 mt-1">View all migrated multi-server VPN keys and server subscriptions in one place.</p>
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

        <div className="bg-[#10101f] rounded-3xl border border-white/10 p-5 shadow-xl shadow-black/10">
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
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-white/10 uppercase text-xs tracking-[0.2em]">
                  <th className="px-4 py-3">Token</th>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Devices</th>
                  <th className="px-4 py-3">Expiry</th>
                  <th className="px-4 py-3">Data Limit</th>
                  <th className="px-4 py-3">Servers</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((record) => (
                  <tr key={record._id} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-white">
                      <div className="font-medium">{record.token.slice(0, 8)}…</div>
                      <div className="text-xs text-gray-500">{record.migratedFromToken ? `from ${record.migratedFromToken.slice(0, 8)}…` : 'direct'}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-200">{record.username}</td>
                    <td className="px-4 py-3 text-gray-200">{record.devices || 1}</td>
                    <td className="px-4 py-3 text-gray-200">{formatDate(record.expiryTime)}</td>
                    <td className="px-4 py-3 text-gray-200">{(record.dataLimitGB ?? 0) === 0 ? 'Unlimited' : `${record.dataLimitGB} GB`}</td>
                    <td className="px-4 py-3 text-gray-200">
                      {record.serverSubLinks?.length ?? 0} sub / {record.serverConfigLinks?.length ?? 0} cfg
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold ${getStatusBadge(record.status)}`}>
                        {record.status || 'active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-200">{record.createdAt ? new Date(record.createdAt).toLocaleDateString() : '–'}</td>
                    <td className="px-4 py-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => editRecord(record)}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white hover:bg-white/10 transition-colors"
                      >Edit</button>
                      <button
                        type="button"
                        onClick={() => toggleStatus(record)}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white hover:bg-white/10 transition-colors"
                      >{record.status === 'disabled' ? 'Enable' : 'Disable'}</button>
                      <button
                        type="button"
                        onClick={() => deleteRecord(record._id)}
                        className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs text-red-300 hover:bg-red-500/20 transition-colors"
                      >Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between text-sm text-gray-400">
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
      </div>
    </div>
  );
}
