'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  BookOpen,
  ClipboardList,
  History,
  Loader2,
  Plus,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

type TabKey = 'prompt' | 'knowledge' | 'commands' | 'logs';
type Channel = 'all' | 'website' | 'telegram' | 'facebook';

interface AiOpsSettings {
  enabled: boolean;
  customerSystemPrompt: string;
  responseStyle: string;
  fallbackReply: string;
  paymentAttachmentReply: string;
  escalationReply: string;
  maxKnowledgeItems: number;
  allowCustomerOrderLookup: boolean;
  allowAiOrderActions: boolean;
}

interface KnowledgeItem {
  _id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  channels: Channel[];
  enabled: boolean;
  priority: number;
  updatedAt: string;
}

interface CommandItem {
  _id: string;
  title: string;
  type: string;
  content: string;
  channels: Channel[];
  enabled: boolean;
  priority: number;
  startsAt?: string;
  endsAt?: string;
  updatedAt: string;
}

interface BotLog {
  _id: string;
  channel: string;
  direction: string;
  source: string;
  status: string;
  messagePreview?: string;
  replyPreview?: string;
  aiModel?: string;
  durationMs?: number;
  createdAt: string;
}

const DEFAULT_SETTINGS: AiOpsSettings = {
  enabled: true,
  customerSystemPrompt: '',
  responseStyle: '',
  fallbackReply: '',
  paymentAttachmentReply: '',
  escalationReply: '',
  maxKnowledgeItems: 8,
  allowCustomerOrderLookup: true,
  allowAiOrderActions: false,
};

const DEFAULT_KNOWLEDGE_FORM = {
  title: '',
  category: 'faq',
  content: '',
  tags: '',
  channels: ['all'] as Channel[],
  enabled: true,
  priority: 0,
};

const DEFAULT_COMMAND_FORM = {
  title: '',
  type: 'notice',
  content: '',
  channels: ['all'] as Channel[],
  enabled: true,
  priority: 0,
  startsAt: '',
  endsAt: '',
};

const tabs = [
  { key: 'prompt' as TabKey, label: 'Prompt', icon: SlidersHorizontal },
  { key: 'knowledge' as TabKey, label: 'Knowledge', icon: BookOpen },
  { key: 'commands' as TabKey, label: 'Command Center', icon: ClipboardList },
  { key: 'logs' as TabKey, label: 'Logs', icon: History },
];

const channels: Channel[] = ['all', 'website', 'telegram', 'facebook'];
const categories = ['pricing', 'service', 'setup', 'troubleshooting', 'payment', 'policy', 'faq', 'announcement', 'other'];
const commandTypes = ['notice', 'rule', 'promotion', 'maintenance', 'escalation'];

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 rounded-full transition-colors ${
        checked ? 'bg-emerald-500' : 'bg-gray-700'
      }`}
      aria-pressed={checked}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function ChannelPicker({
  value,
  onChange,
}: {
  value: Channel[];
  onChange: (channels: Channel[]) => void;
}) {
  function toggle(channel: Channel) {
    if (channel === 'all') {
      onChange(['all']);
      return;
    }

    const withoutAll = value.filter((item) => item !== 'all');
    const next = withoutAll.includes(channel)
      ? withoutAll.filter((item) => item !== channel)
      : [...withoutAll, channel];
    onChange(next.length > 0 ? next : ['all']);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {channels.map((channel) => (
        <button
          key={channel}
          type="button"
          onClick={() => toggle(channel)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
            value.includes(channel)
              ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200'
              : 'border-white/10 bg-white/[0.03] text-gray-400 hover:text-white'
          }`}
        >
          {channel}
        </button>
      ))}
    </div>
  );
}

