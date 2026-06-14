'use client';

import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import {
	Check,
	CheckCircle2,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Clock3,
	Cloud,
	Copy,
	Database,
	Edit3,
	Globe,
	HardDrive,
	History,
	KeyRound,
	Link2,
	Loader2,
	Network,
	PanelTop,
	Plus,
	PlayCircle,
	RefreshCw,
	Save,
	Server,
	Settings,
	ShieldCheck,
	Terminal,
	Trash2,
	XCircle,
} from 'lucide-react';

type RotateConfig = {
	doToken1: string;
	doToken2: string;
	doToken3: string;
	doToken4: string;
	doTokens?: RotateTokenRow[];
	serverLinks?: RotateServerLinkRow[];
	cfAccounts?: RotateCfAccountRow[];
	cfToken: string;
	cfEmail: string;
	xuiUsername: string;
	xuiPassword: string;
	enable2FA: boolean;
	dropletRegion: string;
	dropletSize: string;
	dropletImage: string;
	dropletBackups: boolean;
	dropletIpv6: boolean;
	dropletMonitoring: boolean;
	dropletPublicNetworking: boolean;
	dropletAgent: boolean;
	dropletSshKeys: string;
	dropletTags: string;
	dropletVpcUuid: string;
	dropletVolumes: string;
	dropletUserData: string;
	dropletBackupPolicy: string;
};

type StepResult = {
	status: 'loading' | 'success' | 'error';
	message?: string;
	newIp?: string;
	jobId?: string;
};

type RotateTokenRow = {
	id: string;
	label: string;
	token: string;
	enabled: boolean;
};

type RotateCfAccountRow = {
	id: string;
	label: string;
	token: string;
	email: string;
	enabled: boolean;
};

type RotateServerLinkRow = {
	id: string;
	serverName: string;
	tokenId: string;
	enabled: boolean;
};

type ServerPickerOption = {
	value: string;
	label: string;
	resolvedIp?: string | null;
	dropletCreatedAt?: string | null;
	updatedAt?: string | null;
	domain?: string;
	enabled?: boolean;
	badge?: string;
};

type DoAccountInfo = {
	id: string;
	label: string;
	email: string;
	status: string;
	dropletLimit: number;
	floatingIpLimit: number;
	volumeLimit: number;
	balance: string | number;
	monthToDateCharges: string;
	error?: string;
};

type DoSelectOption = {
	value: string;
	label: string;
	description?: string;
	available?: boolean;
	regions?: string[];
	region?: string;
};

type DoOptions = {
	regions: DoSelectOption[];
	sizes: DoSelectOption[];
	images: DoSelectOption[];
	sshKeys: DoSelectOption[];
	vpcs: DoSelectOption[];
	volumes: DoSelectOption[];
	accounts?: DoAccountInfo[];
	errors?: string[];
};

type PanelServerRow = {
	serverId: string;
	name: string;
	flag: string;
	url: string;
	panelPath: string;
	apiKey?: string;
	domain: string;
	subPort: number;
	protocol: string;
	enabledProtocols?: string[];
	enabled: boolean;
	badge?: string;
	notes?: string;
	resolvedIp?: string | null;
	updatedAt?: string | null;
};

type PanelDraft = {
	serverId: string;
	name: string;
	flag: string;
	url: string;
	panelPath: string;
	apiKey: string;
	domain: string;
	subPort: string;
	protocol: string;
	enabledProtocols: string;
	enabled: boolean;
	badge: string;
	notes: string;
};

type RotationHistoryRow = {
	id: string;
	action: string;
	actionLabel: string;
	serverId: string;
	status: 'running' | 'success' | 'error';
	message?: string;
	error?: string;
	oldIp?: string | null;
	newIp?: string | null;
	domain?: string | null;
	panel?: string | null;
	region?: string | null;
	size?: string | null;
	image?: string | null;
	startedAt?: string | null;
	updatedAt?: string | null;
};

type ConfigTab = 'servers' | 'digitalocean' | 'cloudflare' | 'panel' | 'history';

const STEPS = [
	{ id: 1, title: 'Config', icon: Settings },
	{ id: 2, title: 'Backup', icon: Database },
	{ id: 3, title: 'Recreate', icon: Server },
	{ id: 4, title: 'DNS', icon: Globe },
	{ id: 5, title: 'Panel', icon: Terminal },
] as const;

const SERVER_OPTIONS: ServerPickerOption[] = [
	{ value: 'jan', label: 'Jan Server (Account 1)', domain: 'jan.burmesedigital.store' },
	{ value: 'sg1', label: 'SG-1 Server (Account 1)', domain: 'sg1.burmesedigital.store' },
	{ value: 'sg2', label: 'SG-2 Server (Account 2)', domain: 'sg2.burmesedigital.store' },
	{ value: 'sg3', label: 'SG-3 Server (Account 2)', domain: 'sg3.burmesedigital.store' },
	{ value: 'sg4', label: 'SG-4 Server (Account 1 - NYC1)', domain: 'sg4.burmesedigital.store' },
	{ value: 'backup', label: 'Backup Server (Account 2)', domain: 'backup.burmesedigital.store' },
];

const SERVER_LABELS = Object.fromEntries(SERVER_OPTIONS.map((option) => [option.value, option.label]));

const DEFAULT_CONFIG: RotateConfig = {
	doToken1: '',
	doToken2: '',
	doToken3: '',
	doToken4: '',
	doTokens: [],
	serverLinks: [],
	cfAccounts: [],
	cfToken: '',
	cfEmail: 'blackcoder436@gmail.com',
	xuiUsername: 'Blackcoder',
	xuiPassword: 'Mka@2016',
	enable2FA: false,
	dropletRegion: 'sgp1',
	dropletSize: 's-1vcpu-1gb',
	dropletImage: 'ubuntu-22-04-x64',
	dropletBackups: false,
	dropletIpv6: false,
	dropletMonitoring: true,
	dropletPublicNetworking: true,
	dropletAgent: true,
	dropletSshKeys: '',
	dropletTags: 'vpn, rotate',
	dropletVpcUuid: '',
	dropletVolumes: '',
	dropletUserData: '',
	dropletBackupPolicy: '',
};

const CONFIG_TABS: Array<{ id: ConfigTab; label: string; icon: any }> = [
	{ id: 'servers', label: 'Servers', icon: Server },
	{ id: 'digitalocean', label: 'DigitalOcean', icon: Cloud },
	{ id: 'cloudflare', label: 'Cloudflare', icon: Globe },
	{ id: 'panel', label: '3xUI', icon: PanelTop },
	{ id: 'history', label: 'History', icon: History },
];

const EMPTY_DO_OPTIONS: DoOptions = {
	regions: [],
	sizes: [],
	images: [],
	sshKeys: [],
	vpcs: [],
	volumes: [],
	accounts: [],
	errors: [],
};

const EMPTY_PANEL_DRAFT: PanelDraft = {
	serverId: '',
	name: '',
	flag: 'SG',
	url: '',
	panelPath: '/mka',
	apiKey: '',
	domain: '',
	subPort: '2096',
	protocol: 'trojan',
	enabledProtocols: 'trojan, vless, vmess, shadowsocks',
	enabled: true,
	badge: '',
	notes: '',
};

const DROPLET_SIZE_OPTIONS = [
	{ value: 's-1vcpu-1gb', label: '$6.00/mo', description: '1 vCPU - 1 GB RAM - 25 GB SSD - 1000 GB Transfer' },
	{ value: 's-1vcpu-2gb', label: '$12.00/mo', description: '1 vCPU - 2 GB RAM - 50 GB SSD - 2 TB Transfer' },
	{ value: 's-2vcpu-2gb', label: '$18.00/mo', description: '2 vCPU - 2 GB RAM - 60 GB SSD - 3 TB Transfer' },
	{ value: 's-2vcpu-4gb', label: '$24.00/mo', description: '2 vCPU - 4 GB RAM - 80 GB SSD - 4 TB Transfer' },
	{ value: 's-4vcpu-8gb', label: '$48.00/mo', description: '4 vCPU - 8 GB RAM - 160 GB SSD - 5 TB Transfer' },
	{ value: 's-8vcpu-16gb', label: '$96.00/mo', description: '8 vCPU - 16 GB RAM - 320 GB SSD - 6 TB Transfer' },
] as const;

const DROPLET_REGION_OPTIONS = [
	{ value: 'sgp1', label: 'Singapore - SGP1', description: 'Default for SG panels' },
	{ value: 'nyc1', label: 'New York - NYC1', description: 'Legacy SG4 fallback' },
	{ value: 'nyc3', label: 'New York - NYC3' },
	{ value: 'sfo3', label: 'San Francisco - SFO3' },
	{ value: 'ams3', label: 'Amsterdam - AMS3' },
	{ value: 'fra1', label: 'Frankfurt - FRA1' },
	{ value: 'lon1', label: 'London - LON1' },
	{ value: 'tor1', label: 'Toronto - TOR1' },
	{ value: 'blr1', label: 'Bangalore - BLR1' },
] as const;

const DROPLET_IMAGE_OPTIONS = [
	{ value: 'ubuntu-24-04-x64', label: 'Ubuntu 24.04 x64' },
	{ value: 'ubuntu-22-04-x64', label: 'Ubuntu 22.04 x64' },
	{ value: 'ubuntu-20-04-x64', label: 'Ubuntu 20.04 x64' },
	{ value: 'debian-12-x64', label: 'Debian 12 x64' },
	{ value: 'debian-11-x64', label: 'Debian 11 x64' },
	{ value: 'almalinux-9-x64', label: 'AlmaLinux 9 x64' },
	{ value: 'rockylinux-9-x64', label: 'Rocky Linux 9 x64' },
	{ value: 'fedora-41-x64', label: 'Fedora 41 x64' },
] as const;

function createId(prefix: string) {
	return `${prefix}_${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10)}`;
}

function normalizeTokensFromConfig(config: Partial<RotateConfig>): RotateTokenRow[] {
	const arrayTokens = Array.isArray(config.doTokens) ? config.doTokens : [];
	if (arrayTokens.length > 0) {
		return arrayTokens.map((row, index) => ({
			id: row.id || createId(`do_token_${index + 1}`),
			label: row.label || `Token ${index + 1}`,
			token: row.token || '',
			enabled: row.enabled !== false,
		}));
	}

	const legacyTokens = [
		{ id: 'do_token_1', label: 'Token 1', token: config.doToken1 || '', enabled: true },
		{ id: 'do_token_2', label: 'Token 2', token: config.doToken2 || '', enabled: true },
		{ id: 'do_token_3', label: 'Token 3', token: config.doToken3 || '', enabled: true },
		{ id: 'do_token_4', label: 'Token 4', token: config.doToken4 || '', enabled: true },
	].filter((row) => row.token);

	if (legacyTokens.length > 0) {
		return legacyTokens;
	}

	return [
		{ id: 'do_token_1', label: 'Token 1', token: '', enabled: true },
		{ id: 'do_token_2', label: 'Token 2', token: '', enabled: true },
	];
}

