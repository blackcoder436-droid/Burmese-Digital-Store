'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Archive,
  Building2,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Server,
  Shield,
  AlertTriangle,
  Users,
  Wrench,
} from 'lucide-react';

type PrivateVpnService = {
  _id: string;
  serviceId: string;
  customerName: string;
  customerType: 'family' | 'company' | 'internal';
  contactName?: string;
  status: 'planned' | 'provisioning' | 'active' | 'suspended' | 'rotating' | 'archived' | 'error';
  actionMode: 'create_new' | 'attach_existing' | 'replace_existing';
  linkedServerId?: string;
  domain: {
    hostname: string;
    proxied: boolean;
    ttl: number;
  };
  droplet: {
    dropletName: string;
    dropletId?: string;
    publicIp?: string;
    region: string;
    size: string;
    image: string;
    dropletLimit: number;
  };
  panel: {
    panelPort: number;
    subPort: number;
    protocolPorts: {
      vless: number;
      trojan: number;
      vmess: number;
      shadowsocks: number;
    };
    ufwAllowPorts: number[];
    installStatus: string;
  };
  updatedAt: string;
};

const STATUS_STYLES: Record<PrivateVpnService['status'], string> = {
  planned: 'border-slate-500/30 bg-slate-500/10 text-slate-200',
  provisioning: 'border-sky-400/30 bg-sky-400/10 text-sky-200',
  active: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  suspended: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  rotating: 'border-violet-400/30 bg-violet-400/10 text-violet-200',
  archived: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300',
  error: 'border-red-400/30 bg-red-400/10 text-red-200',
};

const ACTION_LABELS: Record<PrivateVpnService['actionMode'], string> = {
  create_new: 'Create new',
  attach_existing: 'Attach existing',
  replace_existing: 'Replace existing',
};

function customerIcon(type: PrivateVpnService['customerType']) {
  if (type === 'company') return Building2;
  if (type === 'internal') return Shield;
  return Users;
}

function formatDate(value?: string) {
  if (!value) return 'unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

async function readApiJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  return JSON.parse(text);
}