export default function AdminAiOpsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('prompt');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AiOpsSettings>(DEFAULT_SETTINGS);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [commands, setCommands] = useState<CommandItem[]>([]);
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [knowledgeForm, setKnowledgeForm] = useState(DEFAULT_KNOWLEDGE_FORM);
  const [commandForm, setCommandForm] = useState(DEFAULT_COMMAND_FORM);
  const [editingKnowledgeId, setEditingKnowledgeId] = useState<string | null>(null);
  const [editingCommandId, setEditingCommandId] = useState<string | null>(null);
  const [knowledgeSearch, setKnowledgeSearch] = useState('');
  const [logChannel, setLogChannel] = useState('');

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [logChannel]);

  const stats = useMemo(() => {
    return {
      enabledKnowledge: knowledge.filter((item) => item.enabled).length,
      activeCommands: commands.filter((item) => item.enabled).length,
      failedLogs: logs.filter((log) => log.status === 'failed').length,
    };
  }, [knowledge, commands, logs]);

  async function fetchAll() {
    setLoading(true);
    try {
      await Promise.all([fetchOverview(), fetchKnowledge(), fetchCommands(), fetchLogs()]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchOverview() {
    const res = await fetch('/api/admin/ai-ops');
    const data = await res.json();
    if (data.success) {
      setSettings({
        ...DEFAULT_SETTINGS,
        ...data.data.settings,
      });
    }
  }

  async function fetchKnowledge(search = knowledgeSearch) {
    const params = new URLSearchParams({ limit: '100' });
    if (search.trim()) params.set('search', search.trim());
    const res = await fetch(`/api/admin/ai-ops/knowledge?${params}`);
    const data = await res.json();
    if (data.success) setKnowledge(data.data.items || []);
  }

  async function fetchCommands() {
    const res = await fetch('/api/admin/ai-ops/commands');
    const data = await res.json();
    if (data.success) setCommands(data.data.items || []);
  }

  async function fetchLogs() {
    const params = new URLSearchParams({ limit: '50' });
    if (logChannel) params.set('channel', logChannel);
    const res = await fetch(`/api/admin/ai-ops/logs?${params}`);
    const data = await res.json();
    if (data.success) setLogs(data.data.logs || []);
  }

  async function saveSettings() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/ai-ops', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Save failed');
      setSettings({ ...DEFAULT_SETTINGS, ...data.data.settings });
      toast.success('AI Ops settings saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function seedProjectKnowledge() {
    if (!confirm('Seed/update project knowledge and AI rules?')) return;

    setSaving(true);
    try {
      const res = await fetch('/api/admin/ai-ops/seed-project-knowledge', {
        method: 'POST',
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Seed failed');
      toast.success('Project knowledge seeded');
      await Promise.all([fetchKnowledge(), fetchCommands()]);
      setActiveTab('knowledge');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Seed failed');
    } finally {
      setSaving(false);
    }
  }

  async function saveKnowledge() {
    if (!knowledgeForm.title.trim() || !knowledgeForm.content.trim()) {
      toast.error('Title and content are required');
      return;
    }

    setSaving(true);
    try {
      const url = editingKnowledgeId
        ? `/api/admin/ai-ops/knowledge/${editingKnowledgeId}`
        : '/api/admin/ai-ops/knowledge';
      const method = editingKnowledgeId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(knowledgeForm),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Save failed');
      toast.success(editingKnowledgeId ? 'Knowledge updated' : 'Knowledge added');
      resetKnowledgeForm();
      fetchKnowledge();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function deleteKnowledge(id: string) {
    if (!confirm('Delete this knowledge item?')) return;
    const res = await fetch(`/api/admin/ai-ops/knowledge/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      toast.success('Knowledge deleted');
      fetchKnowledge();
    } else {
      toast.error(data.error || 'Delete failed');
    }
  }

  function editKnowledge(item: KnowledgeItem) {
    setEditingKnowledgeId(item._id);
    setKnowledgeForm({
      title: item.title,
      category: item.category,
      content: item.content,
      tags: item.tags.join(', '),
      channels: item.channels,
      enabled: item.enabled,
      priority: item.priority,
    });
    setActiveTab('knowledge');
  }

  function resetKnowledgeForm() {
    setEditingKnowledgeId(null);
    setKnowledgeForm(DEFAULT_KNOWLEDGE_FORM);
  }

  async function saveCommand() {
    if (!commandForm.title.trim() || !commandForm.content.trim()) {
      toast.error('Title and content are required');
      return;
    }

    setSaving(true);
    try {
      const url = editingCommandId
        ? `/api/admin/ai-ops/commands/${editingCommandId}`
        : '/api/admin/ai-ops/commands';
      const method = editingCommandId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commandForm),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Save failed');
      toast.success(editingCommandId ? 'Command updated' : 'Command added');
      resetCommandForm();
      fetchCommands();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function deleteCommand(id: string) {
    if (!confirm('Delete this command item?')) return;
    const res = await fetch(`/api/admin/ai-ops/commands/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      toast.success('Command deleted');
      fetchCommands();
    } else {
      toast.error(data.error || 'Delete failed');
    }
  }

  function editCommand(item: CommandItem) {
    setEditingCommandId(item._id);
    setCommandForm({
      title: item.title,
      type: item.type,
      content: item.content,
      channels: item.channels,
      enabled: item.enabled,
      priority: item.priority,
      startsAt: item.startsAt ? item.startsAt.slice(0, 16) : '',
      endsAt: item.endsAt ? item.endsAt.slice(0, 16) : '',
    });
    setActiveTab('commands');
  }

  function resetCommandForm() {
    setEditingCommandId(null);
    setCommandForm(DEFAULT_COMMAND_FORM);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-10 w-10 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10">
            <Bot className="h-6 w-6 text-cyan-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">AI Operations Center</h1>
            <p className="text-sm text-gray-500">Website, Telegram, Messenger</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            onClick={seedProjectKnowledge}
            disabled={saving}
            className="btn-secondary inline-flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
            Seed Project Knowledge
          </button>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
              <p className="font-bold text-emerald-300">{stats.enabledKnowledge}</p>
              <p className="text-gray-500">Knowledge</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
              <p className="font-bold text-cyan-300">{stats.activeCommands}</p>
              <p className="text-gray-500">Commands</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
              <p className="font-bold text-amber-300">{stats.failedLogs}</p>
              <p className="text-gray-500">Failed</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                active
                  ? 'bg-purple-500/20 text-purple-200'
                  : 'text-gray-500 hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'prompt' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">AI Ops Engine</p>
              <p className="text-xs text-gray-500">Unified customer reply layer</p>
            </div>
            <Toggle
              checked={settings.enabled}
              onChange={(value) => setSettings((prev) => ({ ...prev, enabled: value }))}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-gray-300">System Prompt</span>
              <textarea
                rows={12}
                value={settings.customerSystemPrompt}
                onChange={(e) => setSettings((prev) => ({ ...prev, customerSystemPrompt: e.target.value }))}
                className="input-field resize-y"
              />
            </label>
            <div className="space-y-4">
              <label className="space-y-2 block">
                <span className="text-sm font-semibold text-gray-300">Response Style</span>
                <textarea
                  rows={5}
                  value={settings.responseStyle}
                  onChange={(e) => setSettings((prev) => ({ ...prev, responseStyle: e.target.value }))}
                  className="input-field resize-y"
                />
              </label>
              <label className="space-y-2 block">
                <span className="text-sm font-semibold text-gray-300">Payment Attachment Reply</span>
                <textarea
                  rows={3}
                  value={settings.paymentAttachmentReply}
                  onChange={(e) => setSettings((prev) => ({ ...prev, paymentAttachmentReply: e.target.value }))}
                  className="input-field resize-y"
                />
              </label>
              <label className="space-y-2 block">
                <span className="text-sm font-semibold text-gray-300">Fallback Reply</span>
                <textarea
                  rows={3}
                  value={settings.fallbackReply}
                  onChange={(e) => setSettings((prev) => ({ ...prev, fallbackReply: e.target.value }))}
                  className="input-field resize-y"
                />
              </label>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-gray-300">Escalation Reply</span>
              <textarea
                rows={4}
                value={settings.escalationReply}
                onChange={(e) => setSettings((prev) => ({ ...prev, escalationReply: e.target.value }))}
                className="input-field resize-y"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-gray-300">Max Knowledge Items</span>
              <input
                type="number"
                min={0}
                max={20}
                value={settings.maxKnowledgeItems}
                onChange={(e) => setSettings((prev) => ({ ...prev, maxKnowledgeItems: Number(e.target.value) }))}
                className="input-field"
              />
            </label>
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-300">Customer order lookup</span>
                <Toggle
                  checked={settings.allowCustomerOrderLookup}
                  onChange={(value) => setSettings((prev) => ({ ...prev, allowCustomerOrderLookup: value }))}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-300">AI order actions</span>
                <Toggle
                  checked={settings.allowAiOrderActions}
                  onChange={(value) => setSettings((prev) => ({ ...prev, allowAiOrderActions: value }))}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="btn-electric inline-flex items-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Settings
            </button>
          </div>
        </div>
      )}

      {activeTab === 'knowledge' && (
        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">
                {editingKnowledgeId ? 'Edit Knowledge' : 'Add Knowledge'}
              </h2>
              {editingKnowledgeId && (
                <button onClick={resetKnowledgeForm} className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <input
              value={knowledgeForm.title}
              onChange={(e) => setKnowledgeForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Title"
              className="input-field"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={knowledgeForm.category}
                onChange={(e) => setKnowledgeForm((prev) => ({ ...prev, category: e.target.value }))}
                className="input-field"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                max={100}
                value={knowledgeForm.priority}
                onChange={(e) => setKnowledgeForm((prev) => ({ ...prev, priority: Number(e.target.value) }))}
                className="input-field"
                placeholder="Priority"
              />
            </div>
            <textarea
              rows={8}
              value={knowledgeForm.content}
              onChange={(e) => setKnowledgeForm((prev) => ({ ...prev, content: e.target.value }))}
              placeholder="Answer, policy, setup guide, troubleshooting steps..."
              className="input-field resize-y"
            />
            <input
              value={knowledgeForm.tags}
              onChange={(e) => setKnowledgeForm((prev) => ({ ...prev, tags: e.target.value }))}
              placeholder="tags: vpn, price, android"
              className="input-field"
            />
            <ChannelPicker
              value={knowledgeForm.channels}
              onChange={(value) => setKnowledgeForm((prev) => ({ ...prev, channels: value }))}
            />
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Enabled</span>
              <Toggle
                checked={knowledgeForm.enabled}
                onChange={(value) => setKnowledgeForm((prev) => ({ ...prev, enabled: value }))}
              />
            </div>
            <button
              onClick={saveKnowledge}
              disabled={saving}
              className="btn-electric flex w-full items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {editingKnowledgeId ? 'Update Knowledge' : 'Add Knowledge'}
            </button>
          </div>

          <div className="space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                fetchKnowledge();
              }}
              className="relative"
            >
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                value={knowledgeSearch}
                onChange={(e) => setKnowledgeSearch(e.target.value)}
                placeholder="Search knowledge..."
                className="input-field pl-10"
              />
            </form>
            <div className="overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.03] text-xs uppercase tracking-widest text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Title</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-left">Channels</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {knowledge.map((item) => (
                    <tr key={item._id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <button onClick={() => editKnowledge(item)} className="text-left font-semibold text-white hover:text-cyan-300">
                          {item.title}
                        </button>
                        <p className="mt-1 line-clamp-1 text-xs text-gray-500">{item.content}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{item.category}</td>
                      <td className="px-4 py-3 text-gray-400">{item.channels.join(', ')}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <span className={`rounded-full px-2 py-1 text-xs ${item.enabled ? 'bg-emerald-500/10 text-emerald-300' : 'bg-gray-500/10 text-gray-400'}`}>
                            {item.enabled ? 'ON' : 'OFF'}
                          </span>
                          <button onClick={() => deleteKnowledge(item._id)} className="rounded-lg p-2 text-gray-500 hover:bg-red-500/10 hover:text-red-300">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {knowledge.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-gray-500">No knowledge items</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'commands' && (
        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">
                {editingCommandId ? 'Edit Command' : 'Add Command'}
              </h2>
              {editingCommandId && (
                <button onClick={resetCommandForm} className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <input
              value={commandForm.title}
              onChange={(e) => setCommandForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Title"
              className="input-field"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={commandForm.type}
                onChange={(e) => setCommandForm((prev) => ({ ...prev, type: e.target.value }))}
                className="input-field"
              >
                {commandTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                max={100}
                value={commandForm.priority}
                onChange={(e) => setCommandForm((prev) => ({ ...prev, priority: Number(e.target.value) }))}
                className="input-field"
                placeholder="Priority"
              />
            </div>
            <textarea
              rows={7}
              value={commandForm.content}
              onChange={(e) => setCommandForm((prev) => ({ ...prev, content: e.target.value }))}
              placeholder="Temporary rule, promotion, maintenance notice..."
              className="input-field resize-y"
            />
            <ChannelPicker
              value={commandForm.channels}
              onChange={(value) => setCommandForm((prev) => ({ ...prev, channels: value }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="datetime-local"
                value={commandForm.startsAt}
                onChange={(e) => setCommandForm((prev) => ({ ...prev, startsAt: e.target.value }))}
                className="input-field"
              />
              <input
                type="datetime-local"
                value={commandForm.endsAt}
                onChange={(e) => setCommandForm((prev) => ({ ...prev, endsAt: e.target.value }))}
                className="input-field"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Enabled</span>
              <Toggle
                checked={commandForm.enabled}
                onChange={(value) => setCommandForm((prev) => ({ ...prev, enabled: value }))}
              />
            </div>
            <button
              onClick={saveCommand}
              disabled={saving}
              className="btn-electric flex w-full items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {editingCommandId ? 'Update Command' : 'Add Command'}
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-widest text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Title</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Channels</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {commands.map((item) => (
                  <tr key={item._id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <button onClick={() => editCommand(item)} className="text-left font-semibold text-white hover:text-cyan-300">
                        {item.title}
                      </button>
                      <p className="mt-1 line-clamp-1 text-xs text-gray-500">{item.content}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{item.type}</td>
                    <td className="px-4 py-3 text-gray-400">{item.channels.join(', ')}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <span className={`rounded-full px-2 py-1 text-xs ${item.enabled ? 'bg-emerald-500/10 text-emerald-300' : 'bg-gray-500/10 text-gray-400'}`}>
                          {item.enabled ? 'ON' : 'OFF'}
                        </span>
                        <button onClick={() => deleteCommand(item._id)} className="rounded-lg p-2 text-gray-500 hover:bg-red-500/10 hover:text-red-300">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {commands.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-gray-500">No command items</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={logChannel}
              onChange={(e) => setLogChannel(e.target.value)}
              className="input-field max-w-[220px]"
            >
              <option value="">all channels</option>
              <option value="website">website</option>
              <option value="telegram">telegram</option>
              <option value="facebook">facebook</option>
            </select>
            <button onClick={fetchLogs} className="btn-primary text-sm">Refresh</button>
          </div>
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-widest text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">Channel</th>
                  <th className="px-4 py-3 text-left">Source</th>
                  <th className="px-4 py-3 text-left">Message</th>
                  <th className="px-4 py-3 text-left">Reply</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {logs.map((log) => (
                  <tr key={log._id} className="align-top hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{formatDate(log.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-300">{log.channel}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-purple-500/10 px-2 py-1 text-xs text-purple-200">
                        {log.source}
                      </span>
                    </td>
                    <td className="max-w-[260px] px-4 py-3 text-gray-400">{log.messagePreview || '-'}</td>
                    <td className="max-w-[260px] px-4 py-3 text-gray-400">{log.replyPreview || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`rounded-full px-2 py-1 text-xs ${
                        log.status === 'failed'
                          ? 'bg-red-500/10 text-red-300'
                          : log.status === 'skipped'
                            ? 'bg-amber-500/10 text-amber-300'
                            : 'bg-emerald-500/10 text-emerald-300'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">No logs yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
