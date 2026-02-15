'use client';

import { useEffect, useState } from 'react';
import {
  Key,
  RefreshCw,
  Copy,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Server,
  ChevronLeft,
  ChevronRight,
  Globe,
} from 'lucide-react';
import { useLanguage } from '@/lib/language';

interface VpnKeyEntry {
  _id: string;
  user: { _id: string; name: string; email: string } | null;
  vpnPlan?: { serverId: string; planId: string; devices: number; months: number };
  vpnKey?: {
    clientEmail: string;
    clientUUID: string;
    subId: string;
    subLink: string;
    configLink: string;
    protocol: string;
    expiryTime: number;
    provisionedAt?: string;
  };
  vpnProvisionStatus: string;
  status: string;
  totalAmount: number;
  createdAt: string;
}

interface Summary {
  provisioned: number;
  failed: number;
  revoked: number;
  pending: number;
  total: number;
}

const statusColors: Record<string, string> = {
  provisioned: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  revoked: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

const statusIcons: Record<string, React.ReactNode> = {
  provisioned: <CheckCircle className="w-3.5 h-3.5" />,
  failed: <XCircle className="w-3.5 h-3.5" />,
  revoked: <AlertTriangle className="w-3.5 h-3.5" />,
  pending: <Clock className="w-3.5 h-3.5" />,
};

export default function AdminVpnKeysPage() {
  const { tr } = useLanguage();
  const [keys, setKeys] = useState<VpnKeyEntry[]>([]);
  const [summary, setSummary] = useState<Summary>({ provisioned: 0, failed: 0, revoked: 0, pending: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [serverFilter, setServerFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchKeys();
  }, [filter, serverFilter, page]);

  async function fetchKeys() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '30',
      });
      if (filter !== 'all') params.set('status', filter);
      if (serverFilter) params.set('serverId', serverFilter);

      const res = await fetch(`/api/admin/vpn-keys?${params}`);
      const data = await res.json();

      if (data.success) {
        setKeys(data.data.keys);
        setSummary(data.data.summary);
        setTotalPages(data.data.totalPages);
      }
    } catch (err) {
      console.error('Failed to fetch VPN keys:', err);
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function formatExpiry(expiryMs: number) {
    const now = Date.now();
    const remaining = expiryMs - now;
    if (remaining <= 0) return { text: 'Expired', color: 'text-red-400' };
    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    if (days > 30) return { text: `${days} days`, color: 'text-emerald-400' };
    if (days > 7) return { text: `${days} days`, color: 'text-amber-400' };
    if (days > 0) return { text: `${days} days`, color: 'text-orange-400' };
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    return { text: `${hours}h`, color: 'text-red-400' };
  }

  const servers = ['sg1', 'sg2', 'sg3', 'us1'];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Key className="w-6 h-6 text-purple-400" />
            {tr('VPN Keys Management', 'VPN Keys စီမံခန့်ခွဲမှု')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {tr('Manage all VPN keys across servers', 'Server အားလုံးရဲ့ VPN keys တွေကို စီမံပါ')}
          </p>
        </div>
        <button
          onClick={() => fetchKeys()}
          className="p-3 text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-xl transition-all"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        {[
          { label: tr('Total', 'စုစုပေါင်း'), value: summary.total, color: 'text-white', bg: 'bg-purple-500/10 border-purple-500/20' },
          { label: tr('Active', 'Active'), value: summary.provisioned, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { label: tr('Pending', 'Pending'), value: summary.pending, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: tr('Failed', 'Failed'), value: summary.failed, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
          { label: tr('Revoked', 'Revoked'), value: summary.revoked, color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20' },
        ].map((card) => (
          <div
            key={card.label}
            className={`p-4 rounded-xl border ${card.bg}`}
          >
            <div className={`text-2xl font-extrabold ${card.color}`}>{card.value}</div>
            <div className="text-xs text-gray-500 mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-2 flex-wrap">
          {[
            { value: 'all', label: tr('All', 'အားလုံး') },
            { value: 'provisioned', label: tr('Active', 'Active') },
            { value: 'pending', label: tr('Pending', 'Pending') },
            { value: 'failed', label: tr('Failed', 'Failed') },
            { value: 'revoked', label: tr('Revoked', 'Revoked') },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => { setFilter(f.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === f.value
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'bg-[#12122a] text-gray-500 border border-purple-500/[0.08] hover:text-gray-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Globe className="w-4 h-4 text-gray-500" />
          <select
            value={serverFilter}
            onChange={(e) => { setServerFilter(e.target.value); setPage(1); }}
            className="bg-[#12122a] border border-purple-500/[0.08] text-sm text-gray-300 rounded-lg px-3 py-1.5 focus:border-purple-500 focus:outline-none"
          >
            <option value="">{tr('All Servers', 'Server အားလုံး')}</option>
            {servers.map((s) => (
              <option key={s} value={s}>{s.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-[#12122a] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-20">
          <Server className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">{tr('No VPN keys found', 'VPN key မတွေ့ပါ')}</p>
        </div>
      ) : (
        <div className="bg-[#12122a] border border-purple-500/[0.08] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-purple-500/[0.08]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{tr('User', 'User')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{tr('Server', 'Server')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{tr('Plan', 'Plan')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{tr('Status', 'Status')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{tr('Expiry', 'သက်တမ်း')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{tr('Amount', 'ပမာဏ')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{tr('Key', 'Key')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-500/[0.05]">
                {keys.map((entry) => {
                  const expiry = entry.vpnKey?.expiryTime
                    ? formatExpiry(entry.vpnKey.expiryTime)
                    : { text: '—', color: 'text-gray-500' };

                  return (
                    <tr key={entry._id} className="hover:bg-purple-500/[0.03] transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-white text-sm truncate max-w-[130px]">
                          {entry.user?.name || '—'}
                        </div>
                        <div className="text-xs text-gray-500 truncate max-w-[130px]">
                          {entry.user?.email || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded">
                          {entry.vpnPlan?.serverId?.toUpperCase() || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {entry.vpnPlan ? (
                          <span className="text-xs">
                            {entry.vpnPlan.devices}D / {entry.vpnPlan.months}M
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border ${statusColors[entry.vpnProvisionStatus] || statusColors.pending}`}>
                          {statusIcons[entry.vpnProvisionStatus]}
                          {entry.vpnProvisionStatus}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-xs font-semibold ${expiry.color}`}>
                        {expiry.text}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-300">
                        {entry.totalAmount?.toLocaleString()} Ks
                      </td>
                      <td className="px-4 py-3">
                        {entry.vpnKey?.configLink ? (
                          <button
                            onClick={() => copyToClipboard(entry.vpnKey!.configLink, entry._id)}
                            className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                            title="Copy config link"
                          >
                            {copiedId === entry._id ? (
                              <><CheckCircle className="w-3.5 h-3.5" /> Copied</>
                            ) : (
                              <><Copy className="w-3.5 h-3.5" /> Copy</>
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-purple-500/[0.08]">
              <span className="text-xs text-gray-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
