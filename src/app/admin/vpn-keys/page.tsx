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
  Plus,
  X,
  Loader2,
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
  const { t } = useLanguage();
  const [keys, setKeys] = useState<VpnKeyEntry[]>([]);
  const [summary, setSummary] = useState<Summary>({ provisioned: 0, failed: 0, revoked: 0, pending: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [serverFilter, setServerFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create Key modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<'test' | 'sell'>('sell');
  const [createServerId, setCreateServerId] = useState('');
  const [createProtocol, setCreateProtocol] = useState('trojan');
  const [createUsername, setCreateUsername] = useState('');
  const [createDevices, setCreateDevices] = useState(1);
  const [createExpiryDays, setCreateExpiryDays] = useState(30);
  const [createDataLimitGB, setCreateDataLimitGB] = useState(0);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [createResult, setCreateResult] = useState<any>(null);
  const [availableServers, setAvailableServers] = useState<{ id: string; name: string; flag: string; enabledProtocols: string[]; online: boolean }[]>([]);

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

  async function fetchServersForCreate() {
    try {
      const res = await fetch('/api/admin/vpn-keys/create');
      const data = await res.json();
      if (data.success) {
        setAvailableServers(data.data.servers);
        if (data.data.servers.length > 0 && !createServerId) {
          setCreateServerId(data.data.servers[0].id);
          setCreateProtocol(data.data.servers[0].enabledProtocols[0] || 'trojan');
        }
      }
    } catch (err) {
      console.error('Failed to fetch servers:', err);
    }
  }

  function openCreateModal(type: 'test' | 'sell') {
    setCreateType(type);
    setCreateUsername('');
    setCreateError('');
    setCreateResult(null);

    if (type === 'test') {
      setCreateDevices(1);
      setCreateExpiryDays(3);
      setCreateDataLimitGB(3);
    } else {
      setCreateDevices(1);
      setCreateExpiryDays(30);
      setCreateDataLimitGB(0);
    }

    setShowCreateModal(true);
    if (availableServers.length === 0) fetchServersForCreate();
  }

  async function handleCreateKey() {
    if (!createServerId || !createProtocol || !createUsername.trim()) {
      setCreateError('Server, Protocol, Username are required');
      return;
    }

    setCreating(true);
    setCreateError('');
    setCreateResult(null);

    try {
      const res = await fetch('/api/admin/vpn-keys/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: createType,
          serverId: createServerId,
          protocol: createProtocol,
          username: createUsername.trim(),
          devices: createDevices,
          expiryDays: createExpiryDays,
          dataLimitGB: createDataLimitGB,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setCreateResult(data.data);
        fetchKeys(); // Refresh the list
      } else {
        setCreateError(data.error || 'Failed to create key');
      }
    } catch (err) {
      setCreateError('Network error. Please try again.');
      console.error(err);
    } finally {
      setCreating(false);
    }
  }

  const selectedServer = availableServers.find((s) => s.id === createServerId);

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
            {t('admin.vpnKeysPage.title')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('admin.vpnKeysPage.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openCreateModal('test')}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 rounded-xl text-sm font-semibold transition-all"
          >
            <Plus className="w-4 h-4" />
            Test Key
          </button>
          <button
            onClick={() => openCreateModal('sell')}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 rounded-xl text-sm font-semibold transition-all"
          >
            <Plus className="w-4 h-4" />
            Sell Key
          </button>
          <button
            onClick={() => fetchKeys()}
            className="p-3 text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-xl transition-all"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        {[
          { label: t('admin.vpnKeysPage.total'), value: summary.total, color: 'text-white', bg: 'bg-purple-500/10 border-purple-500/20' },
          { label: t('admin.vpnKeysPage.active'), value: summary.provisioned, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { label: t('admin.vpnKeysPage.pending'), value: summary.pending, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: t('admin.vpnKeysPage.failed'), value: summary.failed, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
          { label: t('admin.vpnKeysPage.revoked'), value: summary.revoked, color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20' },
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
            { value: 'all', label: t('shop.page.all') },
            { value: 'provisioned', label: t('admin.vpnKeysPage.active') },
            { value: 'pending', label: t('admin.vpnKeysPage.pending') },
            { value: 'failed', label: t('admin.vpnKeysPage.failed') },
            { value: 'revoked', label: t('admin.vpnKeysPage.revoked') },
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
            <option value="">{t('admin.vpnKeysPage.allServers')}</option>
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
          <p className="text-gray-500">{t('admin.vpnKeysPage.noKeysFound')}</p>
        </div>
      ) : (
        <div className="bg-[#12122a] border border-purple-500/[0.08] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-purple-500/[0.08]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('admin.user')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('admin.server')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('admin.vpnKeysPage.plan')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('admin.status')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('admin.vpnKeysPage.expiry')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('admin.amount')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{t('admin.vpnKeysPage.key')}</th>
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
                            title={t('admin.vpnKeysPage.copyConfigLink')}
                          >
                            {copiedId === entry._id ? (
                              <><CheckCircle className="w-3.5 h-3.5" /> {t('common.copied')}</>
                            ) : (
                              <><Copy className="w-3.5 h-3.5" /> {t('common.copy')}</>
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
                {t('admin.vpnKeysPage.pageOf').replace('{page}', String(page)).replace('{total}', String(totalPages))}
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

      {/* Create Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0a0a1a] border border-purple-500/20 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-purple-500/10">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-purple-400" />
                {createType === 'test' ? '🧪 Create Test Key' : '🔑 Create Sell Key'}
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 text-gray-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createResult ? (
              <div className="p-5 space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold mb-3">
                    <CheckCircle className="w-5 h-5" />
                    Key Created Successfully!
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Server:</span>
                      <span className="text-white font-medium">{createResult.server}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Protocol:</span>
                      <span className="text-white font-medium">{createResult.protocol}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Username:</span>
                      <span className="text-white font-medium">{createResult.username}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Devices:</span>
                      <span className="text-white font-medium">{createResult.devices}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Expiry:</span>
                      <span className="text-white font-medium">{createResult.expiryDays} days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Data Limit:</span>
                      <span className="text-white font-medium">{createResult.dataLimitGB === 0 ? 'Unlimited' : `${createResult.dataLimitGB} GB`}</span>
                    </div>
                  </div>
                </div>

                {/* Sub Link */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Subscription Link</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createResult.subLink}
                      className="flex-1 bg-[#12122a] border border-purple-500/10 text-white text-xs rounded-lg px-3 py-2 font-mono"
                    />
                    <button
                      onClick={() => copyToClipboard(createResult.subLink, 'sublink')}
                      className="px-3 py-2 bg-purple-500/10 text-purple-400 rounded-lg hover:bg-purple-500/20 transition-colors"
                    >
                      {copiedId === 'sublink' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Config Link */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Config Link</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createResult.configLink}
                      className="flex-1 bg-[#12122a] border border-purple-500/10 text-white text-xs rounded-lg px-3 py-2 font-mono"
                    />
                    <button
                      onClick={() => copyToClipboard(createResult.configLink, 'configlink')}
                      className="px-3 py-2 bg-purple-500/10 text-purple-400 rounded-lg hover:bg-purple-500/20 transition-colors"
                    >
                      {copiedId === 'configlink' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setShowCreateModal(false)}
                  className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-500 transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                {/* Type Toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setCreateType('test');
                      setCreateDevices(1);
                      setCreateExpiryDays(3);
                      setCreateDataLimitGB(3);
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      createType === 'test'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-[#12122a] text-gray-500 border border-purple-500/[0.08]'
                    }`}
                  >
                    🧪 Test Key
                  </button>
                  <button
                    onClick={() => {
                      setCreateType('sell');
                      setCreateDevices(1);
                      setCreateExpiryDays(30);
                      setCreateDataLimitGB(0);
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      createType === 'sell'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'bg-[#12122a] text-gray-500 border border-purple-500/[0.08]'
                    }`}
                  >
                    🔑 Sell Key
                  </button>
                </div>

                {/* Server */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">Server</label>
                  <select
                    value={createServerId}
                    onChange={(e) => {
                      setCreateServerId(e.target.value);
                      const srv = availableServers.find((s) => s.id === e.target.value);
                      if (srv && !srv.enabledProtocols.includes(createProtocol)) {
                        setCreateProtocol(srv.enabledProtocols[0] || 'trojan');
                      }
                    }}
                    className="w-full bg-[#12122a] border border-purple-500/10 text-white rounded-xl px-4 py-3 focus:border-purple-500 focus:outline-none"
                  >
                    {availableServers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.flag} {s.name} {s.online ? '🟢' : '🔴'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Protocol */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">Protocol</label>
                  <div className="flex gap-2 flex-wrap">
                    {(selectedServer?.enabledProtocols || ['trojan', 'vless', 'vmess']).map((proto) => (
                      <button
                        key={proto}
                        onClick={() => setCreateProtocol(proto)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                          createProtocol === proto
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-[#12122a] text-gray-500 border border-purple-500/[0.08] hover:text-gray-300'
                        }`}
                      >
                        {proto.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Username */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">Client Name / Username</label>
                  <input
                    type="text"
                    value={createUsername}
                    onChange={(e) => setCreateUsername(e.target.value)}
                    placeholder="e.g. user123 or Aung Thu"
                    className="w-full bg-[#12122a] border border-purple-500/10 text-white rounded-xl px-4 py-3 focus:border-purple-500 focus:outline-none placeholder-gray-600"
                  />
                </div>

                {/* Devices + Expiry + Data */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">Devices</label>
                    <select
                      value={createDevices}
                      onChange={(e) => setCreateDevices(Number(e.target.value))}
                      className="w-full bg-[#12122a] border border-purple-500/10 text-white rounded-xl px-3 py-3 focus:border-purple-500 focus:outline-none"
                    >
                      {[1, 2, 3, 4, 5].map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">Expiry (days)</label>
                    <input
                      type="number"
                      value={createExpiryDays}
                      onChange={(e) => setCreateExpiryDays(Number(e.target.value))}
                      min={1}
                      max={365}
                      className="w-full bg-[#12122a] border border-purple-500/10 text-white rounded-xl px-3 py-3 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">Data (GB)</label>
                    <input
                      type="number"
                      value={createDataLimitGB}
                      onChange={(e) => setCreateDataLimitGB(Number(e.target.value))}
                      min={0}
                      placeholder="0 = ∞"
                      className="w-full bg-[#12122a] border border-purple-500/10 text-white rounded-xl px-3 py-3 focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </div>

                {createType === 'test' && (
                  <p className="text-xs text-amber-400/70">
                    ⚠️ Test key defaults: 1 device, 3 days, 3GB data limit
                  </p>
                )}

                {createError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
                    ❌ {createError}
                  </div>
                )}

                <button
                  onClick={handleCreateKey}
                  disabled={creating || !createUsername.trim()}
                  className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
                  ) : (
                    <><Plus className="w-4 h-4" /> Create {createType === 'test' ? 'Test' : 'Sell'} Key</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
