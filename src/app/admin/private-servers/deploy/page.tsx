'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Cloud,
  Edit3,
  Globe,
  HardDrive,
  Loader2,
  Network,
  Plus,
  RefreshCw,
  Save,
  Server,
  ShieldCheck,
  Terminal,
  Trash2,
} from 'lucide-react';

type DoToken = {
  id: string;
  label: string;
  token: string;
  enabled?: boolean;
};

type CfAccount = {
  id: string;
  label: string;
  email?: string;
  token?: string;
  enabled?: boolean;
};

type CfZone = {
  id: string;
  name: string;
  status?: string;
};

type CfDnsRecord = {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
  priority?: number | null;
  modifiedOn?: string | null;
};

type CfRecordDraft = {
  recordId: string;
  type: string;
  name: string;
  content: string;
  ttl: string;
  proxied: boolean;
  priority: string;
};

type DoOption = {
  value: string;
  label: string;
  description?: string;
  regions?: string[];
  region?: string;
  available?: boolean;
};

type VpnServerOption = {
  serverId: string;
  name: string;
  domain: string;
  url: string;
};

type DeployForm = {
  serviceId: string;
  customerName: string;
  customerType: 'family' | 'company' | 'internal';
  contactName: string;
  contactEmail: string;
  notes: string;
  actionMode: 'create_new' | 'attach_existing' | 'replace_existing';
  linkedServerId: string;
  domain: {
    cfAccountId: string;
    zoneId: string;
    zoneName: string;
    hostname: string;
    content: string;
    dnsRecordId: string;
    proxied: boolean;
    ttl: string;
  };
  droplet: {
    tokenId: string;
    dropletLimit: string;
    dropletName: string;
    dropletId: string;
    publicIp: string;
    region: string;
    size: string;
    image: string;
    backups: boolean;
    ipv6: boolean;
    monitoring: boolean;
    publicNetworking: boolean;
    dropletAgent: boolean;
    sshKeys: string;
    vpcUuid: string;
    volumes: string;
    tags: string;
    userData: string;
    existingDropletId: string;
  };
  panel: {
    username: string;
    password: string;
    enable2FA: boolean;
    panelPath: string;
    panelPort: string;
    subPort: string;
    vlessPort: string;
    trojanPort: string;
    vmessPort: string;
    shadowsocksPort: string;
    ufwAllowPorts: string;
  };
};

const DEFAULT_FORM: DeployForm = {
  serviceId: '',
  customerName: '',
  customerType: 'family',
  contactName: '',
  contactEmail: '',
  notes: '',
  actionMode: 'create_new',
  linkedServerId: '',
  domain: {
    cfAccountId: '',
    zoneId: '',
    zoneName: '',
    hostname: '',
    content: '',
    dnsRecordId: '',
    proxied: false,
    ttl: '60',
  },
  droplet: {
    tokenId: '',
    dropletLimit: '3',
    dropletName: '',
    dropletId: '',
    publicIp: '',
    region: 'sgp1',
    size: 's-1vcpu-1gb',
    image: 'ubuntu-22-04-x64',
    backups: false,
    ipv6: false,
    monitoring: true,
    publicNetworking: true,
    dropletAgent: true,
    sshKeys: '',
    vpcUuid: '',
    volumes: '',
    tags: 'private-vpn, family',
    userData: '',
    existingDropletId: '',
  },
  panel: {
    username: 'admin',
    password: '',
    enable2FA: false,
    panelPath: '/mka',
    panelPort: '2053',
    subPort: '2096',
    vlessPort: '443',
    trojanPort: '2083',
    vmessPort: '2087',
    shadowsocksPort: '8443',
    ufwAllowPorts: '443,8443,2053,2083,2087,2096',
  },
};

const FALLBACK_REGIONS = [
  { value: 'sgp1', label: 'Singapore - SGP1' },
  { value: 'nyc1', label: 'New York - NYC1' },
  { value: 'nyc3', label: 'New York - NYC3' },
  { value: 'sfo3', label: 'San Francisco - SFO3' },
  { value: 'fra1', label: 'Frankfurt - FRA1' },
  { value: 'blr1', label: 'Bangalore - BLR1' },
];

const FALLBACK_SIZES = [
  { value: 's-1vcpu-1gb', label: 's-1vcpu-1gb', description: '1 vCPU / 1 GB RAM' },
  { value: 's-1vcpu-2gb', label: 's-1vcpu-2gb', description: '1 vCPU / 2 GB RAM' },
  { value: 's-2vcpu-2gb', label: 's-2vcpu-2gb', description: '2 vCPU / 2 GB RAM' },
  { value: 's-2vcpu-4gb', label: 's-2vcpu-4gb', description: '2 vCPU / 4 GB RAM' },
];