export default function PrivateServersPage() {
  const [services, setServices] = useState<PrivateVpnService[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');

  const activeServices = useMemo(() => services.filter((service) => service.status === 'active').length, [services]);
  const plannedServices = useMemo(() => services.filter((service) => service.status === 'planned').length, [services]);
  const attentionServices = useMemo(
    () => services.filter((service) => ['error', 'rotating', 'provisioning'].includes(service.status)).length,
    [services]
  );

  useEffect(() => {
    void loadServices();
  }, []);

  async function loadServices() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/private-servers', { cache: 'no-store' });
      const data = await readApiJson(response);
      if (data?.success) {
        setServices(data.data.services || []);
        setCounts(data.data.counts || {});
      } else {
        toast.error(data?.error || 'Failed to load private servers');
      }
    } catch {
      toast.error('Failed to load private servers');
    } finally {
      setLoading(false);
    }
  }

  async function archiveService(serviceId: string) {
    if (!window.confirm(`Archive "${serviceId}"? This only archives the app record. It does not delete DO or Cloudflare resources.`)) {
      return;
    }

    setSavingId(serviceId);
    try {
      const response = await fetch(`/api/admin/private-servers?serviceId=${encodeURIComponent(serviceId)}`, {
        method: 'DELETE',
      });
      const data = await readApiJson(response);
      if (data?.success) {
        toast.success(data.message || 'Private server archived');
        await loadServices();
      } else {
        toast.error(data?.error || 'Failed to archive private server');
      }
    } catch {
      toast.error('Failed to archive private server');
    } finally {
      setSavingId('');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-300/80">Fleet Management</p>
          <h1 className="mt-2 text-2xl font-bold text-white">Private VPN Servers</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Family and company VPN services with linked domain, droplet, and 3xUI panel records.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadServices()}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <Link
            href="/admin/rotate"
            className="inline-flex items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-400/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-400/20"
          >
            <Wrench className="h-4 w-4" />
            Rotate / Repair
          </Link>
          <Link
            href="/admin/private-servers/deploy"
            className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
          >
            <Plus className="h-4 w-4" />
            Deploy New
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Server} label="Total" value={services.length} />
        <SummaryCard icon={CheckCircle2} label="Active" value={activeServices} tone="emerald" />
        <SummaryCard icon={Clock3} label="Planned" value={plannedServices || counts.planned || 0} tone="sky" />
        <SummaryCard icon={AlertTriangle} label="Needs attention" value={attentionServices} tone="amber" />
      </div>

      <div className="rounded-lg border border-white/10 bg-slate-950/60">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center text-slate-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-sky-300" />
            Loading private servers...
          </div>
        ) : services.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <Server className="h-10 w-10 text-slate-600" />
            <h2 className="mt-4 text-lg font-semibold text-white">No private VPN services yet</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
              Start with a deploy draft, then wire real provisioning jobs after the plan is reviewed.
            </p>
            <Link
              href="/admin/private-servers/deploy"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
            >
              <Plus className="h-4 w-4" />
              Create deploy draft
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Domain</th>
                  <th className="px-4 py-3 font-semibold">Droplet</th>
                  <th className="px-4 py-3 font-semibold">Panel</th>
                  <th className="px-4 py-3 font-semibold">Mode</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Updated</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => {
                  const Icon = customerIcon(service.customerType);
                  return (
                    <tr key={service.serviceId} className="border-b border-white/5 text-slate-300 last:border-0">
                      <td className="px-4 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-white">{service.customerName}</p>
                            <p className="truncate text-xs text-slate-500">{service.serviceId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-mono text-xs text-slate-200">{service.domain.hostname}</div>
                        <div className="mt-1 text-xs text-slate-500">{service.domain.proxied ? 'Orange cloud' : 'DNS only'}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-200">{service.droplet.dropletName}</div>
                        <div className="mt-1 font-mono text-xs text-slate-500">
                          {service.droplet.publicIp || service.droplet.region} / {service.droplet.size}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-mono text-xs text-slate-200">
                          {service.panel.panelPort} / sub {service.panel.subPort}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">VLESS {service.panel.protocolPorts.vless}</div>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-400">{ACTION_LABELS[service.actionMode]}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-lg border px-2 py-1 text-xs font-semibold ${STATUS_STYLES[service.status]}`}>
                          {service.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500">{formatDate(service.updatedAt)}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/rotate?server=${encodeURIComponent(service.linkedServerId || service.serviceId)}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-violet-400/20 bg-violet-400/10 px-2.5 py-1.5 text-xs font-semibold text-violet-100 transition hover:bg-violet-400/20"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Rotate
                          </Link>
                          <Link
                            href={service.domain.hostname ? `https://${service.domain.hostname}:${service.panel.panelPort}` : '#'}
                            target="_blank"
                            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Panel
                          </Link>
                          <button
                            type="button"
                            onClick={() => void archiveService(service.serviceId)}
                            disabled={savingId === service.serviceId}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-400/20 bg-red-400/10 px-2.5 py-1.5 text-xs font-semibold text-red-100 transition hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {savingId === service.serviceId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                            Archive
                          </button>
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
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone = 'slate',
}: {
  icon: any;
  label: string;
  value: number;
  tone?: 'slate' | 'emerald' | 'sky' | 'amber';
}) {
  const tones = {
    slate: 'border-white/10 bg-white/5 text-slate-200',
    emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    sky: 'border-sky-400/20 bg-sky-400/10 text-sky-200',
    amber: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  };

  return (
    <div className={`rounded-lg border p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">{label}</p>
          <p className="mt-2 text-2xl font-bold text-white">{value}</p>
        </div>
        <Icon className="h-5 w-5 opacity-80" />
      </div>
    </div>
  );
}
