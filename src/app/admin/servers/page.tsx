'use client';

import { useEffect, useState } from 'react';
import {
  Server,
  Plus,
  Edit3,
  Trash2,
  Power,
  PowerOff,
  Loader2,
  Check,
  X,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Database,
  ExternalLink,
  Activity,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/language';

interface VpnServerData {
  _id: string;
  serverId: string;
  name: string;
  flag: string;
  url: string;
  panelPath: string;
  domain: string;
  subPort: number;
  trojanPort?: number | null;
  protocol: string;
  enabledProtocols?: string[];
  enabled: boolean;
  online: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

const PROTOCOLS = [
  { value: 'trojan', label: 'Trojan' },
  { value: 'vless', label: 'VLESS' },
  { value: 'vmess', label: 'VMess' },
  { value: 'shadowsocks', label: 'Shadowsocks' },
];

const FLAG_OPTIONS = ['🇸🇬', '🇺🇸', '🇯🇵', '🇰🇷', '🇩🇪', '🇬🇧', '🇫🇷', '🇳🇱', '🇦🇺', '🇨🇦', '🇮🇳', '🇭🇰', '🇹🇼', '🇹🇭', '🇲🇲', '🇻🇳'];

const emptyForm = {
  serverId: '',
  name: '',
  flag: '🇸🇬',
  url: '',
  panelPath: '/mka',
  domain: '',
  subPort: 2096,
  trojanPort: '' as string | number,
  protocol: 'trojan',
  enabledProtocols: ['trojan', 'vless', 'vmess', 'shadowsocks'] as string[],
  enabled: true,
  notes: '',
};

export default function AdminServersPage() {
  const { tr } = useLanguage();
  const [servers, setServers] = useState<VpnServerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // serverId of server being edited
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [totalEnabled, setTotalEnabled] = useState(0);
  const [totalDisabled, setTotalDisabled] = useState(0);
  const [healthData, setHealthData] = useState<Record<string, { online: boolean; latencyMs: number | null }>>({});

  useEffect(() => {
    fetchServers();
    fetchHealth();
  }, []);

  async function fetchHealth() {
    try {
      const res = await fetch('/api/vpn/health');
      const data = await res.json();
      if (data.success) {
        const map: Record<string, { online: boolean; latencyMs: number | null }> = {};
        for (const s of data.data.servers) {
          map[s.id] = { online: s.online, latencyMs: s.latencyMs };
        }
        setHealthData(map);
      }
    } catch {
      // Health check failed silently
    }
  }

  async function fetchServers() {
    try {
      const res = await fetch('/api/admin/servers');
      const data = await res.json();
      if (data.success) {
        setServers(data.data.servers);
        setTotalEnabled(data.data.enabled);
        setTotalDisabled(data.data.disabled);
      } else {
        toast.error(data.error || 'Failed to load servers');
      }
    } catch {
      toast.error(tr('Failed to load servers', 'Server များ ရယူ၍မရပါ'));
    } finally {
      setLoading(false);
    }
  }

  function openCreateForm() {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(true);
  }

  function openEditForm(server: VpnServerData) {
    setForm({
      serverId: server.serverId,
      name: server.name,
      flag: server.flag,
      url: server.url,
      panelPath: server.panelPath,
      domain: server.domain,
      subPort: server.subPort,
      trojanPort: server.trojanPort || '',
      protocol: server.protocol,
      enabledProtocols: server.enabledProtocols ?? ['trojan', 'vless', 'vmess', 'shadowsocks'],
      enabled: server.enabled,
      notes: server.notes || '',
    });
    setEditingId(server.serverId);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        ...form,
        trojanPort: form.trojanPort ? Number(form.trojanPort) : null,
        subPort: Number(form.subPort),
      };

      if (editingId) {
        // Update
        const res = await fetch('/api/admin/servers', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          toast.success(tr('Server updated', 'Server ပြင်ဆင်ပြီး'));
          cancelForm();
          fetchServers();
        } else {
          toast.error(data.error || 'Update failed');
        }
      } else {
        // Create
        const res = await fetch('/api/admin/servers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          toast.success(tr('Server created', 'Server အသစ်ထည့်ပြီး'));
          cancelForm();
          fetchServers();
        } else {
          toast.error(data.error || 'Create failed');
        }
      }
    } catch {
      toast.error(tr('Operation failed', 'လုပ်ဆောင်မှု မအောင်မြင်ပါ'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(server: VpnServerData) {
    try {
      const res = await fetch('/api/admin/servers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId: server.serverId, enabled: !server.enabled }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          server.enabled
            ? tr('Server disabled', 'Server ပိတ်ပြီး')
            : tr('Server enabled', 'Server ဖွင့်ပြီး')
        );
        fetchServers();
      } else {
        toast.error(data.error || 'Toggle failed');
      }
    } catch {
      toast.error('Failed');
    }
  }

  async function handleDelete(serverId: string) {
    setDeleting(serverId);
    try {
      const res = await fetch(`/api/admin/servers?serverId=${serverId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tr('Server deleted', 'Server ဖျက်ပြီး'));
        setConfirmDelete(null);
        fetchServers();
      } else {
        toast.error(data.error || 'Delete failed');
      }
    } catch {
      toast.error('Failed');
    } finally {
      setDeleting(null);
    }
  }

  async function seedServers() {
    setSeeding(true);
    try {
      const res = await fetch('/api/admin/servers/seed', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchServers();
      } else {
        toast.error(data.error || 'Seed failed');
      }
    } catch {
      toast.error('Seed failed');
    } finally {
      setSeeding(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-500/10 rounded-2xl">
            <Server className="w-7 h-7 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {tr('VPN Servers', 'VPN Server များ')}
            </h1>
            <p className="text-sm text-gray-400">
              {tr('Manage 3xUI panel servers and protocols', '3xUI panel server နှင့် protocol များ စီမံခန့်ခွဲရန်')}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {servers.length === 0 && (
            <button
              onClick={seedServers}
              disabled={seeding}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl transition-all"
            >
              {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              {tr('Seed Defaults', 'Default ထည့်ရန်')}
            </button>
          )}
          <button
            onClick={() => { fetchServers(); fetchHealth(); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-400 hover:text-white bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded-xl transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={openCreateForm}
            className="btn-electric flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {tr('Add Server', 'Server ထည့်ရန်')}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card-dark p-4">
          <p className="text-xs text-gray-500 mb-1">{tr('Total', 'စုစုပေါင်း')}</p>
          <p className="text-2xl font-bold text-white">{servers.length}</p>
        </div>
        <div className="card-dark p-4">
          <p className="text-xs text-gray-500 mb-1">{tr('Enabled', 'ဖွင့်ထား')}</p>
          <p className="text-2xl font-bold text-green-400">{totalEnabled}</p>
        </div>
        <div className="card-dark p-4">
          <p className="text-xs text-gray-500 mb-1">{tr('Disabled', 'ပိတ်ထား')}</p>
          <p className="text-2xl font-bold text-red-400">{totalDisabled}</p>
        </div>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="card-dark p-6 border-2 border-purple-500/20">
          <h2 className="text-lg font-bold text-white mb-4">
            {editingId
              ? tr('Edit Server', 'Server ပြင်ဆင်ရန်')
              : tr('Add New Server', 'Server အသစ်ထည့်ရန်')}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Server ID */}
              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-1">
                  Server ID <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.serverId}
                  onChange={(e) => setForm({ ...form, serverId: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                  placeholder="e.g. sg1, us2, jp1"
                  disabled={!!editingId}
                  className="input-dark w-full disabled:opacity-50"
                  required
                />
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-1">
                  {tr('Server Name', 'Server အမည်')} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Singapore 1"
                  className="input-dark w-full"
                  required
                />
              </div>

              {/* Flag */}
              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-1">
                  {tr('Flag', 'အလံ')} <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-2 items-center">
                  <select
                    value={form.flag}
                    onChange={(e) => setForm({ ...form, flag: e.target.value })}
                    className="input-dark flex-1"
                  >
                    {FLAG_OPTIONS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  <span className="text-2xl">{form.flag}</span>
                </div>
              </div>

              {/* Panel URL */}
              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-1">
                  Panel URL <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://panel.example.com:8080"
                  className="input-dark w-full"
                  required
                />
              </div>

              {/* Panel Path */}
              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-1">
                  Panel Path
                </label>
                <input
                  type="text"
                  value={form.panelPath}
                  onChange={(e) => setForm({ ...form, panelPath: e.target.value })}
                  placeholder="/mka"
                  className="input-dark w-full"
                />
              </div>

              {/* Domain */}
              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-1">
                  {tr('Connection Domain', 'ချိတ်ဆက်မည့် Domain')} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                  placeholder="server.example.com"
                  className="input-dark w-full"
                  required
                />
              </div>

              {/* Sub Port */}
              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-1">
                  Subscription Port
                </label>
                <input
                  type="number"
                  value={form.subPort}
                  onChange={(e) => setForm({ ...form, subPort: parseInt(e.target.value) || 2096 })}
                  className="input-dark w-full"
                />
              </div>

              {/* Trojan Port */}
              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-1">
                  Trojan Port <span className="text-gray-600">(optional)</span>
                </label>
                <input
                  type="number"
                  value={form.trojanPort}
                  onChange={(e) => setForm({ ...form, trojanPort: e.target.value })}
                  placeholder="e.g. 22716"
                  className="input-dark w-full"
                />
              </div>

              {/* Protocol */}
              <div>
                <label className="text-xs font-semibold text-gray-400 block mb-1">
                  {tr('Default Protocol', 'Protocol')} <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.protocol}
                  onChange={(e) => setForm({ ...form, protocol: e.target.value })}
                  className="input-dark w-full"
                >
                  {PROTOCOLS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Enabled Protocols */}
            <div>
              <label className="text-xs font-semibold text-gray-400 block mb-2">
                {tr('Available Protocols', 'ရွေးချယ်နိုင်သော Protocols')}
              </label>
              <div className="flex flex-wrap gap-3">
                {PROTOCOLS.map((p) => (
                  <label key={p.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.enabledProtocols.includes(p.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setForm({ ...form, enabledProtocols: [...form.enabledProtocols, p.value] });
                        } else {
                          // Don't allow unchecking all
                          if (form.enabledProtocols.length > 1) {
                            setForm({ ...form, enabledProtocols: form.enabledProtocols.filter((x) => x !== p.value) });
                          }
                        }
                      }}
                      className="w-4 h-4 rounded border-gray-600 bg-dark-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                    />
                    <span className="text-sm text-gray-300">{p.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {tr('Unchecked protocols will not be shown to users when ordering', 'ပယ်ဖျက်ထားသော protocol များကို order လုပ်တဲ့အခါ မပြပါ')}
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-semibold text-gray-400 block mb-1">
                {tr('Notes (admin only)', 'မှတ်ချက် (admin သီးသန့်)')}
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder={tr('Internal notes about this server...', 'ဤ server အကြောင်း မှတ်ချက်...')}
                className="input-dark w-full"
                rows={2}
              />
            </div>

            {/* Enabled toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                className="w-4 h-4 rounded border-gray-600 bg-dark-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
              />
              <span className="text-sm text-gray-300">{tr('Enabled (visible to users)', 'ဖွင့်ထားရန် (user များမြင်ရမည်)')}</span>
            </label>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="btn-electric flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editingId ? tr('Save Changes', 'ပြောင်းလဲမှု သိမ်းရန်') : tr('Create Server', 'Server ဖန်တီးရန်')}
              </button>
              <button
                type="button"
                onClick={cancelForm}
                className="px-4 py-2 text-sm font-semibold text-gray-400 hover:text-white transition-colors"
              >
                {tr('Cancel', 'ပယ်ဖျက်ရန်')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Servers List */}
      {servers.length === 0 ? (
        <div className="card-dark p-12 text-center">
          <Server className="w-12 h-12 text-dark-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-2">{tr('No servers configured', 'Server မရှိသေးပါ')}</p>
          <p className="text-sm text-gray-600 mb-4">
            {tr(
              'Click "Seed Defaults" to load initial servers, or add a new one manually.',
              '"Default ထည့်ရန်" ကို နှိပ်ပါ (သို့) "Server ထည့်ရန်" နှိပ်ပါ'
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map((server) => (
            <div
              key={server.serverId}
              className={`card-dark overflow-hidden transition-all ${
                !server.enabled ? 'opacity-60' : ''
              }`}
            >
              {/* Main Row */}
              <div className="flex items-center gap-4 p-4">
                {/* Flag + Status indicator */}
                <div className="relative flex-shrink-0">
                  <span className="text-4xl leading-none">{server.flag}</span>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-dark-800 ${
                      healthData[server.serverId]?.online ? 'bg-green-500' : server.enabled ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white truncate">{server.name}</h3>
                  </div>
                  <a
                    href={`${server.url}${server.panelPath}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors mt-0.5 font-mono"
                  >
                    {(() => {
                      try {
                        const u = new URL(server.url);
                        return `${u.hostname}:${u.port || '8080'}`;
                      } catch {
                        return server.url;
                      }
                    })()}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Ping display */}
                <div className="flex items-center gap-2">
                  {healthData[server.serverId] ? (
                    healthData[server.serverId].online ? (
                      <span className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg">
                        <Activity className="w-3 h-3" />
                        {healthData[server.serverId].latencyMs !== null
                          ? `${healthData[server.serverId].latencyMs}ms`
                          : 'Online'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg">
                        <PowerOff className="w-3 h-3" />
                        Offline
                      </span>
                    )
                  ) : (
                    <span className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/20 rounded-lg">
                      <Loader2 className="w-3 h-3 animate-spin" />
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleEnabled(server)}
                    className={`p-2 rounded-lg transition-all ${
                      server.enabled
                        ? 'text-green-400 hover:bg-green-500/10'
                        : 'text-red-400 hover:bg-red-500/10'
                    }`}
                    title={server.enabled ? 'Disable' : 'Enable'}
                  >
                    {server.enabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => openEditForm(server)}
                    className="p-2 text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-all"
                    title="Edit"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(server.serverId)}
                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setExpandedId(expandedId === server.serverId ? null : server.serverId)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-dark-700 rounded-lg transition-all"
                    title="Details"
                  >
                    {expandedId === server.serverId ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Delete Confirmation */}
              {confirmDelete === server.serverId && (
                <div className="px-4 pb-4">
                  <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-xl flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                    <p className="text-sm text-red-400 flex-1">
                      {tr(
                        `Delete "${server.name}"? This cannot be undone. Servers with active orders cannot be deleted.`,
                        `"${server.name}" ကို ဖျက်မလား? ပြန်ယူ၍မရပါ။ Active order ရှိတဲ့ server ဖျက်၍မရပါ။`
                      )}
                    </p>
                    <button
                      onClick={() => handleDelete(server.serverId)}
                      disabled={deleting === server.serverId}
                      className="px-3 py-1.5 text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-all"
                    >
                      {deleting === server.serverId ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        tr('Confirm Delete', 'ဖျက်မည်')
                      )}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="p-1.5 text-gray-500 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Expanded Details */}
              {expandedId === server.serverId && (
                <div className="px-4 pb-4 border-t border-dark-700 pt-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-gray-600 block">{tr('Panel URL', 'Panel URL')}</span>
                      <span className="text-gray-300 font-mono break-all">{server.url}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 block">{tr('Panel Path', 'Panel Path')}</span>
                      <span className="text-gray-300 font-mono">{server.panelPath}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 block">{tr('Domain', 'Domain')}</span>
                      <span className="text-gray-300 font-mono">{server.domain}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 block">{tr('Sub Port', 'Sub Port')}</span>
                      <span className="text-gray-300 font-mono">{server.subPort}</span>
                    </div>
                    {server.trojanPort && (
                      <div>
                        <span className="text-gray-600 block">{tr('Trojan Port', 'Trojan Port')}</span>
                        <span className="text-gray-300 font-mono">{server.trojanPort}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-600 block">{tr('Protocol', 'Protocol')}</span>
                      <span className="text-gray-300 uppercase">{server.protocol}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 block">{tr('Created', 'ဖန်တီးချိန်')}</span>
                      <span className="text-gray-300">{new Date(server.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 block">{tr('Updated', 'ပြင်ဆင်ချိန်')}</span>
                      <span className="text-gray-300">{new Date(server.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {server.notes && (
                    <div className="mt-3 p-2 bg-dark-800 rounded-lg">
                      <span className="text-gray-600 text-xs block mb-1">{tr('Notes', 'မှတ်ချက်')}</span>
                      <p className="text-sm text-gray-400">{server.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