function normalizeCfAccountsFromConfig(config: Partial<RotateConfig>): RotateCfAccountRow[] {
	const arrayAccounts = Array.isArray(config.cfAccounts) ? config.cfAccounts : [];
	if (arrayAccounts.length > 0) {
		return arrayAccounts.map((row, index) => ({
			id: row.id || createId(`cf_account_${index + 1}`),
			label: row.label || `Cloudflare ${index + 1}`,
			token: row.token || '',
			email: row.email || '',
			enabled: row.enabled !== false,
		}));
	}

	if (config.cfToken) {
		return [
			{
				id: 'cf_account_1',
				label: 'Cloudflare 1',
				token: config.cfToken || '',
				email: config.cfEmail || '',
				enabled: true,
			},
		];
	}

	return [
		{
			id: 'cf_account_1',
			label: 'Cloudflare 1',
			token: '',
			email: config.cfEmail || 'blackcoder436@gmail.com',
			enabled: true,
		},
	];
}

function normalizeServerLinksFromConfig(config: Partial<RotateConfig>): RotateServerLinkRow[] {
	const arrayLinks = Array.isArray(config.serverLinks) ? config.serverLinks : [];
	return arrayLinks.map((row, index) => ({
		id: row.id || createId(`server_link_${index + 1}`),
		serverName: row.serverName || '',
		tokenId: row.tokenId || '',
		enabled: row.enabled !== false,
	}));
}

async function readApiJson(response: Response) {
	const text = await response.text();
	if (!text) return {};

	try {
		return JSON.parse(text);
	} catch {
		const isHtml = /<!doctype|<html/i.test(text);
		const preview = text.replace(/\s+/g, ' ').slice(0, 180);
		throw new Error(
			`Server returned non-JSON response (HTTP ${response.status}). ${
				isHtml
					? 'This usually means the rotate request timed out or the server returned an HTML error page.'
					: 'The API response could not be parsed.'
			}${preview ? ` Preview: ${preview}` : ''}`
		);
	}
}

function getActionErrorMessage(error: unknown) {
	const message = error instanceof Error ? error.message : 'Network error occurred';

	if (/failed to fetch|networkerror|load failed/i.test(message)) {
		return 'Network request failed. If you are connected through the same VPN server being rotated, your browser connection likely dropped after the old VPS was deleted. Reconnect with another network/VPN, reload the page, then continue from DNS.';
	}

	return message;
}

function sleep(ms: number) {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function formatRelativeTime(value?: string | null) {
	if (!value) return 'unknown';

	let date: Date;
	
	// Handle both ISO strings and numeric timestamps
	if (typeof value === 'string') {
		date = new Date(value);
	} else if (typeof value === 'number') {
		date = new Date(value);
	} else {
		return 'unknown';
	}

	if (Number.isNaN(date.getTime())) return 'unknown';

	const now = Date.now();
	const diffMs = now - date.getTime();
	const diffSeconds = Math.round(diffMs / 1000);
	const absSeconds = Math.abs(diffSeconds);
	const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

	if (absSeconds < 60) return formatter.format(-Math.round(diffSeconds), 'second');
	if (absSeconds < 3600) return formatter.format(-Math.round(diffSeconds / 60), 'minute');
	if (absSeconds < 86400) return formatter.format(-Math.round(diffSeconds / 3600), 'hour');

	return formatter.format(-Math.round(diffSeconds / 86400), 'day');
}

function formatDateTimeShort(value?: string | null) {
	if (!value) return 'unknown';

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return 'unknown';

	return new Intl.DateTimeFormat('en-GB', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	}).format(date);
}

function normalizeKey(value?: string | null) {
	return String(value || '').trim().toLowerCase();
}

function splitCsv(value?: string | null) {
	return String(value || '')
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean);
}

function joinCsv(values: string[]) {
	return values.map((item) => item.trim()).filter(Boolean).join(', ');
}

function optionForCurrentValue(value: string, fallbackLabel = 'Custom value'): DoSelectOption[] {
	return value ? [{ value, label: value, description: fallbackLabel }] : [];
}

function filterByRegion(options: DoSelectOption[], region: string) {
	if (!region) return options;
	return options.filter((option) => {
		if (option.available === false) return false;
		if (option.region) return option.region === region;
		if (Array.isArray(option.regions) && option.regions.length > 0) return option.regions.includes(region);
		return true;
	});
}

function getPanelDraftFromServer(server: PanelServerRow): PanelDraft {
	return {
		serverId: server.serverId || '',
		name: server.name || '',
		flag: server.flag || 'SG',
		url: server.url || '',
		panelPath: server.panelPath || '/mka',
		apiKey: server.apiKey || '',
		domain: server.domain || '',
		subPort: String(server.subPort || 2096),
		protocol: server.protocol || 'trojan',
		enabledProtocols: joinCsv(server.enabledProtocols || ['trojan', 'vless', 'vmess', 'shadowsocks']),
		enabled: server.enabled !== false,
		badge: server.badge || '',
		notes: server.notes || '',
	};
}

function getStatusClass(status: RotationHistoryRow['status']) {
	if (status === 'success') return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200';
	if (status === 'running') return 'border-sky-400/30 bg-sky-400/10 text-sky-200';
	return 'border-red-400/30 bg-red-400/10 text-red-200';
}

async function copyText(value: string) {
	if (!value) return;

	try {
		if (navigator?.clipboard?.writeText) {
			await navigator.clipboard.writeText(value);
			toast.success('IP copied');
		} else {
			toast.error('Clipboard is not available');
		}
	} catch {
		toast.error('Failed to copy IP');
	}
}