const FALLBACK_IMAGES = [
  { value: 'ubuntu-24-04-x64', label: 'Ubuntu 24.04 x64' },
  { value: 'ubuntu-22-04-x64', label: 'Ubuntu 22.04 x64' },
  { value: 'debian-12-x64', label: 'Debian 12 x64' },
];

const EMPTY_RECORD_DRAFT: CfRecordDraft = {
  recordId: '',
  type: 'A',
  name: '',
  content: '',
  ttl: '60',
  proxied: false,
  priority: '',
};

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function splitCsv(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function filterByRegion(options: DoOption[], region: string) {
  if (!region) return options;
  return options.filter((option) => {
    if (option.available === false) return false;
    if (option.region) return option.region === region;
    if (Array.isArray(option.regions) && option.regions.length > 0) return option.regions.includes(region);
    return true;
  });
}

async function readApiJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  return JSON.parse(text);
}

export default function DeployPrivateServerPage() {
  const router = useRouter();
  const [form, setForm] = useState<DeployForm>(DEFAULT_FORM);
  const [tokens, setTokens] = useState<DoToken[]>([]);
  const [cfAccounts, setCfAccounts] = useState<CfAccount[]>([]);
  const [cfZones, setCfZones] = useState<CfZone[]>([]);
  const [cfRecords, setCfRecords] = useState<CfDnsRecord[]>([]);
  const [recordDraft, setRecordDraft] = useState<CfRecordDraft>(EMPTY_RECORD_DRAFT);
  const [servers, setServers] = useState<VpnServerOption[]>([]);
  const [doOptions, setDoOptions] = useState({
    regions: [] as DoOption[],
    sizes: [] as DoOption[],
    images: [] as DoOption[],
    sshKeys: [] as DoOption[],
    vpcs: [] as DoOption[],
    volumes: [] as DoOption[],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [doLoading, setDoLoading] = useState(false);
  const [cfZonesLoading, setCfZonesLoading] = useState(false);
  const [cfRecordsLoading, setCfRecordsLoading] = useState(false);
  const [cfSaving, setCfSaving] = useState(false);

  const regionOptions = doOptions.regions.length > 0 ? doOptions.regions : FALLBACK_REGIONS;
  const sizeOptions = filterByRegion(doOptions.sizes, form.droplet.region);
  const imageOptions = filterByRegion(doOptions.images, form.droplet.region);
  const vpcOptions = filterByRegion(doOptions.vpcs, form.droplet.region);
  const volumeOptions = filterByRegion(doOptions.volumes, form.droplet.region);
  const selectedServer = useMemo(
    () => servers.find((server) => server.serverId === form.linkedServerId),
    [form.linkedServerId, servers]
  );
  const selectedCfAccount = useMemo(
    () => cfAccounts.find((account) => account.id === form.domain.cfAccountId),
    [cfAccounts, form.domain.cfAccountId]
  );
  const selectedCfZone = useMemo(
    () => cfZones.find((zone) => zone.id === form.domain.zoneId),
    [cfZones, form.domain.zoneId]
  );

  useEffect(() => {
    void loadBaseData();
  }, []);

  useEffect(() => {
    if (form.droplet.tokenId) void loadDoOptions(form.droplet.tokenId);
  }, [form.droplet.tokenId]);

  useEffect(() => {
    if (form.domain.cfAccountId) {
      void loadCfZones(form.domain.cfAccountId);
    } else {
      setCfZones([]);
      setCfRecords([]);
    }
  }, [form.domain.cfAccountId]);

  useEffect(() => {
    if (form.domain.cfAccountId && form.domain.zoneId) {
      void loadCfRecords(form.domain.cfAccountId, form.domain.zoneId);
    } else {
      setCfRecords([]);
    }
  }, [form.domain.cfAccountId, form.domain.zoneId]);

  async function loadBaseData() {
    setLoading(true);
    try {
      const [configResponse, serversResponse] = await Promise.all([
        fetch('/api/admin/rotate-config', { cache: 'no-store' }),
        fetch('/api/admin/servers', { cache: 'no-store' }),
      ]);
      const configData = await readApiJson(configResponse);
      const serversData = await readApiJson(serversResponse);

      const loadedTokens = Array.isArray(configData?.data?.config?.doTokens)
        ? configData.data.config.doTokens.filter((token: DoToken) => token.token && token.enabled !== false)
        : [];
      setTokens(loadedTokens);

      const config = configData?.data?.config || {};
      const loadedCfAccounts: CfAccount[] = Array.isArray(config.cfAccounts) && config.cfAccounts.length > 0
        ? config.cfAccounts
            .filter((account: CfAccount) => account.token && account.enabled !== false)
            .map((account: CfAccount, index: number) => ({
              id: String(account.id || `cf-account-${index + 1}`),
              label: String(account.label || `Cloudflare ${index + 1}`),
              email: String(account.email || ''),
              enabled: account.enabled !== false,
            }))
        : config.cfToken
          ? [{
              id: 'cf-account-1',
              label: 'Cloudflare 1',
              email: String(config.cfEmail || ''),
              enabled: true,
            }]
          : [];
      setCfAccounts(loadedCfAccounts);

      if (loadedTokens[0]?.id) {
        setForm((current) => ({
          ...current,
          droplet: { ...current.droplet, tokenId: loadedTokens[0].id },
        }));
      }

      if (serversData?.success && Array.isArray(serversData?.data?.servers)) {
        setServers(serversData.data.servers.map((server: any) => ({
          serverId: String(server.serverId || ''),
          name: String(server.name || server.serverId || ''),
          domain: String(server.domain || ''),
          url: String(server.url || ''),
        })).filter((server: VpnServerOption) => server.serverId));
      }

      setForm((current) => ({
        ...current,
        domain: {
          ...current.domain,
          cfAccountId: current.domain.cfAccountId || loadedCfAccounts[0]?.id || '',
        },
        droplet: {
          ...current.droplet,
          region: config.dropletRegion || current.droplet.region,
          size: config.dropletSize || current.droplet.size,
          image: config.dropletImage || current.droplet.image,
        },
        panel: {
          ...current.panel,
          username: config.xuiUsername || current.panel.username,
          password: config.xuiPassword || current.panel.password,
          enable2FA: !!config.enable2FA,
        },
      }));
    } catch {
      toast.error('Failed to load deploy options');
    } finally {
      setLoading(false);
    }
  }

  async function loadDoOptions(tokenId: string) {
    setDoLoading(true);
    try {
      const response = await fetch(`/api/admin/rotate-config/do-options?tokenId=${encodeURIComponent(tokenId)}`, {
        cache: 'no-store',
      });
      const data = await readApiJson(response);
      if (data?.success && data?.data) {
        setDoOptions({
          regions: data.data.regions || [],
          sizes: data.data.sizes || [],
          images: data.data.images || [],
          sshKeys: data.data.sshKeys || [],
          vpcs: data.data.vpcs || [],
          volumes: data.data.volumes || [],
        });
      }
    } catch {
      toast.error('Failed to load DigitalOcean choices');
    } finally {
      setDoLoading(false);
    }
  }

  async function loadCfZones(accountId: string, silent = true) {
    setCfZonesLoading(true);
    try {
      const response = await fetch(`/api/admin/cloudflare-dns?accountId=${encodeURIComponent(accountId)}`, {
        cache: 'no-store',
      });
      const data = await readApiJson(response);
      if (data?.success && Array.isArray(data?.data?.zones)) {
        const zones = data.data.zones as CfZone[];
        setCfZones(zones);
        setForm((current) => {
          if (current.domain.cfAccountId !== accountId) return current;
          if (current.domain.zoneId && zones.some((zone) => zone.id === current.domain.zoneId)) return current;
          const zone = zones[0];
          return {
            ...current,
            domain: {
              ...current.domain,
              zoneId: zone?.id || '',
              zoneName: zone?.name || current.domain.zoneName,
              dnsRecordId: '',
            },
          };
        });
        if (!silent) toast.success('Cloudflare zones refreshed');
      } else if (!silent) {
        toast.error(data?.error || 'Failed to load Cloudflare zones');
      }
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : 'Failed to load Cloudflare zones');
    } finally {
      setCfZonesLoading(false);
    }
  }

  async function loadCfRecords(accountId: string, zoneId: string, silent = true) {
    setCfRecordsLoading(true);
    try {
      const response = await fetch(`/api/admin/cloudflare-dns?accountId=${encodeURIComponent(accountId)}&zoneId=${encodeURIComponent(zoneId)}`, {
        cache: 'no-store',
      });
      const data = await readApiJson(response);
      if (data?.success && Array.isArray(data?.data?.records)) {
        setCfRecords(data.data.records as CfDnsRecord[]);
        if (!silent) toast.success('DNS records refreshed');
      } else if (!silent) {
        toast.error(data?.error || 'Failed to load DNS records');
      }
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : 'Failed to load DNS records');
    } finally {
      setCfRecordsLoading(false);
    }
  }

  function updateRoot(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const target = event.target;
    const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;
    setForm((current) => ({ ...current, [target.name]: value }));
  }

  function updateDomain(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const target = event.target;
    const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;
    setForm((current) => ({ ...current, domain: { ...current.domain, [target.name]: value } }));
    if (target.name === 'hostname') {
      setRecordDraft((current) => current.recordId ? current : { ...current, name: String(value) });
    }
    if (target.name === 'content') {
      setRecordDraft((current) => current.recordId ? current : { ...current, content: String(value) });
    }
    if (target.name === 'ttl') {
      setRecordDraft((current) => current.recordId ? current : { ...current, ttl: String(value) });
    }
  }

  function updateDroplet(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const target = event.target;
    const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;
    setForm((current) => ({ ...current, droplet: { ...current.droplet, [target.name]: value } }));
  }

  function updatePanel(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const target = event.target;
    const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;
    setForm((current) => ({ ...current, panel: { ...current.panel, [target.name]: value } }));
  }

  function updateRecordDraft(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const target = event.target;
    const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;
    setRecordDraft((current) => ({ ...current, [target.name]: value }));
  }

  function changeCfAccount(accountId: string) {
    setRecordDraft(EMPTY_RECORD_DRAFT);
    setForm((current) => ({
      ...current,
      domain: {
        ...current.domain,
        cfAccountId: accountId,
        zoneId: '',
        zoneName: '',
        dnsRecordId: '',
      },
    }));
  }

  function changeCfZone(zoneId: string) {
    const zone = cfZones.find((item) => item.id === zoneId);
    setRecordDraft(EMPTY_RECORD_DRAFT);
    setForm((current) => ({
      ...current,
      domain: {
        ...current.domain,
        zoneId,
        zoneName: zone?.name || current.domain.zoneName,
        dnsRecordId: '',
      },
    }));
  }

  function newDnsRecordDraft() {
    setRecordDraft({
      ...EMPTY_RECORD_DRAFT,
      name: form.domain.hostname,
      content: form.domain.content || form.droplet.publicIp,
      ttl: form.domain.ttl || '60',
      proxied: form.domain.proxied,
    });
    setForm((current) => ({ ...current, domain: { ...current.domain, dnsRecordId: '' } }));
  }

  function selectDnsRecord(record: CfDnsRecord) {
    setRecordDraft({
      recordId: record.id,
      type: record.type || 'A',
      name: record.name || '',
      content: record.content || '',
      ttl: String(record.ttl || 60),
      proxied: !!record.proxied,
      priority: record.priority == null ? '' : String(record.priority),
    });
    setForm((current) => ({
      ...current,
      domain: {
        ...current.domain,
        zoneName: selectedCfZone?.name || current.domain.zoneName,
        hostname: record.name || current.domain.hostname,
        content: record.content || current.domain.content,
        dnsRecordId: record.id,
        proxied: !!record.proxied,
        ttl: String(record.ttl || 60),
      },
    }));
  }

  async function saveDnsRecord() {
    const accountId = form.domain.cfAccountId;
    const zoneId = form.domain.zoneId;
    const name = (recordDraft.name || form.domain.hostname).trim();
    const content = (recordDraft.content || form.domain.content || form.droplet.publicIp).trim();

    if (!accountId || !zoneId || !name || !content) {
      toast.error('Cloudflare token, zone, record name, and content are required');
      return;
    }

    setCfSaving(true);
    try {
      const payload = {
        accountId,
        zoneId,
        recordId: recordDraft.recordId,
        type: recordDraft.type || 'A',
        name,
        content,
        ttl: Number(recordDraft.ttl || form.domain.ttl) || 60,
        proxied: recordDraft.proxied,
        priority: recordDraft.priority ? Number(recordDraft.priority) : undefined,
      };
      const response = await fetch('/api/admin/cloudflare-dns', {
        method: recordDraft.recordId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await readApiJson(response);
      if (data?.success && data?.data?.record) {
        const record = data.data.record as CfDnsRecord;
        toast.success(recordDraft.recordId ? 'DNS record updated' : 'DNS record created');
        selectDnsRecord(record);
        await loadCfRecords(accountId, zoneId);
      } else {
        toast.error(data?.error || 'Failed to save DNS record');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save DNS record');
    } finally {
      setCfSaving(false);
    }
  }

  async function deleteDnsRecord(record: CfDnsRecord) {
    if (!window.confirm(`Delete DNS record "${record.name}"?`)) return;

    setCfSaving(true);
    try {
      const query = new URLSearchParams({
        accountId: form.domain.cfAccountId,
        zoneId: form.domain.zoneId,
        recordId: record.id,
        name: record.name,
      });
      const response = await fetch(`/api/admin/cloudflare-dns?${query.toString()}`, {
        method: 'DELETE',
      });
      const data = await readApiJson(response);
      if (data?.success) {
        toast.success('DNS record deleted');
        if (form.domain.dnsRecordId === record.id) {
          setForm((current) => ({ ...current, domain: { ...current.domain, dnsRecordId: '', content: '' } }));
          setRecordDraft(EMPTY_RECORD_DRAFT);
        }
        await loadCfRecords(form.domain.cfAccountId, form.domain.zoneId);
      } else {
        toast.error(data?.error || 'Failed to delete DNS record');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete DNS record');
    } finally {
      setCfSaving(false);
    }
  }

  function applyLinkedServer(serverId: string) {
    const server = servers.find((item) => item.serverId === serverId);
    setForm((current) => ({
      ...current,
      linkedServerId: serverId,
      domain: {
        ...current.domain,
        hostname: server?.domain || current.domain.hostname,
      },
      droplet: {
        ...current.droplet,
        dropletName: server?.serverId || current.droplet.dropletName,
      },
    }));
  }

  function autoFillIds() {
    const base = slugify(form.serviceId || form.domain.hostname.split('.')[0] || form.customerName);
    if (!base) return;
    setForm((current) => ({
      ...current,
      serviceId: current.serviceId || base,
      droplet: {
        ...current.droplet,
        dropletName: current.droplet.dropletName || base,
      },
    }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    autoFillIds();

    const serviceId = slugify(form.serviceId || form.domain.hostname.split('.')[0] || form.customerName);
    const dropletName = slugify(form.droplet.dropletName || serviceId);
    if (!serviceId || !form.customerName.trim() || !form.domain.hostname.trim() || !form.panel.password.trim()) {
      toast.error('Service ID, customer, domain, and panel password are required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        serviceId,
        customerName: form.customerName,
        customerType: form.customerType,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        notes: form.notes,
        actionMode: form.actionMode,
        linkedServerId: form.linkedServerId,
        domain: {
          cfAccountId: form.domain.cfAccountId,
          zoneId: form.domain.zoneId,
          zoneName: form.domain.zoneName,
          hostname: form.domain.hostname,
          content: form.domain.content,
          dnsRecordId: form.domain.dnsRecordId,
          proxied: form.domain.proxied,
          ttl: Number(form.domain.ttl) || 60,
        },
        droplet: {
          tokenId: form.droplet.tokenId,
          dropletLimit: Number(form.droplet.dropletLimit) || 3,
          dropletName,
          dropletId: form.droplet.dropletId,
          publicIp: form.droplet.publicIp,
          region: form.droplet.region,
          size: form.droplet.size,
          image: form.droplet.image,
          backups: form.droplet.backups,
          ipv6: form.droplet.ipv6,
          monitoring: form.droplet.monitoring,
          publicNetworking: form.droplet.publicNetworking,
          dropletAgent: form.droplet.dropletAgent,
          sshKeys: splitCsv(form.droplet.sshKeys),
          vpcUuid: form.droplet.vpcUuid,
          volumes: splitCsv(form.droplet.volumes),
          tags: splitCsv(form.droplet.tags),
          userData: form.droplet.userData,
          existingDropletId: form.droplet.existingDropletId,
          replaceOldDroplet: form.actionMode === 'replace_existing',
        },
        panel: {
          username: form.panel.username,
          password: form.panel.password,
          enable2FA: form.panel.enable2FA,
          panelPath: form.panel.panelPath,
          panelPort: Number(form.panel.panelPort) || 2053,
          subPort: Number(form.panel.subPort) || 2096,
          protocolPorts: {
            vless: Number(form.panel.vlessPort) || 443,
            trojan: Number(form.panel.trojanPort) || 2083,
            vmess: Number(form.panel.vmessPort) || 2087,
            shadowsocks: Number(form.panel.shadowsocksPort) || 8443,
          },
          ufwAllowPorts: splitCsv(form.panel.ufwAllowPorts).map((port) => Number(port)).filter(Boolean),
        },
      };

      const response = await fetch('/api/admin/private-servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await readApiJson(response);

      if (data?.success) {
        toast.success('Deploy draft saved');
        router.push('/admin/private-servers');
      } else {
        toast.error(data?.error || 'Failed to save deploy draft');
      }
    } catch {
      toast.error('Failed to save deploy draft');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-sky-300" />
        Loading deploy setup...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/admin/private-servers" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Private servers
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-white">Deploy Private VPN Server</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Save a deployment draft that links customer, domain, droplet, and 3xUI panel setup before running cloud actions.
          </p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save deploy draft
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <Section title="Service intent" icon={ShieldCheck}>
            <div className="grid gap-4 lg:grid-cols-3">
              <Field label="Service ID" name="serviceId" value={form.serviceId} onChange={updateRoot} onBlur={autoFillIds} placeholder="family-a or company-x" />
              <Field label="Customer name" name="customerName" value={form.customerName} onChange={updateRoot} onBlur={autoFillIds} required />
              <Select
                label="Customer type"
                name="customerType"
                value={form.customerType}
                onChange={updateRoot}
                options={[
                  { value: 'family', label: 'Family' },
                  { value: 'company', label: 'Company' },
                  { value: 'internal', label: 'Internal' },
                ]}
              />
              <Field label="Contact name" name="contactName" value={form.contactName} onChange={updateRoot} />
              <Field label="Contact email" name="contactEmail" value={form.contactEmail} onChange={updateRoot} type="email" />
              <Select
                label="Action mode"
                name="actionMode"
                value={form.actionMode}
                onChange={updateRoot}
                options={[
                  { value: 'create_new', label: 'New droplet + domain' },
                  { value: 'attach_existing', label: 'Existing droplet + domain' },
                  { value: 'replace_existing', label: 'Delete old + replace' },
                ]}
              />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Select
                label="Link existing panel record"
                name="linkedServerId"
                value={form.linkedServerId}
                onChange={(event) => applyLinkedServer(event.target.value)}
                options={[
                  { value: '', label: 'No linked panel yet' },
                  ...servers.map((server) => ({ value: server.serverId, label: `${server.name} (${server.serverId})` })),
                ]}
              />
              <label className="block">
                <span className="text-sm text-slate-300">Notes</span>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={updateRoot}
                  rows={3}
                  className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
                />
              </label>
            </div>
          </Section>

          <Section title="Cloudflare domain" icon={Globe}>
            <div className="grid gap-4 lg:grid-cols-3">
              <Select
                label="CF token"
                name="cfAccountId"
                value={form.domain.cfAccountId}
                onChange={(event) => changeCfAccount(event.target.value)}
                options={cfAccounts.length > 0
                  ? cfAccounts.map((account) => ({
                      value: account.id,
                      label: account.label || account.id,
                      description: account.email || 'API token',
                    }))
                  : [{ value: '', label: 'No Cloudflare token saved' }]}
              />
              <Select
                label="Zone"
                name="zoneId"
                value={form.domain.zoneId}
                onChange={(event) => changeCfZone(event.target.value)}
                options={cfZones.length > 0
                  ? cfZones.map((zone) => ({ value: zone.id, label: zone.name, description: zone.status || 'zone' }))
                  : [{ value: '', label: cfZonesLoading ? 'Loading zones...' : 'No zone loaded' }]}
              />
              <Field label="Hostname" name="hostname" value={form.domain.hostname} onChange={updateDomain} onBlur={autoFillIds} placeholder="vpn.example.com" required />
              <Field label="Record content / IP" name="content" value={form.domain.content} onChange={updateDomain} placeholder={form.droplet.publicIp || '203.0.113.10'} />
              <Field label="TTL" name="ttl" value={form.domain.ttl} onChange={updateDomain} type="number" />
              <Toggle
                label="Orange cloud"
                checked={form.domain.proxied}
                onChange={(checked) => {
                  setForm((current) => ({ ...current, domain: { ...current.domain, proxied: checked } }));
                  setRecordDraft((current) => current.recordId ? current : { ...current, proxied: checked });
                }}
              />
            </div>

            <div className="mt-4 rounded-lg border border-white/10 bg-slate-950/45 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">DNS record editor</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedCfAccount ? `${selectedCfAccount.label} / ${selectedCfZone?.name || 'choose zone'}` : 'Save a Cloudflare token first'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => form.domain.cfAccountId && void loadCfZones(form.domain.cfAccountId, false)}
                    disabled={!form.domain.cfAccountId || cfZonesLoading}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${cfZonesLoading ? 'animate-spin' : ''}`} />
                    Zones
                  </button>
                  <button
                    type="button"
                    onClick={newDnsRecordDraft}
                    className="inline-flex items-center gap-2 rounded-lg border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-sky-400/20"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[0.7fr_1.4fr_1.4fr_0.7fr]">
                <Select
                  label="Type"
                  name="type"
                  value={recordDraft.type}
                  onChange={updateRecordDraft}
                  options={[
                    { value: 'A', label: 'A' },
                    { value: 'AAAA', label: 'AAAA' },
                    { value: 'CNAME', label: 'CNAME' },
                    { value: 'TXT', label: 'TXT' },
                    { value: 'MX', label: 'MX' },
                  ]}
                />
                <Field label="Record name" name="name" value={recordDraft.name} onChange={updateRecordDraft} placeholder={form.domain.hostname || 'vpn.example.com'} />
                <Field label="Content" name="content" value={recordDraft.content} onChange={updateRecordDraft} placeholder={form.domain.content || form.droplet.publicIp || '203.0.113.10'} />
                <Field label="TTL" name="ttl" value={recordDraft.ttl} onChange={updateRecordDraft} type="number" />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Field label="MX priority" name="priority" value={recordDraft.priority} onChange={updateRecordDraft} type="number" />
                <Toggle label="Proxied" checked={recordDraft.proxied} onChange={(checked) => setRecordDraft((current) => ({ ...current, proxied: checked }))} />
                <button
                  type="button"
                  onClick={() => void saveDnsRecord()}
                  disabled={cfSaving || !form.domain.cfAccountId || !form.domain.zoneId}
                  className="inline-flex h-full min-h-12 items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cfSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {recordDraft.recordId ? 'Update record' : 'Create record'}
                </button>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-200">Records</p>
                <button
                  type="button"
                  onClick={() => form.domain.cfAccountId && form.domain.zoneId && void loadCfRecords(form.domain.cfAccountId, form.domain.zoneId, false)}
                  disabled={!form.domain.cfAccountId || !form.domain.zoneId || cfRecordsLoading}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${cfRecordsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
              {cfRecordsLoading ? (
                <div className="rounded-lg border border-white/10 bg-slate-950/40 px-4 py-4 text-sm text-slate-400">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-sky-300" />
                  Loading DNS records...
                </div>
              ) : cfRecords.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 bg-slate-950/40 px-4 py-5 text-sm text-slate-500">
                  No DNS records loaded for this token and zone.
                </div>
              ) : (
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {cfRecords.map((record) => (
                    <div key={record.id} className="flex flex-col gap-3 rounded-lg border border-white/10 bg-slate-950/40 p-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md border border-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-300">{record.type}</span>
                          <p className="truncate text-sm font-semibold text-white">{record.name}</p>
                          {record.proxied ? (
                            <span className="rounded-md border border-orange-400/20 bg-orange-400/10 px-2 py-0.5 text-[10px] font-semibold text-orange-200">Orange</span>
                          ) : (
                            <span className="rounded-md border border-slate-400/20 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-300">DNS only</span>
                          )}
                        </div>
                        <p className="mt-1 truncate font-mono text-xs text-slate-400">{record.content}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => selectDnsRecord(record)}
                          className="inline-flex items-center gap-2 rounded-lg border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-sky-400/20"
                        >
                          <Server className="h-3.5 w-3.5" />
                          Use
                        </button>
                        <button
                          type="button"
                          onClick={() => selectDnsRecord(record)}
                          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteDnsRecord(record)}
                          disabled={cfSaving}
                          className="inline-flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>

          <Section
            title="DigitalOcean droplet"
            icon={Cloud}
            action={doLoading ? <span className="inline-flex items-center text-xs text-sky-200"><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Loading DO choices</span> : null}
          >
            <div className="grid gap-4 lg:grid-cols-3">
              <Select
                label="DO token"
                name="tokenId"
                value={form.droplet.tokenId}
                onChange={updateDroplet}
                options={tokens.length > 0
                  ? tokens.map((token) => ({ value: token.id, label: token.label || token.id }))
                  : [{ value: '', label: 'No token saved' }]}
              />
              <Field label="Droplet limit" name="dropletLimit" value={form.droplet.dropletLimit} onChange={updateDroplet} type="number" />
              <Field label="Droplet name" name="dropletName" value={form.droplet.dropletName} onChange={updateDroplet} placeholder="family-a" required />
              {(form.actionMode === 'attach_existing' || form.actionMode === 'replace_existing') ? (
                <>
                  <Field label="Existing droplet ID" name="existingDropletId" value={form.droplet.existingDropletId} onChange={updateDroplet} />
                  <Field label="Existing public IP" name="publicIp" value={form.droplet.publicIp} onChange={updateDroplet} />
                </>
              ) : null}
              <Select label="Region" name="region" value={form.droplet.region} onChange={updateDroplet} options={regionOptions} />
              <Select label="Size" name="size" value={form.droplet.size} onChange={updateDroplet} options={sizeOptions.length > 0 ? sizeOptions : FALLBACK_SIZES} />
              <Select label="Image" name="image" value={form.droplet.image} onChange={updateDroplet} options={imageOptions.length > 0 ? imageOptions : FALLBACK_IMAGES} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Toggle label="Backups" checked={form.droplet.backups} onChange={(checked) => setForm((current) => ({ ...current, droplet: { ...current.droplet, backups: checked } }))} />
              <Toggle label="IPv6" checked={form.droplet.ipv6} onChange={(checked) => setForm((current) => ({ ...current, droplet: { ...current.droplet, ipv6: checked } }))} />
              <Toggle label="Monitoring" checked={form.droplet.monitoring} onChange={(checked) => setForm((current) => ({ ...current, droplet: { ...current.droplet, monitoring: checked } }))} />
              <Toggle label="Public network" checked={form.droplet.publicNetworking} onChange={(checked) => setForm((current) => ({ ...current, droplet: { ...current.droplet, publicNetworking: checked } }))} />
              <Toggle label="DO agent" checked={form.droplet.dropletAgent} onChange={(checked) => setForm((current) => ({ ...current, droplet: { ...current.droplet, dropletAgent: checked } }))} />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <Select
                label="VPC"
                name="vpcUuid"
                value={form.droplet.vpcUuid}
                onChange={updateDroplet}
                options={[{ value: '', label: 'Default VPC' }, ...vpcOptions]}
              />
              <Select
                label="Volumes"
                name="volumes"
                value={form.droplet.volumes}
                onChange={updateDroplet}
                options={[{ value: '', label: 'No volume' }, ...volumeOptions]}
              />
              <Field label="Tags" name="tags" value={form.droplet.tags} onChange={updateDroplet} />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Field label="SSH keys" name="sshKeys" value={form.droplet.sshKeys} onChange={updateDroplet} placeholder="key id, key fingerprint" />
              <label className="block">
                <span className="text-sm text-slate-300">Extra cloud-init</span>
                <textarea
                  name="userData"
                  value={form.droplet.userData}
                  onChange={updateDroplet}
                  rows={3}
                  className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
                />
              </label>
            </div>
          </Section>

          <Section title="3xUI panel profile" icon={Terminal}>
            <div className="grid gap-4 lg:grid-cols-4">
              <Field label="Username" name="username" value={form.panel.username} onChange={updatePanel} />
              <Field label="Password" name="password" value={form.panel.password} onChange={updatePanel} type="password" required />
              <Field label="Panel path" name="panelPath" value={form.panel.panelPath} onChange={updatePanel} />
              <Toggle label="2FA" checked={form.panel.enable2FA} onChange={(checked) => setForm((current) => ({ ...current, panel: { ...current.panel, enable2FA: checked } }))} />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <Field label="Panel port" name="panelPort" value={form.panel.panelPort} onChange={updatePanel} type="number" />
              <Field label="Sub link port" name="subPort" value={form.panel.subPort} onChange={updatePanel} type="number" />
              <Field label="UFW allow ports" name="ufwAllowPorts" value={form.panel.ufwAllowPorts} onChange={updatePanel} />
              <Field label="VLESS port" name="vlessPort" value={form.panel.vlessPort} onChange={updatePanel} type="number" />
              <Field label="Trojan port" name="trojanPort" value={form.panel.trojanPort} onChange={updatePanel} type="number" />
              <Field label="VMess port" name="vmessPort" value={form.panel.vmessPort} onChange={updatePanel} type="number" />
              <Field label="Shadowsocks port" name="shadowsocksPort" value={form.panel.shadowsocksPort} onChange={updatePanel} type="number" />
            </div>
          </Section>
        </div>

        <aside className="space-y-4">
          <Section title="Draft summary" icon={Network}>
            <div className="space-y-3 text-sm">
              <SummaryRow label="Mode" value={form.actionMode.replace('_', ' ')} />
              <SummaryRow label="Customer" value={form.customerName || 'not set'} />
              <SummaryRow label="Domain" value={form.domain.hostname || 'not set'} />
              <SummaryRow label="CF token" value={selectedCfAccount?.label || 'not set'} />
              <SummaryRow label="Zone" value={selectedCfZone?.name || form.domain.zoneName || 'not set'} />
              <SummaryRow label="DNS" value={form.domain.proxied ? 'orange cloud' : 'DNS only'} />
              <SummaryRow label="Record" value={form.domain.dnsRecordId ? 'linked' : 'not linked'} />
              <SummaryRow label="Droplet" value={`${form.droplet.region} / ${form.droplet.size}`} />
              <SummaryRow label="Panel" value={`${form.panel.panelPort}, sub ${form.panel.subPort}`} />
              <SummaryRow label="Linked" value={selectedServer ? selectedServer.serverId : 'not linked'} />
            </div>
            <div className="mt-5 rounded-lg border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-xs leading-5 text-amber-100">
              This saves a controlled deployment draft only. It does not create, delete, or modify cloud resources yet.
            </div>
          </Section>

          <Section title="Default ports" icon={HardDrive}>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Port label="Panel" value={form.panel.panelPort} />
              <Port label="Sub" value={form.panel.subPort} />
              <Port label="VLESS" value={form.panel.vlessPort} />
              <Port label="Trojan" value={form.panel.trojanPort} />
              <Port label="VMess" value={form.panel.vmessPort} />
              <Port label="SS" value={form.panel.shadowsocksPort} />
            </div>
          </Section>
        </aside>
      </div>
    </form>
  );
}

function Section({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon: any;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-400/20 bg-sky-400/10 text-sky-200">
            <Icon className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  onBlur,
  type = 'text',
  placeholder,
  required = false,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm text-slate-300">{label}</span>
      <input
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        type={type}
        placeholder={placeholder}
        required={required}
        className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
      />
    </label>
  );
}

function Select({
  label,
  name,
  value,
  onChange,
  options,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  options: DoOption[];
}) {
  return (
    <label className="block">
      <span className="text-sm text-slate-300">{label}</span>
      <select
        name={name}
        value={value}
        onChange={onChange}
        className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
      >
        {options.map((option) => (
          <option key={`${name}-${option.value}`} value={option.value}>
            {option.description ? `${option.label} - ${option.description}` : option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex h-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-200">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-sky-500 focus:ring-sky-500"
      />
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3 last:border-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-100">{value}</span>
    </div>
  );
}

function Port({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <div className="text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-slate-100">{value}</div>
    </div>
  );
}