export default function RotateWizardPage() {
	const [loading, setLoading] = useState(true);
	const [actionLoading, setActionLoading] = useState(false);
	const [currentStep, setCurrentStep] = useState(1);
	const [targetServer, setTargetServer] = useState('sg1');
	const [config, setConfig] = useState(DEFAULT_CONFIG);
	const [stepResults, setStepResults] = useState<Record<number, StepResult>>({});
	const [doTokens, setDoTokens] = useState<RotateTokenRow[]>(normalizeTokensFromConfig(DEFAULT_CONFIG));
	const [cfAccounts, setCfAccounts] = useState<RotateCfAccountRow[]>(normalizeCfAccountsFromConfig(DEFAULT_CONFIG));
	const [serverLinks, setServerLinks] = useState<RotateServerLinkRow[]>([]);
	const [serverOptions, setServerOptions] = useState<ServerPickerOption[]>(SERVER_OPTIONS);
	const [configTab, setConfigTab] = useState<ConfigTab>('servers');
	const [doOptions, setDoOptions] = useState<DoOptions>(EMPTY_DO_OPTIONS);
	const [doOptionsLoading, setDoOptionsLoading] = useState(false);
	const [doOptionsError, setDoOptionsError] = useState('');
	const [doAccounts, setDoAccounts] = useState<DoAccountInfo[]>([]);
	const [panelServers, setPanelServers] = useState<PanelServerRow[]>([]);
	const [panelDraft, setPanelDraft] = useState<PanelDraft>(EMPTY_PANEL_DRAFT);
	const [editingPanelId, setEditingPanelId] = useState('');
	const [showPanelForm, setShowPanelForm] = useState(false);
	const [panelSaving, setPanelSaving] = useState(false);
	const [history, setHistory] = useState<RotationHistoryRow[]>([]);
	const [historyLoading, setHistoryLoading] = useState(false);
	const availableTokens = doTokens.filter((row) => row.token);
	const selectedServerLabel = serverOptions.find((option) => option.value === targetServer)?.label || targetServer;
	const selectedServerOption = serverOptions.find((option) => option.value === targetServer);
	const linkedServerRow = serverLinks.find((row) => normalizeKey(row.serverName) === normalizeKey(targetServer) && row.enabled !== false);
	const linkedDoTokenLabel = (() => {
		if (!linkedServerRow?.tokenId) return null;

		const linkedToken = doTokens.find((row) => normalizeKey(row.id) === normalizeKey(linkedServerRow.tokenId));
		return linkedToken?.label || linkedServerRow.tokenId || null;
	})();
	const regionOptions = doOptions.regions.length > 0 ? doOptions.regions : [...DROPLET_REGION_OPTIONS];
	const sizeOptions = filterByRegion(doOptions.sizes, config.dropletRegion).length > 0
		? filterByRegion(doOptions.sizes, config.dropletRegion)
		: [...DROPLET_SIZE_OPTIONS];
	const imageOptions = filterByRegion(doOptions.images, config.dropletRegion).length > 0
		? filterByRegion(doOptions.images, config.dropletRegion)
		: [...DROPLET_IMAGE_OPTIONS];
	const vpcOptions = filterByRegion(doOptions.vpcs, config.dropletRegion);
	const volumeOptions = filterByRegion(doOptions.volumes, config.dropletRegion);
	const regionChoices = regionOptions.some((option) => option.value === config.dropletRegion)
		? regionOptions
		: [...optionForCurrentValue(config.dropletRegion, 'Saved region'), ...regionOptions];
	const sizeChoices = sizeOptions.some((option) => option.value === config.dropletSize)
		? sizeOptions
		: [...optionForCurrentValue(config.dropletSize, 'Saved size'), ...sizeOptions];
	const imageChoices = imageOptions.some((option) => option.value === config.dropletImage)
		? imageOptions
		: [...optionForCurrentValue(config.dropletImage, 'Saved image'), ...imageOptions];
	const vpcChoices = config.dropletVpcUuid && !vpcOptions.some((option) => option.value === config.dropletVpcUuid)
		? [{ value: '', label: 'Default VPC', description: 'DigitalOcean default' }, ...optionForCurrentValue(config.dropletVpcUuid, 'Saved VPC'), ...vpcOptions]
		: [{ value: '', label: 'Default VPC', description: 'DigitalOcean default' }, ...vpcOptions];

	useEffect(() => {
		let mounted = true;

		async function loadConfig() {
			try {
				const response = await fetch('/api/admin/rotate-config');
				const data = await readApiJson(response);

				if (mounted && data?.success && data?.data?.config) {
					const loadedConfig = { ...DEFAULT_CONFIG, ...data.data.config } as RotateConfig;
					setConfig(loadedConfig);
					setDoTokens(normalizeTokensFromConfig(loadedConfig));
					setCfAccounts(normalizeCfAccountsFromConfig(loadedConfig));
					setServerLinks(normalizeServerLinksFromConfig(loadedConfig));
				}
			} catch {
				toast.error('Unable to load rotation config');
			} finally {
				if (mounted) setLoading(false);
			}
		}

		void loadConfig();

		return () => {
			mounted = false;
		};
	}, []);

	useEffect(() => {
		let mounted = true;

		async function loadServers() {
			try {
				const response = await fetch('/api/admin/servers');
				const data = await readApiJson(response);

				if (mounted && data?.success && Array.isArray(data?.data?.servers) && data.data.servers.length > 0) {
					const panelRows: PanelServerRow[] = data.data.servers.map((server: any) => ({
						serverId: String(server.serverId || server.id || ''),
						name: String(server.name || server.serverId || 'Server'),
						flag: String(server.flag || 'SG'),
						url: String(server.url || ''),
						panelPath: String(server.panelPath || '/mka'),
						apiKey: String(server.apiKey || ''),
						domain: String(server.domain || ''),
						subPort: Number(server.subPort || 2096),
						protocol: String(server.protocol || 'trojan'),
						enabledProtocols: Array.isArray(server.enabledProtocols) ? server.enabledProtocols : ['trojan', 'vless', 'vmess', 'shadowsocks'],
						enabled: server.enabled !== false,
						badge: server.badge || '',
						notes: server.notes || '',
						resolvedIp: server.resolvedIp || null,
						updatedAt: server.updatedAt || null,
					})).filter((server: PanelServerRow) => server.serverId);
					const liveServers: ServerPickerOption[] = data.data.servers.map((server: any) => ({
						value: String(server.serverId || server.id || ''),
						label: String(SERVER_LABELS[String(server.serverId || server.id || '')] || server.name || server.serverId || 'Server'),
						resolvedIp: server.resolvedIp || null,
						updatedAt: server.updatedAt || null,
						domain: server.domain || '',
						enabled: server.enabled !== false,
						badge: server.badge || '',
					})).filter((server: ServerPickerOption) => server.value);

					if (liveServers.length > 0) {
						setPanelServers(panelRows);
						setServerOptions(liveServers);
						setTargetServer((current) =>
							liveServers.some((server) => server.value === current)
								? current
								: liveServers[0].value
						);
					}
				}
			} catch {
				// Keep the fallback list already shown on the page.
			}
		}

		void loadServers();

		return () => {
			mounted = false;
		};
	}, []);

	useEffect(() => {
		void loadDigitalOceanOptions(true);
	}, [targetServer, linkedDoTokenLabel, availableTokens.length]);

	useEffect(() => {
		void loadHistory(true);
	}, []);

	async function refreshServers() {
		const response = await fetch('/api/admin/servers');
		const data = await readApiJson(response);
		if (!data?.success || !Array.isArray(data?.data?.servers)) return;

		const panelRows: PanelServerRow[] = data.data.servers.map((server: any) => ({
			serverId: String(server.serverId || server.id || ''),
			name: String(server.name || server.serverId || 'Server'),
			flag: String(server.flag || 'SG'),
			url: String(server.url || ''),
			panelPath: String(server.panelPath || '/mka'),
			apiKey: String(server.apiKey || ''),
			domain: String(server.domain || ''),
			subPort: Number(server.subPort || 2096),
			protocol: String(server.protocol || 'trojan'),
			enabledProtocols: Array.isArray(server.enabledProtocols) ? server.enabledProtocols : ['trojan', 'vless', 'vmess', 'shadowsocks'],
			enabled: server.enabled !== false,
			badge: server.badge || '',
			notes: server.notes || '',
			resolvedIp: server.resolvedIp || null,
			updatedAt: server.updatedAt || null,
		})).filter((server: PanelServerRow) => server.serverId);
		const liveServers: ServerPickerOption[] = panelRows.map((server) => ({
			value: server.serverId,
			label: String(SERVER_LABELS[server.serverId] || server.name || server.serverId || 'Server'),
			resolvedIp: server.resolvedIp || null,
			dropletCreatedAt: server.dropletCreatedAt || null,
			dropletCreatedAt: server.dropletCreatedAt || null,
			updatedAt: server.updatedAt || null,
			domain: server.domain || '',
			enabled: server.enabled !== false,
			badge: server.badge || '',
		}));

		setPanelServers(panelRows);
		if (liveServers.length > 0) {
			setServerOptions(liveServers);
			setTargetServer((current) => liveServers.some((server) => server.value === current) ? current : liveServers[0].value);
		}
	}

	async function loadDigitalOceanOptions(silent = false) {
		if (availableTokens.length === 0) {
			setDoOptions(EMPTY_DO_OPTIONS);
			setDoOptionsError('Save at least one enabled DigitalOcean token to load live choices.');
			return;
		}

		setDoOptionsLoading(true);
		if (!silent) setDoOptionsError('');

		try {
			const response = await fetch(`/api/admin/rotate-config/do-options?serverId=${encodeURIComponent(targetServer)}`, {
				cache: 'no-store',
			});
			const data = await readApiJson(response);

			if (data?.success && data?.data) {
				setDoOptions({ ...EMPTY_DO_OPTIONS, ...data.data });
				setDoAccounts(Array.isArray(data.data.accounts) ? data.data.accounts : []);
				setDoOptionsError(Array.isArray(data.data.errors) && data.data.errors.length > 0 ? data.data.errors[0] : '');
				if (!silent) toast.success('DigitalOcean choices refreshed');
			} else {
				setDoOptionsError(data?.error || 'Unable to load DigitalOcean choices');
				if (!silent) toast.error(data?.error || 'Unable to load DigitalOcean choices');
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unable to load DigitalOcean choices';
			setDoOptionsError(message);
			if (!silent) toast.error(message);
		} finally {
			setDoOptionsLoading(false);
		}
	}

	async function loadHistory(silent = false) {
		setHistoryLoading(true);

		try {
			const response = await fetch('/api/admin/rotate-history?limit=30', { cache: 'no-store' });
			const data = await readApiJson(response);

			if (data?.success && Array.isArray(data?.data?.history)) {
				setHistory(data.data.history);
			} else if (!silent) {
				toast.error(data?.error || 'Unable to load rotation history');
			}
		} catch {
			if (!silent) toast.error('Unable to load rotation history');
		} finally {
			setHistoryLoading(false);
		}
	}

	function handleConfigChange(event: any) {
		const target = event.target;
		const name = target.name;
		const type = target.type;
		const checked = target.checked;
		const value = target.value;
		
		setConfig((current) => ({
			...current,
			[name]: type === 'checkbox' ? checked : value,
		} as RotateConfig));
	}

	function updateDoToken(index: number, field: keyof RotateTokenRow, value: string | boolean) {
		setDoTokens((current) => {
			const next = [...current];
			next[index] = { ...next[index], [field]: value } as RotateTokenRow;
			return next;
		});
	}

	function addDoTokenRow() {
		setDoTokens((current) => [
			...current,
			{ id: createId('do_token'), label: `Token ${current.length + 1}`, token: '', enabled: true },
		]);
	}

	function removeDoTokenRow(index: number) {
		setDoTokens((current) => {
			const next = current.filter((_, i) => i !== index);
			return next.length > 0
				? next.map((row, i) => ({ ...row, label: row.label || `Token ${i + 1}` }))
				: [
					{ id: 'do_token_1', label: 'Token 1', token: '', enabled: true },
					{ id: 'do_token_2', label: 'Token 2', token: '', enabled: true },
				];
		});
	}

	function updateCfAccount(index: number, field: keyof RotateCfAccountRow, value: string | boolean) {
		setCfAccounts((current) => {
			const next = [...current];
			next[index] = { ...next[index], [field]: value } as RotateCfAccountRow;
			return next;
		});
	}

	function addCfAccountRow() {
		setCfAccounts((current) => [
			...current,
			{ id: createId('cf_account'), label: `Cloudflare ${current.length + 1}`, token: '', email: '', enabled: true },
		]);
	}

	function removeCfAccountRow(index: number) {
		setCfAccounts((current) => {
			const next = current.filter((_, i) => i !== index);
			return next.length > 0
				? next.map((row, i) => ({ ...row, label: row.label || `Cloudflare ${i + 1}` }))
				: [{ id: 'cf_account_1', label: 'Cloudflare 1', token: '', email: config.cfEmail || '', enabled: true }];
		});
	}

	function addServerLinkRow() {
		setServerLinks((current) => [
			...current,
			{ id: createId('server_link'), serverName: '', tokenId: '', enabled: true },
		]);
	}

	function updateServerLink(index: number, field: keyof RotateServerLinkRow, value: string | boolean) {
		setServerLinks((current) => {
			const next = [...current];
			next[index] = { ...next[index], [field]: value } as RotateServerLinkRow;
			return next;
		});
	}

	function removeServerLinkRow(index: number) {
		setServerLinks((current) => current.filter((_, i) => i !== index));
	}

	function selectServerToken(linkIndex: number, tokenId: string, checked: boolean) {
		setServerLinks((current) => current.map((row, index) => ({
			...row,
			tokenId: index === linkIndex ? (checked ? tokenId : '') : row.tokenId,
		})));
	}

	function updateConfigCsv(name: keyof RotateConfig, value: string, checked: boolean) {
		setConfig((current) => {
			const values = new Set(splitCsv(String(current[name] || '')));
			if (checked) values.add(value);
			else values.delete(value);
			return { ...current, [name]: joinCsv(Array.from(values)) } as RotateConfig;
		});
	}

	function resetPanelDraft() {
		setEditingPanelId('');
		setPanelDraft(EMPTY_PANEL_DRAFT);
		setShowPanelForm(false);
	}

	function openPanelDraft() {
		setEditingPanelId('');
		setPanelDraft(EMPTY_PANEL_DRAFT);
		setShowPanelForm(true);
		setConfigTab('panel');
	}

	function editPanel(server: PanelServerRow) {
		setEditingPanelId(server.serverId);
		setPanelDraft(getPanelDraftFromServer(server));
		setShowPanelForm(true);
		setConfigTab('panel');
	}

	function handlePanelDraftChange(event: any) {
		const target = event.target;
		const name = target.name;
		const type = target.type;
		const checked = target.checked;
		const value = target.value;

		setPanelDraft((current) => ({
			...current,
			[name]: type === 'checkbox' ? checked : value,
		}));
	}

	async function handleSavePanel() {
		const serverId = panelDraft.serverId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
		if (!serverId || !panelDraft.name.trim() || !panelDraft.url.trim() || !panelDraft.domain.trim()) {
			toast.error('Panel server ID, name, URL, and domain are required');
			return;
		}

		setPanelSaving(true);
		try {
			const payload: any = {
				serverId: editingPanelId || serverId,
				name: panelDraft.name.trim(),
				flag: panelDraft.flag.trim() || 'SG',
				url: panelDraft.url.trim().replace(/\/$/, ''),
				panelPath: panelDraft.panelPath.trim() || '/mka',
				apiKey: panelDraft.apiKey.trim(),
				domain: panelDraft.domain.trim(),
				subPort: Number(panelDraft.subPort) || 2096,
				protocol: panelDraft.protocol || 'trojan',
				enabledProtocols: splitCsv(panelDraft.enabledProtocols),
				enabled: panelDraft.enabled,
				badge: panelDraft.badge.trim(),
				notes: panelDraft.notes.trim(),
			};

			if (editingPanelId && serverId !== editingPanelId) {
				payload.newServerId = serverId;
			}

			const response = await fetch('/api/admin/servers', {
				method: editingPanelId ? 'PATCH' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const data = await readApiJson(response);

			if (data?.success) {
				toast.success(editingPanelId ? 'Panel updated' : 'Panel added');
				resetPanelDraft();
				await refreshServers();
			} else {
				toast.error(data?.error || 'Failed to save panel');
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to save panel');
		} finally {
			setPanelSaving(false);
		}
	}

	async function handleDeletePanel(serverId: string) {
		if (!window.confirm(`Delete panel server "${serverId}"?`)) return;

		setPanelSaving(true);
		try {
			const response = await fetch(`/api/admin/servers?serverId=${encodeURIComponent(serverId)}`, {
				method: 'DELETE',
			});
			const data = await readApiJson(response);

			if (data?.success) {
				toast.success('Panel deleted');
				if (editingPanelId === serverId) resetPanelDraft();
				await refreshServers();
			} else {
				toast.error(data?.error || 'Failed to delete panel');
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to delete panel');
		} finally {
			setPanelSaving(false);
		}
	}

	async function handleSaveConfig() {
		setActionLoading(true);

		try {
			const cleanedTokens = doTokens
				.map((row, index) => ({
					id: row.id || createId(`do_token_${index + 1}`),
					label: row.label || `Token ${index + 1}`,
					token: String(row.token || '').trim(),
					enabled: row.enabled !== false,
				}))
				.filter((row) => row.token);
			const cleanedServerLinks = serverLinks
				.map((row, index) => ({
					id: row.id || createId(`server_link_${index + 1}`),
					serverName: String(row.serverName || '').trim(),
					tokenId: String(row.tokenId || '').trim(),
					enabled: row.enabled !== false,
				}))
				.filter((row) => row.serverName && row.tokenId);
			const cleanedCfAccounts = cfAccounts
				.map((row, index) => ({
					id: row.id || createId(`cf_account_${index + 1}`),
					label: row.label || `Cloudflare ${index + 1}`,
					token: String(row.token || '').trim(),
					email: String(row.email || '').trim().toLowerCase(),
					enabled: row.enabled !== false,
				}))
				.filter((row) => row.token);

			const payload = {
				...config,
				doToken1: cleanedTokens[0]?.token || '',
				doToken2: cleanedTokens[1]?.token || '',
				doToken3: cleanedTokens[2]?.token || '',
				doToken4: cleanedTokens[3]?.token || '',
				doTokens: cleanedTokens,
				serverLinks: cleanedServerLinks,
				cfToken: cleanedCfAccounts[0]?.token || '',
				cfEmail: cleanedCfAccounts[0]?.email || config.cfEmail || '',
				cfAccounts: cleanedCfAccounts,
			};

			const response = await fetch('/api/admin/rotate-config', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			const data = await readApiJson(response);
			if (data?.success) {
				toast.success('Configuration saved successfully');
				void loadDigitalOceanOptions(true);
				setCurrentStep(2);
			} else {
				toast.error(data?.error || 'Failed to save configuration');
			}
		} catch {
			toast.error('Network error while saving configuration');
		} finally {
			setActionLoading(false);
		}
	}

	async function handleOneClickRotate() {
		setActionLoading(true);
		setCurrentStep(5);
		setStepResults((prev) => ({
			...prev,
			2: { status: 'loading', message: 'One-click rotation is preparing backup...' },
			3: { status: 'loading', message: 'Waiting for backup to finish before recreating VPS...' },
			4: { status: 'loading', message: 'Waiting for recreate before DNS update...' },
			5: { status: 'loading', message: 'One-click rotation is starting...' },
		}));

		try {
			const response = await fetch('/api/admin/rotate-server', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ serverId: targetServer }),
			});

			const data = await readApiJson(response);

			if (data?.success) {
				if (data?.pending && data?.jobId) {
					setStepResults((prev) => ({
						...prev,
						5: {
							status: 'loading',
							message: data.message || 'One-click rotation is running in the background...',
							jobId: data.jobId,
						},
					}));
					toast.success(data.message || 'One-click rotation started');
					await pollRotateJob(data.jobId, 5);
					setStepResults((prev) => ({
						...prev,
						2: prev[2]?.status === 'loading' ? { status: 'success', message: 'Backup completed' } : prev[2],
						3: prev[3]?.status === 'loading' ? { status: 'success', message: 'VPS recreated' } : prev[3],
						4: prev[4]?.status === 'loading' ? { status: 'success', message: 'DNS updated' } : prev[4],
					}));
				} else {
					setStepResults((prev) => ({
						...prev,
						5: { status: 'success', message: data.message || 'One-click rotation completed' },
					}));
					toast.success(data.message || 'One-click rotation completed');
				}
			} else {
				setStepResults((prev) => ({
					...prev,
					5: { status: 'error', message: data?.error || 'Failed to start rotation' },
				}));
				toast.error(data?.error || 'Failed to start rotation');
			}
		} catch (error) {
			const message = getActionErrorMessage(error);
			setStepResults((prev) => ({
				...prev,
				5: { status: 'error', message },
			}));
			toast.error(message);
		} finally {
			setActionLoading(false);
			void loadHistory(true);
		}
	}

	async function executeAction(action: string, stepNumber: number) {
		setActionLoading(true);
		setStepResults((prev) => ({ ...prev, [stepNumber]: { status: 'loading' } }));

		try {
			const response = await fetch('/api/admin/rotate-workflow', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ serverId: targetServer, action }),
			});

			const data = await readApiJson(response);

			if (data?.success) {
				if (data?.pending && data?.jobId) {
					setStepResults((prev) => ({
						...prev,
						[stepNumber]: {
							status: 'loading',
							message: data.message || 'Step is running in the background...',
							jobId: data.jobId,
						},
					}));
					toast.success(data.message || 'Background job started');
					await pollRotateJob(data.jobId, stepNumber);
					return;
				}

				setStepResults((prev) => ({
					...prev,
					[stepNumber]: {
						status: 'success',
						message: data.message,
						newIp: data.newIp,
					},
				}));
				toast.success(data.message || 'Step completed');

				if (stepNumber < 5) {
					window.setTimeout(() => setCurrentStep(stepNumber + 1), 900);
				}
			} else {
				setStepResults((prev) => ({
					...prev,
					[stepNumber]: { status: 'error', message: data?.error || 'Action failed' },
				}));
				toast.error(data?.error || 'Action failed');
			}
		} catch (error) {
			const message = getActionErrorMessage(error);
			setStepResults((prev) => ({
				...prev,
				[stepNumber]: { status: 'error', message },
			}));
			toast.error(message);
		} finally {
			setActionLoading(false);
			void loadHistory(true);
		}
	}

	async function pollRotateJob(jobId: string, stepNumber: number) {
		const deadline = Date.now() + 40 * 60 * 1000;

		while (Date.now() < deadline) {
			await sleep(5000);

			const response = await fetch(`/api/admin/rotate-workflow?jobId=${encodeURIComponent(jobId)}`, {
				cache: 'no-store',
			});
			const data = await readApiJson(response);

			if (data?.pending) {
				setStepResults((prev) => ({
					...prev,
					[stepNumber]: {
						status: 'loading',
						message: data.message || 'Step is still running in the background...',
						jobId,
					},
				}));
				continue;
			}

			if (data?.success) {
				setStepResults((prev) => ({
					...prev,
					[stepNumber]: {
						status: 'success',
						message: data.message,
						newIp: data.newIp,
						jobId,
					},
				}));
				toast.success(data.message || 'Step completed');
				return;
			}

			throw new Error(data?.error || 'Background job failed');
		}

		throw new Error('Background job timed out while waiting for panel installation.');
	}

	if (loading) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center bg-slate-950 text-white">
				<div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 shadow-xl shadow-sky-500/10 backdrop-blur">
					<Loader2 className="h-5 w-5 animate-spin text-sky-400" />
					<span className="text-sm font-medium text-slate-200">Loading rotation wizard...</span>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_30%),linear-gradient(180deg,#020617_0%,#0f172a_55%,#111827_100%)] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
			<div className="mx-auto w-full">
				<div className="mb-8 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-sky-950/20 backdrop-blur-xl sm:p-8">
					<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
						<div>
							<p className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-300/80">Admin Workflow</p>
							<h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Server Rotation Wizard</h1>
							<p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
								Step-by-step rotation with inline progress.
							</p>
						</div>

						<div className="flex flex-col items-start gap-3">
							{linkedDoTokenLabel ? (
								<div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
									DO Token: {linkedDoTokenLabel}
								</div>
							) : (
								<div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
									No DO token linked
								</div>
							)}
							<div className="rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">
								{selectedServerLabel}
							</div>
							<button
								type="button"
								onClick={handleOneClickRotate}
								disabled={actionLoading}
								className="inline-flex items-center justify-center rounded-full bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition-all hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
								One-click rotate
							</button>
							<p className="text-xs text-slate-400">Launch the full background rotate job.</p>
						</div>
					</div>
				</div>

				<div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
					{STEPS.map((step) => {
						const isActive = currentStep === step.id;
						const isDone = currentStep > step.id;
						const StepIcon = step.icon;

						return (
							<button
								key={step.id}
								type="button"
								onClick={() => setCurrentStep(step.id)}
								disabled={actionLoading}
								className={`group rounded-2xl border p-4 text-left transition-all duration-300 ${
									isActive
										? 'border-sky-400/60 bg-sky-400/15 shadow-lg shadow-sky-500/10'
										: isDone
											? 'border-emerald-400/40 bg-emerald-400/10'
											: 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
								}`}
							>
								<div className="flex items-center gap-3">
									<div className={`flex h-11 w-11 items-center justify-center rounded-full ${isActive ? 'bg-sky-400 text-slate-950' : isDone ? 'bg-emerald-400 text-slate-950' : 'bg-white/10 text-slate-300'}`}>
										{isDone ? <Check className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
									</div>
									<div>
										<p className={`text-sm font-semibold ${isActive || isDone ? 'text-white' : 'text-slate-200'}`}>
											{step.title}
										</p>
									</div>
								</div>
							</button>
						);
					})}
				</div>

				<div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 shadow-2xl shadow-slate-950/30 backdrop-blur-xl">
					{currentStep === 1 && (
						<section className="animate-in fade-in slide-in-from-right-4 duration-500 p-6 sm:p-8">
							<StepHeader
								step={1}
								title="Config Setup"
								description="Manage target servers, DigitalOcean create options, Cloudflare DNS, 3xUI panels, and rotation history from one clean workspace."
							/>

							<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
								<div className="min-w-0 space-y-5">
									<div className="flex gap-2 overflow-x-auto rounded-lg border border-white/10 bg-white/[0.03] p-1">
										{CONFIG_TABS.map((tab) => {
											const TabIcon = tab.icon;
											const selected = configTab === tab.id;
											return (
												<button
													key={tab.id}
													type="button"
													onClick={() => setConfigTab(tab.id)}
													className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition ${
														selected
															? 'bg-sky-400 text-slate-950'
															: 'text-slate-400 hover:bg-white/5 hover:text-white'
													}`}
												>
													<TabIcon className="h-3.5 w-3.5" />
													{tab.label}
												</button>
											);
										})}
									</div>

									{configTab === 'servers' ? (
										<div className="space-y-5">
											<SectionPanel
												title="Target server"
												description="Pick the server you want to rotate. Live IP/time comes from the server registry."
												icon={Server}
											>
												<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
													{serverOptions.map((option) => {
														const selected = targetServer === option.value;
														const ipValue = option.resolvedIp || option.domain || 'unavailable';

														return (
															<button
																key={option.value}
																type="button"
																onClick={() => setTargetServer(option.value)}
																className={`rounded-lg border p-3 text-left transition ${
																	selected
																		? 'border-sky-400/70 bg-sky-400/15 text-white'
																		: 'border-white/10 bg-slate-950/40 text-slate-300 hover:border-white/20 hover:bg-white/5'
																}`}
															>
																<div className="flex items-start justify-between gap-3">
																	<div className="min-w-0">
																		<div className="flex flex-wrap items-center gap-2">
																			<span className="truncate text-sm font-semibold">{option.label}</span>
																			{option.enabled === false ? (
																				<span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
																					Disabled
																				</span>
																			) : null}
																		</div>
																		<p className="mt-1 truncate font-mono text-xs text-slate-400">{ipValue}</p>
																		<p className="mt-1 text-xs text-slate-500">{formatRelativeTime(option.dropletCreatedAt || option.updatedAt)}</p>
																	</div>
																	<div className={`mt-1 h-3 w-3 shrink-0 rounded-full ${selected ? 'bg-sky-300' : 'bg-slate-600'}`} />
																</div>
															</button>
														);
													})}
												</div>
											</SectionPanel>

											<SectionPanel
												title="Server to DO token links"
												description="Map each panel/server to the DigitalOcean account token that owns its droplet."
												icon={Link2}
												action={
													<button
														type="button"
														onClick={addServerLinkRow}
														className="inline-flex items-center gap-2 rounded-lg border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-sky-400/20"
													>
														<Plus className="h-3.5 w-3.5" />
														Add link
													</button>
												}
											>
												{serverLinks.length === 0 ? (
													<div className="rounded-lg border border-dashed border-white/10 bg-slate-950/40 px-4 py-5 text-sm text-slate-500">
														Add a link so each server rotates through the correct DO account.
													</div>
												) : (
													<div className="grid gap-3">
														{serverLinks.map((row, index) => (
															<div key={row.id} className="grid gap-3 rounded-lg border border-white/10 bg-slate-950/40 p-3 lg:grid-cols-[1fr_1fr_auto_auto]">
																<SelectField
																	label="Server"
																	name={`serverName-${index}`}
																	value={row.serverName}
																	onChange={(event) => updateServerLink(index, 'serverName', event.target.value)}
																	options={serverOptions.map((server) => ({
																		value: server.value,
																		label: server.label,
																		description: server.domain || server.resolvedIp || '',
																	}))}
																/>
																<SelectField
																	label="DO token"
																	name={`tokenId-${index}`}
																	value={row.tokenId}
																	onChange={(event) => updateServerLink(index, 'tokenId', event.target.value)}
																	options={availableTokens.map((token) => ({
																		value: token.id,
																		label: token.label || token.id,
																		description: token.enabled === false ? 'Disabled' : 'Enabled',
																	}))}
																/>
																<ToggleField
																	label="Enabled"
																	checked={row.enabled !== false}
																	onChange={(checked) => updateServerLink(index, 'enabled', checked)}
																/>
																<button
																	type="button"
																	onClick={() => removeServerLinkRow(index)}
																	className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-semibold text-slate-300 transition hover:bg-white/10"
																>
																	<Trash2 className="h-3.5 w-3.5" />
																	Remove
																</button>
															</div>
														))}
													</div>
												)}
											</SectionPanel>
										</div>
									) : null}

									{configTab === 'digitalocean' ? (
										<div className="space-y-5">
											<SectionPanel
												title="DigitalOcean accounts"
												description="Add any number of account tokens, then link each server to the right token."
												icon={KeyRound}
												action={
													<button
														type="button"
														onClick={addDoTokenRow}
														className="inline-flex items-center gap-2 rounded-lg border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-sky-400/20"
													>
														<Plus className="h-3.5 w-3.5" />
														Add token
													</button>
												}
											>
												<div className="grid gap-3">
													{doTokens.map((row, index) => (
														<div key={row.id} className="grid gap-3 rounded-lg border border-white/10 bg-slate-950/40 p-3 lg:grid-cols-[0.8fr_1.4fr_auto_auto]">
															<Field
																label="Label"
																name={`doTokenLabel-${index}`}
																value={row.label}
																onChange={(event) => updateDoToken(index, 'label', event.target.value)}
															/>
															<Field
																label="Token"
																name={`doToken-${index}`}
																value={row.token}
																onChange={(event) => updateDoToken(index, 'token', event.target.value)}
																type="password"
															/>
															<ToggleField
																label="Enabled"
																checked={row.enabled !== false}
																onChange={(checked) => updateDoToken(index, 'enabled', checked)}
															/>
															<button
																type="button"
																onClick={() => removeDoTokenRow(index)}
																className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-semibold text-slate-300 transition hover:bg-white/10"
															>
																<Trash2 className="h-3.5 w-3.5" />
																Remove
															</button>
														</div>
													))}
												</div>
											</SectionPanel>

{doAccounts.length > 0 ? (
														<SectionPanel title="DigitalOcean accounts" description="Current account status, credit, and limits." icon={ShieldCheck}>
										<div className="grid gap-4 lg:grid-cols-2">
											{doAccounts.map((account) => (
												<div key={account.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
													<p className="text-xs text-slate-400">Account</p>
													<p className="mt-1 text-sm font-semibold text-slate-100">{account.label || account.email}</p>
													<div className="mt-4 grid gap-3">
														<div>
															<p className="text-xs text-slate-400">Email</p>
															<p className="mt-1 font-mono text-xs text-slate-200">{account.email}</p>
														</div>
														<div>
															<p className="text-xs text-slate-400">Status</p>
															<p className="mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold text-emerald-200">
																<span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
																{account.status}
															</p>
														</div>
														<div>
															<p className="text-xs text-slate-400">Droplet limit</p>
															<p className="mt-1 text-sm font-semibold text-sky-200">{account.dropletLimit}</p>
														</div>
														<div>
															<p className="text-xs text-slate-400">Floating IPs</p>
															<p className="mt-1 text-sm font-semibold text-sky-200">{account.floatingIpLimit}</p>
														</div>
														<div>
															<p className="text-xs text-slate-400">Balance</p>
															<p className="mt-1 text-sm font-semibold text-amber-200">{account.balance}</p>
														</div>
													</div>
												</div>
											))}
										</div>
									</SectionPanel>
								) : null}

											<SectionPanel
												title="Droplet create setup"
												description="These choices are used when the old droplet is deleted and recreated."
												icon={HardDrive}
												action={
													<button
														type="button"
														onClick={() => void loadDigitalOceanOptions(false)}
														disabled={doOptionsLoading}
														className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
													>
														<RefreshCw className={`h-3.5 w-3.5 ${doOptionsLoading ? 'animate-spin' : ''}`} />
														Refresh DO
													</button>
												}
											>
												{doOptionsError ? (
													<div className="mb-4 rounded-lg border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-xs leading-5 text-amber-100">
														{doOptionsError}
													</div>
												) : null}
												<div className="grid gap-4 lg:grid-cols-3">
													<SelectField label="Region" name="dropletRegion" value={config.dropletRegion} onChange={handleConfigChange} options={regionChoices} />
													<SelectField label="Size" name="dropletSize" value={config.dropletSize} onChange={handleConfigChange} options={sizeChoices} />
													<SelectField label="Image" name="dropletImage" value={config.dropletImage} onChange={handleConfigChange} options={imageChoices} />
												</div>
												<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
													<ToggleField label="Backups" description="Enable DO automated backups." checked={config.dropletBackups} onChange={(checked) => setConfig((current) => ({ ...current, dropletBackups: checked }))} />
													<ToggleField label="IPv6" description="Only applies when public networking is on." checked={config.dropletIpv6} onChange={(checked) => setConfig((current) => ({ ...current, dropletIpv6: checked }))} />
													<ToggleField label="Monitoring" description="Install DO monitoring agent." checked={config.dropletMonitoring} onChange={(checked) => setConfig((current) => ({ ...current, dropletMonitoring: checked }))} />
													<ToggleField label="Public networking" description="Leave on for VPN panels." checked={config.dropletPublicNetworking} onChange={(checked) => setConfig((current) => ({ ...current, dropletPublicNetworking: checked }))} />
													<ToggleField label="Droplet agent" description="Enable DO droplet agent." checked={config.dropletAgent} onChange={(checked) => setConfig((current) => ({ ...current, dropletAgent: checked }))} />
												</div>
												<div className="mt-4 grid gap-4 lg:grid-cols-2">
													<SelectField label="VPC" name="dropletVpcUuid" value={config.dropletVpcUuid} onChange={handleConfigChange} options={vpcChoices} />
													<Field label="Tags" name="dropletTags" value={config.dropletTags} onChange={handleConfigChange} help="Comma separated, for example: vpn, rotate, sg" />
												</div>
												<div className="mt-4 grid gap-4 lg:grid-cols-2">
													<MultiChoiceField
														label="SSH keys"
														values={splitCsv(config.dropletSshKeys)}
														options={doOptions.sshKeys}
														onToggle={(value, checked) => updateConfigCsv('dropletSshKeys', value, checked)}
													/>
													<MultiChoiceField
														label="Volumes"
														values={splitCsv(config.dropletVolumes)}
														options={volumeOptions}
														onToggle={(value, checked) => updateConfigCsv('dropletVolumes', value, checked)}
													/>
												</div>
												<div className="mt-4 grid gap-4 lg:grid-cols-2">
													<TextAreaField
														label="Extra cloud-init"
														name="dropletUserData"
														value={config.dropletUserData}
														onChange={handleConfigChange}
														help="Optional. The root password bootstrap is always prepended by the rotate workflow."
													/>
													<TextAreaField
														label="Backup policy JSON"
														name="dropletBackupPolicy"
														value={config.dropletBackupPolicy}
														onChange={handleConfigChange}
														help="Optional DigitalOcean backup_policy object as JSON."
													/>
												</div>
											</SectionPanel>
										</div>
									) : null}

									{configTab === 'cloudflare' ? (
										<SectionPanel
											title="Cloudflare accounts"
											description="Save every Cloudflare token you want to use. DNS records can be managed under the selected token from Private Servers deploy."
											icon={ShieldCheck}
											action={
												<button
													type="button"
													onClick={addCfAccountRow}
													className="inline-flex items-center gap-2 rounded-lg border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-sky-400/20"
												>
													<Plus className="h-3.5 w-3.5" />
													Add token
												</button>
											}
										>
											<div className="grid gap-3">
												{cfAccounts.map((row, index) => (
													<div key={row.id} className="grid gap-3 rounded-lg border border-white/10 bg-slate-950/40 p-3 lg:grid-cols-[0.8fr_1.3fr_1fr_auto_auto]">
														<Field
															label="Label"
															name={`cfAccountLabel-${index}`}
															value={row.label}
															onChange={(event) => updateCfAccount(index, 'label', event.target.value)}
														/>
														<Field
															label="API token / Global key"
															name={`cfAccountToken-${index}`}
															value={row.token}
															onChange={(event) => updateCfAccount(index, 'token', event.target.value)}
															type="password"
															help="Do not include Bearer."
														/>
														<Field
															label="Account email"
															name={`cfAccountEmail-${index}`}
															value={row.email}
															onChange={(event) => updateCfAccount(index, 'email', event.target.value)}
															type="email"
															help="Required for Global API Key."
														/>
														<ToggleField
															label="Enabled"
															checked={row.enabled !== false}
															onChange={(checked) => updateCfAccount(index, 'enabled', checked)}
														/>
														<button
															type="button"
															onClick={() => removeCfAccountRow(index)}
															className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-semibold text-slate-300 transition hover:bg-white/10"
														>
															<Trash2 className="h-3.5 w-3.5" />
															Remove
														</button>
													</div>
												))}
											</div>
											<div className="mt-4 rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3 text-xs leading-5 text-slate-400">
												The first saved account stays synced with the legacy Cloudflare fields so the current rotate job keeps working.
											</div>
										</SectionPanel>
									) : null}

									{configTab === 'panel' ? (
										<div className="space-y-5">
											<SectionPanel
												title="3xUI install credentials"
												description="Applied after install/restore so the panel can be managed consistently."
												icon={Terminal}
											>
												<div className="grid gap-4 lg:grid-cols-2">
													<Field label="Username" name="xuiUsername" value={config.xuiUsername} onChange={handleConfigChange} />
													<Field label="Password" name="xuiPassword" value={config.xuiPassword} onChange={handleConfigChange} type="password" />
												</div>
												<div className="mt-4">
													<ToggleField label="Enable 2FA during install" checked={config.enable2FA} onChange={(checked) => setConfig((current) => ({ ...current, enable2FA: checked }))} />
												</div>
											</SectionPanel>

											<SectionPanel
												title={editingPanelId ? `Edit panel: ${editingPanelId}` : 'Add 3xUI panel'}
												description="This is the server registry used by rotation, provisioning, and subscription flows."
												icon={PanelTop}
												action={
													showPanelForm || editingPanelId ? (
														<button
															type="button"
															onClick={resetPanelDraft}
															className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
														>
															Close
														</button>
													) : (
														<button
															type="button"
															onClick={openPanelDraft}
															className="inline-flex items-center gap-2 rounded-lg border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-sky-400/20"
														>
															<Plus className="h-3.5 w-3.5" />
															Add 3xUI panel
														</button>
													)
												}
											>
												{showPanelForm || editingPanelId ? (
													<>
														<div className="grid gap-4 lg:grid-cols-3">
															<Field label="Server ID" name="serverId" value={panelDraft.serverId} onChange={handlePanelDraftChange} help="Lowercase slug, e.g. sg1 or us1." />
															<Field label="Name" name="name" value={panelDraft.name} onChange={handlePanelDraftChange} />
															<Field label="Flag code" name="flag" value={panelDraft.flag} onChange={handlePanelDraftChange} help="Use short text if emoji display is unavailable." />
															<Field label="Domain" name="domain" value={panelDraft.domain} onChange={handlePanelDraftChange} />
															<Field label="Panel URL" name="url" value={panelDraft.url} onChange={handlePanelDraftChange} help="Example: https://sg1.example.com:8080" />
															<Field label="Panel path" name="panelPath" value={panelDraft.panelPath} onChange={handlePanelDraftChange} />
															<Field label="Sub port" name="subPort" value={panelDraft.subPort} onChange={handlePanelDraftChange} />
															<SelectField
																label="Default protocol"
																name="protocol"
																value={panelDraft.protocol}
																onChange={handlePanelDraftChange}
																options={[
																	{ value: 'trojan', label: 'Trojan' },
																	{ value: 'vless', label: 'VLESS' },
																	{ value: 'vmess', label: 'VMess' },
																]}
															/>
															<Field label="Badge" name="badge" value={panelDraft.badge} onChange={handlePanelDraftChange} />
														</div>
														<div className="mt-4 grid gap-4 lg:grid-cols-2">
															<Field label="Enabled protocols" name="enabledProtocols" value={panelDraft.enabledProtocols} onChange={handlePanelDraftChange} help="Comma separated protocols." />
															<Field label="3xUI API key" name="apiKey" value={panelDraft.apiKey} onChange={handlePanelDraftChange} type="password" />
														</div>
														<div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto]">
															<TextAreaField label="Notes" name="notes" value={panelDraft.notes} onChange={handlePanelDraftChange} rows={3} />
															<ToggleField label="Enabled" checked={panelDraft.enabled} onChange={(checked) => setPanelDraft((current) => ({ ...current, enabled: checked }))} />
														</div>
														<div className="mt-5 flex justify-end">
															<button
																type="button"
																onClick={handleSavePanel}
																disabled={panelSaving}
																className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
															>
																{panelSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
																{editingPanelId ? 'Update panel' : 'Add panel'}
															</button>
														</div>
													</>
												) : null}
											</SectionPanel>

											<SectionPanel title="Panel registry" description="Edit or remove panels from the same rotation workflow." icon={Network}>
												<div className="grid gap-3">
													{panelServers.length === 0 ? (
														<div className="rounded-lg border border-dashed border-white/10 bg-slate-950/40 px-4 py-5 text-sm text-slate-500">
															No panel servers are saved yet.
														</div>
													) : panelServers.map((server) => (
														<div key={server.serverId} className="flex flex-col gap-3 rounded-lg border border-white/10 bg-slate-950/40 p-3 sm:flex-row sm:items-center sm:justify-between">
															<div className="min-w-0">
																<div className="flex flex-wrap items-center gap-2">
																	<p className="font-semibold text-white">{server.name}</p>
																	<span className="rounded-md border border-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-400">{server.serverId}</span>
																	{server.enabled ? null : <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">Disabled</span>}
																</div>
																<p className="mt-1 truncate text-xs text-slate-400">{server.domain} / {server.url}</p>
																<p className="mt-1 font-mono text-xs text-slate-500">{server.resolvedIp || 'IP unknown'}</p>
															</div>
															<div className="flex gap-2">
																<button
																	type="button"
																	onClick={() => editPanel(server)}
																	className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
																>
																	<Edit3 className="h-3.5 w-3.5" />
																	Edit
																</button>
																<button
																	type="button"
																	onClick={() => void handleDeletePanel(server.serverId)}
																	disabled={panelSaving}
																	className="inline-flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50"
																>
																	<Trash2 className="h-3.5 w-3.5" />
																	Delete
																</button>
															</div>
														</div>
													))}
												</div>
											</SectionPanel>
										</div>
									) : null}

									{configTab === 'history' ? (
										<HistoryTable rows={history} loading={historyLoading} onRefresh={() => void loadHistory(false)} />
									) : null}
								</div>

								<aside className="space-y-4">
									<SectionPanel title="Rotation summary" description="Current target and saved infrastructure settings." icon={Clock3}>
										<div className="space-y-3 text-sm">
											<div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
												<span className="text-slate-400">Target</span>
												<span className="text-right font-semibold text-white">{selectedServerLabel}</span>
											</div>
											<div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
												<span className="text-slate-400">Domain</span>
												<span className="text-right text-slate-200">{selectedServerOption?.domain || 'not set'}</span>
											</div>
											<div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
												<span className="text-slate-400">Current IP</span>
												<button
													type="button"
													onClick={() => void copyText(selectedServerOption?.resolvedIp || '')}
													disabled={!selectedServerOption?.resolvedIp}
													className="font-mono text-xs text-sky-200 transition hover:text-sky-100 disabled:cursor-not-allowed disabled:text-slate-500"
												>
													{selectedServerOption?.resolvedIp || 'unknown'}
												</button>
											</div>
											<div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
												<span className="text-slate-400">DO token</span>
												<span className="text-right text-slate-200">{linkedDoTokenLabel || 'fallback / not linked'}</span>
											</div>
											<div className="flex items-start justify-between gap-3">
												<span className="text-slate-400">Droplet</span>
												<span className="text-right text-slate-200">{config.dropletRegion} / {config.dropletSize}</span>
											</div>
										</div>
										<div className="mt-5 rounded-lg border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-xs leading-5 text-sky-100">
											Save config before running rotate so the background job uses the latest DO, Cloudflare, and panel settings.
										</div>
									</SectionPanel>
								</aside>
							</div>

							<div className="hidden">
								<div className="space-y-5">
									<div>
										<div className="mt-3 grid gap-2 sm:grid-cols-2">
											{serverOptions.map((option) => {
												const selected = targetServer === option.value;
												const ipValue = option.resolvedIp || option.domain || 'unavailable';

												return (
													<div
														key={option.value}
														className={`rounded-xl border px-3 py-3 text-left transition-all ${
															selected
																? 'border-sky-400/70 bg-sky-400/15 text-white'
																: 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10'
														}`}
													>
														<button
															type="button"
															onClick={() => setTargetServer(option.value)}
															className="flex w-full items-start gap-3 text-left"
														>
															<div className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border ${selected ? 'border-sky-300 bg-sky-400' : 'border-slate-500'}`}>
																{selected ? <span className="h-1.5 w-1.5 rounded-full bg-slate-950" /> : null}
															</div>
															<div className="min-w-0 flex-1">
																<div className="flex flex-wrap items-center gap-2">
																	<span className="text-sm font-semibold leading-5">{option.label}</span>
																	{option.badge ? (
																		<span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-sky-200">
																			{option.badge}
																		</span>
																	) : null}
																</div>
																<div className="mt-1 space-y-0.5 text-[11px] leading-4 text-slate-400">
																	<div>
																		<span className="font-medium text-slate-300">IP:</span> {ipValue}
																	</div>
																	<div>
																		<span className="font-medium text-slate-300">Time:</span> {formatDateTimeShort(option.dropletCreatedAt || option.updatedAt)}
																		<span className="ml-2 text-slate-500">({formatRelativeTime(option.dropletCreatedAt || option.updatedAt)})</span>
																	</div>
																</div>
															</div>
														</button>

														<div className="mt-2 flex items-center justify-end gap-2">
															<button
																type="button"
																onClick={() => void copyText(ipValue)}
																disabled={ipValue === 'unavailable'}
																className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
															>
																<Copy className="h-3 w-3" />
																Copy IP
															</button>
														</div>
													</div>
												);
											})}
										</div>
									</div>

									<div className="rounded-2xl border border-white/10 bg-white/5 p-4">
										<div className="flex items-center justify-between gap-3">
											<h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300/80">Server ↔ Token Links</h3>
											<button
												type="button"
												onClick={addServerLinkRow}
												className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1.5 text-xs font-semibold text-sky-100 transition hover:bg-sky-400/20"
											>
												<Plus className="h-3.5 w-3.5" />
												Add server
											</button>
										</div>

										<div className="mt-4 space-y-4">
											{serverLinks.length === 0 ? (
												<div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 p-4 text-sm text-slate-400">
													Add a server row, then choose which token should be used for that server.
												</div>
											) : null}

											{serverLinks.map((row, index) => (
												<div key={row.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
													<div className="flex items-center justify-between gap-3">
														<div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/80">
															Server {index + 1}
														</div>
														<button
															type="button"
															onClick={() => removeServerLinkRow(index)}
															className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
														>
															<XCircle className="h-3.5 w-3.5" />
															Remove
														</button>
													</div>

													<div className="mt-3">
														<Field
															label="Server name"
															name={`serverName-${index}`}
															value={row.serverName}
															onChange={(event) => updateServerLink(index, 'serverName', event.target.value)}
															help="Use the same name you want to manage in rotation."
														/>
													</div>

													<div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
														<div className="flex items-center justify-between gap-3">
															<p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/80">Link token</p>
															<p className="text-[11px] text-slate-400">Choose one token for this server</p>
														</div>

														{availableTokens.length === 0 ? (
															<div className="mt-3 rounded-xl border border-dashed border-white/10 bg-slate-950/30 px-3 py-3 text-sm text-slate-400">
																Add and save a token above first.
															</div>
														) : (
															<div className="mt-3 grid gap-2 sm:grid-cols-2">
																{availableTokens.map((token) => (
																	<label
																		key={token.id}
																		className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm transition ${
																			row.tokenId === token.id
																				? 'border-sky-400/60 bg-sky-400/10 text-white'
																				: 'border-white/10 bg-slate-950/40 text-slate-300 hover:border-white/20 hover:bg-white/5'
																		}`}
																	>
																		<input
																			type="checkbox"
																			checked={row.tokenId === token.id}
																			disabled={token.enabled === false}
																			onChange={(event) => selectServerToken(index, token.id, event.target.checked)}
																			className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-sky-500 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
																		/>
																		<div className="min-w-0">
																			<div className="truncate font-medium">{token.label || 'Token'}</div>
																			<div className="truncate text-xs text-slate-400">
																				{token.enabled === false ? 'Disabled' : 'Enabled'}
																			</div>
																		</div>
																	</label>
																))}
															</div>
														)}
													</div>
												</div>
											))}
										</div>
									</div>

									<div className="rounded-2xl border border-white/10 bg-white/5 p-4">
										<div className="flex items-center justify-between gap-3">
											<h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300/80">DO</h3>
											<button
												type="button"
												onClick={addDoTokenRow}
												className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1.5 text-xs font-semibold text-sky-100 transition hover:bg-sky-400/20"
											>
												<Plus className="h-3.5 w-3.5" />
												Add token
												</button>
										</div>
										<p className="mt-2 text-xs text-slate-400">
											Toggle is only for parking a token temporarily without deleting it.
										</p>
										<div className="mt-4 grid gap-4">
											<div className="space-y-3">
												{doTokens.map((row, index) => {
													const accountInfo = doAccounts.find((acc) => normalizeKey(acc.id) === normalizeKey(row.id));
													return (
														<div key={row.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
															<div className="flex items-center justify-between gap-3">
																<div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/80">
																	{row.label || `Token ${index + 1}`}
																</div>
																<button
																	type="button"
																	onClick={() => removeDoTokenRow(index)}
																	className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
																>
																	<XCircle className="h-3.5 w-3.5" />
																	Remove
																</button>
															</div>
															{accountInfo && (
																<div className="mt-3 grid gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3">
																	<div>
																		<p className="text-[10px] font-semibold uppercase tracking-widest text-amber-300/70">Account Balance</p>
																		<p className="mt-1 text-sm font-bold text-amber-100">${typeof accountInfo.balance === 'number' ? accountInfo.balance.toFixed(2) : accountInfo.balance}</p>
																	</div>
																	<div className="flex gap-3 text-[10px]">
																		<div>
																			<p className="text-slate-500">Email</p>
																			<p className="truncate font-mono text-slate-300">{accountInfo.email}</p>
																		</div>
																		<div>
																			<p className="text-slate-500">Droplets</p>
																			<p className="font-semibold text-slate-200">{accountInfo.dropletLimit}</p>
																		</div>
																	</div>
																</div>
															)}
															<div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
																<input
																	type="text"
																	value={row.label}
																	onChange={(e) => updateDoToken(index, 'label', e.target.value)}
																	placeholder="Token label"
																	className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
																/>
																<button
																	type="button"
																	onClick={() => updateDoToken(index, 'enabled', !row.enabled)}
																	className={`inline-flex w-fit items-center gap-2 justify-self-start rounded-full border px-3 py-2 text-xs font-semibold transition ${
																		row.enabled
																			? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
																			: 'border-white/10 bg-white/5 text-slate-400'
																	}`}
																>
																	<span className={`h-2.5 w-2.5 rounded-full ${row.enabled ? 'bg-emerald-400' : 'bg-slate-500'}`} />
																	{row.enabled ? 'On' : 'Off'}
																</button>
															</div>
															<div className="mt-3">
																<Field
																	label="Token"
																	name={`doToken-${index}`}
																	value={row.token}
																	onChange={(event) => updateDoToken(index, 'token', event.target.value)}
																	type="password"
																/>
															</div>
														</div>
													);
												})}
											</div>
											<div className="grid gap-4 sm:grid-cols-2">
												<SelectField
													label="Droplet size"
													name="dropletSize"
													value={config.dropletSize}
													onChange={handleConfigChange}
													options={DROPLET_SIZE_OPTIONS}
												/>
												<SelectField
													label="Droplet image"
													name="dropletImage"
													value={config.dropletImage}
													onChange={handleConfigChange}
													options={DROPLET_IMAGE_OPTIONS}
												/>
											</div>
										</div>
									</div>
								</div>

								<div className="space-y-5">
									<div className="rounded-2xl border border-white/10 bg-white/5 p-4">
										<h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300/80">X-UI</h3>
										<div className="mt-4 grid gap-4">
											<Field label="Username" name="xuiUsername" value={config.xuiUsername} onChange={handleConfigChange} />
											<Field label="Password" name="xuiPassword" value={config.xuiPassword} onChange={handleConfigChange} type="password" />
											<label className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-200">
												<input
													type="checkbox"
													name="enable2FA"
													checked={config.enable2FA}
													onChange={handleConfigChange}
													className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-sky-500 focus:ring-sky-500"
												/>
												Enable 2FA during install
											</label>
										</div>
									</div>

									<div className="rounded-2xl border border-white/10 bg-white/5 p-4">
										<h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300/80">CF</h3>
										<div className="mt-4 grid gap-4">
											<Field
												label="API token / Global API key"
												name="cfToken"
												value={config.cfToken}
												onChange={handleConfigChange}
												type="password"
												help="For a Global API Key, paste only the key value and fill the Cloudflare account email below. Do not include Bearer."
											/>
											<Field
												label="Account email"
												name="cfEmail"
												value={config.cfEmail}
												onChange={handleConfigChange}
												type="email"
												help="Required when using a Global API Key."
											/>
										</div>
									</div>
								</div>
							</div>

							<div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-end">
								<button
									type="button"
									onClick={handleSaveConfig}
									disabled={actionLoading}
									className="inline-flex items-center justify-center rounded-lg bg-sky-500 px-6 py-3 text-sm font-semibold text-slate-950 transition-all hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
								>
									{actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
									Save config
									<ChevronRight className="ml-2 h-4 w-4" />
								</button>
							</div>
						</section>
					)}

					{currentStep >= 2 && currentStep <= 5 && (
						<section className="animate-in fade-in slide-in-from-right-4 duration-500 p-6 sm:p-8">
							<StepHeader
								step={currentStep}
								title={STEPS[currentStep - 1].title}
								description="Run and review."
							/>

							<div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
								<div className="rounded-2xl border border-white/10 bg-white/5 p-5">
									<div className="flex items-center justify-between gap-4">
										<div>
											<p className="text-xs uppercase tracking-[0.24em] text-slate-400">Target</p>
											<p className="mt-2 text-lg font-semibold text-white uppercase">{targetServer}</p>
										</div>
										<div className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-200">
											Step {currentStep} of 5
										</div>
									</div>

									<div className="mt-6 flex flex-wrap gap-3">
										<button
											type="button"
											onClick={() => {
												const actions: Record<number, string> = {
													2: 'backup',
													3: 'recreate_vps',
													4: 'update_dns',
													5: 'install_3xui',
												};

												void executeAction(actions[currentStep], currentStep);
											}}
											disabled={actionLoading}
											className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
										>
											{actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
											Run
										</button>

										<button
											type="button"
											onClick={() => setCurrentStep((value) => Math.max(1, value - 1))}
											disabled={actionLoading || currentStep === 1}
											className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 transition-all hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
										>
											<ChevronLeft className="mr-2 h-4 w-4" />
											Back
										</button>
									</div>
								</div>

								<div className="space-y-4">
									<ResultCard stepNumber={currentStep} result={stepResults[currentStep]} />
								</div>
							</div>

							<div className="mt-8 flex justify-end border-t border-white/10 pt-6">
								<button
									type="button"
									onClick={() => setCurrentStep((value) => Math.min(5, value + 1))}
									disabled={actionLoading || stepResults[currentStep]?.status !== 'success' || currentStep === 5}
									className="inline-flex items-center justify-center rounded-full bg-sky-500 px-6 py-3 text-sm font-semibold text-slate-950 transition-all hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
								>
									{currentStep === 5 ? 'Finish' : 'Next step'}
									<ChevronRight className="ml-2 h-4 w-4" />
								</button>
							</div>
						</section>
					)}
				</div>
			</div>
		</div>
	);
}

function StepHeader({
	step,
	title,
	description,
}: {
	step: number;
	title: string;
	description: string;
}) {
	return (
		<div className="mb-6 border-b border-white/10 pb-6">
			<p className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-300/70">Step {step}</p>
			<h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">{title}</h2>
			<p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
		</div>
	);
}

function SectionPanel({
	title,
	description,
	icon: Icon,
	children,
	action,
}: {
	title: string;
	description?: string;
	icon?: any;
	children: ReactNode;
	action?: ReactNode;
}) {
	return (
		<section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="flex min-w-0 items-start gap-3">
					{Icon ? (
						<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sky-400/20 bg-sky-400/10 text-sky-200">
							<Icon className="h-4 w-4" />
						</div>
					) : null}
					<div className="min-w-0">
						<h3 className="text-sm font-semibold text-white">{title}</h3>
						{description ? <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p> : null}
					</div>
				</div>
				{action ? <div className="shrink-0">{action}</div> : null}
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
	type = 'text',
	help,
}: {
	label: string;
	name: string;
	value: string;
	onChange: (event: ChangeEvent<HTMLInputElement>) => void;
	type?: string;
	help?: string;
}) {
	return (
		<label className="block">
			<span className="text-sm text-slate-300">{label}</span>
			<input
				name={name}
				type={type}
				value={value}
				onChange={onChange}
				className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
			/>
			{help ? <span className="mt-2 block text-xs leading-5 text-slate-500">{help}</span> : null}
		</label>
	);
}

function TextAreaField({
	label,
	name,
	value,
	onChange,
	help,
	rows = 4,
}: {
	label: string;
	name: string;
	value: string;
	onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
	help?: string;
	rows?: number;
}) {
	return (
		<label className="block">
			<span className="text-sm text-slate-300">{label}</span>
			<textarea
				name={name}
				value={value}
				onChange={onChange}
				rows={rows}
				className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
			/>
			{help ? <span className="mt-2 block text-xs leading-5 text-slate-500">{help}</span> : null}
		</label>
	);
}

function ToggleField({
	label,
	description,
	checked,
	onChange,
}: {
	label: string;
	description?: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}) {
	return (
		<label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-white/10 bg-slate-950/45 px-4 py-3 transition hover:border-white/20">
			<div className="min-w-0">
				<span className="block text-sm font-medium text-slate-100">{label}</span>
				{description ? <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span> : null}
			</div>
			<input
				type="checkbox"
				checked={checked}
				onChange={(event) => onChange(event.target.checked)}
				className="mt-1 h-4 w-4 shrink-0 rounded border-slate-500 bg-slate-900 text-sky-500 focus:ring-sky-500"
			/>
		</label>
	);
}

function MultiChoiceField({
	label,
	values,
	options,
	onToggle,
	emptyText = 'No live options available yet.',
}: {
	label: string;
	values: string[];
	options: DoSelectOption[];
	onToggle: (value: string, checked: boolean) => void;
	emptyText?: string;
}) {
	return (
		<div>
			<p className="text-sm text-slate-300">{label}</p>
			{options.length === 0 ? (
				<div className="mt-2 rounded-lg border border-dashed border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-500">
					{emptyText}
				</div>
			) : (
				<div className="mt-2 grid gap-2 sm:grid-cols-2">
					{options.map((option) => {
						const checked = values.includes(option.value);
						return (
							<label
								key={option.value}
								className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-sm transition ${
									checked
										? 'border-sky-400/60 bg-sky-400/10 text-white'
										: 'border-white/10 bg-slate-950/45 text-slate-300 hover:border-white/20'
								}`}
							>
								<input
									type="checkbox"
									checked={checked}
									onChange={(event) => onToggle(option.value, event.target.checked)}
									className="mt-0.5 h-4 w-4 rounded border-slate-500 bg-slate-900 text-sky-500 focus:ring-sky-500"
								/>
								<span className="min-w-0">
									<span className="block truncate font-medium">{option.label}</span>
									{option.description ? <span className="mt-0.5 block truncate text-xs text-slate-500">{option.description}</span> : null}
								</span>
							</label>
						);
					})}
				</div>
			)}
		</div>
	);
}

function HistoryTable({
	rows,
	loading,
	onRefresh,
}: {
	rows: RotationHistoryRow[];
	loading: boolean;
	onRefresh: () => void;
}) {
	return (
		<SectionPanel
			title="Rotation history"
			description="Latest rotation records with IP, time, panel, and domain."
			icon={History}
			action={
				<button
					type="button"
					onClick={onRefresh}
					disabled={loading}
					className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
					Refresh
				</button>
			}
		>
			{rows.length === 0 ? (
				<div className="rounded-lg border border-dashed border-white/10 bg-slate-950/40 px-4 py-6 text-sm text-slate-500">
					No rotation records yet.
				</div>
			) : (
				<div className="overflow-x-auto">
					<table className="min-w-[760px] w-full text-left text-sm">
						<thead className="text-xs uppercase tracking-[0.16em] text-slate-500">
							<tr className="border-b border-white/10">
								<th className="py-3 pr-4 font-semibold">Time</th>
								<th className="py-3 pr-4 font-semibold">Server</th>
								<th className="py-3 pr-4 font-semibold">Action</th>
								<th className="py-3 pr-4 font-semibold">IP</th>
								<th className="py-3 pr-4 font-semibold">Domain</th>
								<th className="py-3 pr-4 font-semibold">Panel</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((row) => (
								<tr key={row.id} className="border-b border-white/5 text-slate-300 last:border-0">
									<td className="py-3 pr-4 text-xs text-slate-400">{formatDateTimeShort(row.updatedAt)}</td>
									<td className="py-3 pr-4 font-medium uppercase text-white">{row.serverId}</td>
									<td className="py-3 pr-4">
										<span className={`inline-flex rounded-lg border px-2 py-1 text-[11px] font-semibold ${getStatusClass(row.status)}`}>
											{row.actionLabel}
										</span>
									</td>
									<td className="py-3 pr-4 font-mono text-xs">
										{row.newIp || row.oldIp || 'unknown'}
									</td>
									<td className="py-3 pr-4">{row.domain || 'unknown'}</td>
									<td className="max-w-[220px] truncate py-3 pr-4 text-xs text-slate-400">{row.panel || row.message || 'unknown'}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</SectionPanel>
	);
}

function SelectField({
	label,
	name,
	value,
	onChange,
	options,
}: {
	label: string;
	name: string;
	value: string;
	onChange: (event: { target: { name: string; value: string; type?: string; checked?: boolean } }) => void;
	options: ReadonlyArray<{ value: string; label: string; description?: string }>;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const selectedOption = options.find((o) => o.value === value) || options[0];

	return (
		<div className="block relative">
			<span className="text-sm text-slate-300">{label}</span>
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="mt-2 flex w-full items-center justify-between rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition hover:border-white/20 focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
			>
				<span className="truncate">
					{selectedOption?.label} {selectedOption?.description ? `- ${selectedOption.description}` : ''}
				</span>
				<ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
			</button>

			{isOpen && (
				<>
					<div
						className="fixed inset-0 z-10"
						onClick={() => setIsOpen(false)}
					/>
					<div className="absolute z-20 mt-2 max-h-60 w-full overflow-auto rounded-lg border border-white/10 bg-slate-900 py-1 shadow-xl shadow-black/50 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
						{options.map((option) => (
							<button
								key={option.value}
								type="button"
								onClick={() => {
									onChange({ target: { name, value: option.value } });
									setIsOpen(false);
								}}
								className={`flex w-full flex-col items-start px-4 py-3 text-left transition hover:bg-white/5 ${
									value === option.value ? 'bg-sky-500/10 text-sky-400' : 'text-slate-200'
								}`}
							>
								<span className="font-medium">{option.label}</span>
								{option.description && (
									<span className="mt-0.5 text-xs text-slate-400">{option.description}</span>
								)}
							</button>
						))}
					</div>
				</>
			)}
		</div>
	);
}

function ResultCard({ stepNumber, result }: { stepNumber: number; result?: StepResult }) {
	if (!result) {
		return (
			<div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-slate-400">
				Run step {stepNumber} to see the live result here.
			</div>
		);
	}

	if (result.status === 'loading') {
		return (
			<div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-6 text-sm text-sky-100">
				<Loader2 className="mr-2 inline h-4 w-4 animate-spin align-[-2px]" />
				Running step {stepNumber}...
				{result.message ? <p className="mt-2 text-sky-100/80">{result.message}</p> : null}
			</div>
		);
	}

	if (result.status === 'success') {
		return (
			<div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-6 text-sm text-emerald-50">
				<CheckCircle2 className="mr-2 inline h-5 w-5 align-[-4px] text-emerald-300" />
				<div className="mt-2 font-semibold text-white">Step completed successfully</div>
				{result.message ? <p className="mt-2 text-emerald-100/90">{result.message}</p> : null}
				{result.newIp ? (
					<div className="mt-4 inline-flex rounded-full bg-emerald-950/50 px-3 py-1 font-mono text-xs text-emerald-200">
						New IP: {result.newIp}
					</div>
				) : null}
			</div>
		);
	}

	return (
		<div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-6 text-sm text-red-50">
			<XCircle className="mr-2 inline h-5 w-5 align-[-4px] text-red-300" />
			<div className="mt-2 font-semibold text-white">Step failed</div>
			{result.message ? <p className="mt-2 text-red-100/90">{result.message}</p> : null}
			<button
				type="button"
				onClick={() => window.location.reload()}
				className="mt-4 rounded-full border border-red-300/20 bg-red-950/40 px-4 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-950/60"
			>
				Reload page
			</button>
		</div>
	);
}
