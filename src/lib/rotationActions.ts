import fs from 'fs';
import path from 'path';
import { Client } from 'ssh2';
import { getRotateConfig } from '@/models/RotateConfig';
import VpnServer from '@/models/VpnServer';

const DO_API = 'https://api.digitalocean.com/v2';
const CF_API = 'https://api.cloudflare.com/client/v4';
const DROPLET_IP_WAIT_MS = 5 * 60 * 1000;
const DROPLET_IP_POLL_MS = 15000;
const XUI_READY_WAIT_MS = 5 * 60 * 1000;
const XUI_READY_POLL_MS = 10000;
const SSH_COMMAND_TIMEOUT_MS = 10 * 60 * 1000;
const XUI_INSTALL_TIMEOUT_MS = 12 * 60 * 1000;
const DEFAULT_XUI_INSTALL_VERSION = 'v3.2.8';

// ================= Helpers =================

type JsonObject = Record<string, any>;
type HeaderMap = Record<string, string>;
type ProgressReporter = (message: string) => void | Promise<void>;
type PanelProtocol = 'https' | 'http';
type BackupDatabaseKind = 'sqlite' | 'postgres';
type BackupCandidate = {
  kind: 'archive' | 'sqlite' | 'postgres';
  localPath: string;
  remotePath: string;
};
type ValidatedBackup = BackupCandidate & {
  databaseKind: BackupDatabaseKind;
  inboundCount: number;
};
type PanelTarget = {
  domain: string;
  port: number;
  panelPath: string;
  subPort?: number;
  protocolPorts?: Record<string, number | null | undefined>;
};

export async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function reportProgress(progress: ProgressReporter | undefined, message: string) {
  if (progress) await progress(message);
}

function shellQuote(value: string): string {
  const escaped = value.replace(/'/g, "'\\''");
  return `'${escaped}'`;
}

function getXuiInstallVersion(): string {
  const version = (process.env.XUI_INSTALL_VERSION || DEFAULT_XUI_INSTALL_VERSION).trim();
  if (!/^v\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Invalid XUI_INSTALL_VERSION "${version}". Expected a pinned tag like v3.2.8.`);
  }
  return version;
}

function hasNonEmptyFile(filePath: string): boolean {
  try {
    return fs.statSync(filePath).size > 0;
  } catch {
    return false;
  }
}

// Shell snippet to wait for apt/dpkg locks to clear on remote hosts. Insert
// ${aptWaitShell} at the top of remote command templates that run
// `apt-get` so the script will wait (with timeout) for package manager locks.
// This version will optionally kill stale apt processes (after a threshold)
// and performs basic recovery (`dpkg --configure -a`) to avoid blocking
// rotation. It prints diagnostics on timeout.
const aptWaitShell = `
apt_lock_holders() {
  lock_files="/var/lib/dpkg/lock-frontend /var/lib/dpkg/lock /var/lib/apt/lists/lock /var/cache/apt/archives/lock"
  holders=""
  if command -v fuser >/dev/null 2>&1; then
    holders=$(fuser $lock_files 2>/dev/null | tr ' ' '\\n' | awk 'NF' | sort -u || true)
  fi
  if [ -z "$holders" ]; then
    holders=$(pgrep -x "apt|apt-get|aptitude|dpkg|unattended-upgrade|unattended-upgrades" 2>/dev/null | sort -u || true)
  fi
  for pid in $holders; do
    [ "$pid" = "$$" ] && continue
    [ "$pid" = "$PPID" ] && continue
    printf '%s\\n' "$pid"
  done
}

prepare_apt() {
  max_wait=\${MAX_APT_WAIT_SECS:-900}
  kill_threshold=\${APT_KILL_OLD_SEC:-900}
  waited=0
  interval=5
  while :; do
    apt_pids=$(apt_lock_holders || true)
    if [ -z "$apt_pids" ]; then
      dpkg --configure -a || true
      return 0
    fi
    kill_list=""
    for pid in $apt_pids; do
      etimes=$(ps -o etimes= -p "$pid" 2>/dev/null || echo 0)
      if [ -n "$etimes" ] && [ "$etimes" -ge "$kill_threshold" ]; then
        kill_list="$kill_list $pid"
      fi
    done
    if [ -n "$kill_list" ]; then
      echo "KILL_OLD_APT:$kill_list"
      kill -TERM $kill_list 2>/dev/null || true
      sleep 5
      for pid in $kill_list; do
        if kill -0 "$pid" >/dev/null 2>&1; then
          kill -KILL "$pid" 2>/dev/null || true
        fi
      done
      dpkg --configure -a || true
      return 0
    fi
    if [ "$waited" -ge "$max_wait" ]; then
      echo "APT_LOCK_TIMEOUT"
      echo "Held by pids: $apt_pids"
      ps -o pid,etime,cmd -p $apt_pids 2>/dev/null || true
      if command -v lsof >/dev/null 2>&1; then
        lsof /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock /var/lib/apt/lists/lock /var/cache/apt/archives/lock 2>/dev/null || true
      fi
      return 1
    fi
    sleep $interval
    waited=$((waited+interval))
  done
}

run_apt() {
  tries=\${APT_RETRIES:-3}
  attempt=1
  while [ "$attempt" -le "$tries" ]; do
    wait_for_apt || return 1
    if apt-get -o DPkg::Lock::Timeout=120 "$@"; then
      return 0
    fi
    rc=$?
    echo "APT_COMMAND_FAILED attempt=$attempt rc=$rc: apt-get $*"
    dpkg --configure -a || true
    sleep $((attempt * 10))
    attempt=$((attempt+1))
  done
  return "$rc"
}

# Backwards-compatible wrapper
wait_for_apt() { prepare_apt "$@"; }
`;

function normalizePanelPath(value?: string): string {
  const raw = (value || '/mka').trim();
  if (!raw || raw === '/') return '/';
  return `/${raw.replace(/^\/+|\/+$/g, '')}`;
}

function getPanelBasePath(panelPath: string): string {
  if (panelPath === '/') return '';
  return panelPath.endsWith('/') ? panelPath.slice(0, -1) : panelPath;
}

function getPanelUiPath(panelPath: string): string {
  const basePath = getPanelBasePath(panelPath);
  return basePath ? `${basePath}/` : '/';
}

function isBackupFileForServer(fileName: string, serverName: string): boolean {
  const normalizedFile = fileName.toLowerCase();
  const normalizedServer = serverName.toLowerCase();
  return (
    normalizedFile === `${normalizedServer}.dump` ||
    normalizedFile === `${normalizedServer}.db` ||
    normalizedFile === `${normalizedServer}.tar.gz` ||
    normalizedFile.startsWith(`${normalizedServer}_`)
  );
}

function getBackupCandidates(backupsDir: string, serverName: string): BackupCandidate[] {
  const candidates: BackupCandidate[] = [];
  const archivePath = path.join(backupsDir, `${serverName}_backup.tar.gz`);
  const sqlitePath = path.join(backupsDir, `${serverName}_backup.db`);
  const postgresDumpPath = path.join(backupsDir, `${serverName}_backup.dump`);
  const postgresShortDumpPath = path.join(backupsDir, `${serverName}.dump`);

  if (hasNonEmptyFile(archivePath)) {
    candidates.push({
      kind: 'archive',
      localPath: archivePath,
      remotePath: '/root/backup.tar.gz',
    });
  }

  if (hasNonEmptyFile(sqlitePath)) {
    candidates.push({
      kind: 'sqlite',
      localPath: sqlitePath,
      remotePath: '/root/backup.db',
    });
  }

  if (hasNonEmptyFile(postgresDumpPath)) {
    candidates.push({
      kind: 'postgres',
      localPath: postgresDumpPath,
      remotePath: `/root/${serverName}_backup.dump`,
    });
  }

  if (hasNonEmptyFile(postgresShortDumpPath)) {
    candidates.push({
      kind: 'postgres',
      localPath: postgresShortDumpPath,
      remotePath: `/root/${serverName}.dump`,
    });
  }

  if (fs.existsSync(backupsDir)) {
    const extraArchiveFiles = fs.readdirSync(backupsDir)
      .filter((file) => file.toLowerCase().endsWith('.tar.gz'))
      .filter((file) => isBackupFileForServer(file, serverName))
      .map((file) => ({
        kind: 'archive' as const,
        localPath: path.join(backupsDir, file),
        remotePath: `/root/${file}`,
      }))
      .filter((candidate) => hasNonEmptyFile(candidate.localPath));

    for (const candidate of extraArchiveFiles) {
      if (!candidates.some((existing) => existing.localPath === candidate.localPath)) {
        candidates.push(candidate);
      }
    }

    const extraDumpFiles = fs.readdirSync(backupsDir)
      .filter((file) => file.toLowerCase().endsWith('.dump'))
      .filter((file) => isBackupFileForServer(file, serverName))
      .map((file) => ({
        kind: 'postgres' as const,
        localPath: path.join(backupsDir, file),
        remotePath: `/root/${file}`,
      }))
      .filter((candidate) => hasNonEmptyFile(candidate.localPath));

    for (const candidate of extraDumpFiles) {
      if (!candidates.some((existing) => existing.localPath === candidate.localPath)) {
        candidates.push(candidate);
      }
    }
  }

  return candidates;
}

const ensurePostgresRestoreToolsShell = `
ensure_pg_restore_tools() {
  if command -v pg_restore >/dev/null 2>&1; then
    pg_major=$(pg_restore --version | awk '{print $3}' | cut -d. -f1)
    if [ -n "$pg_major" ] && [ "$pg_major" -ge 16 ] 2>/dev/null; then
      return 0
    fi
  fi

  run_apt update -qq
  run_apt install -y -qq ca-certificates curl gnupg lsb-release >/tmp/bds-pgdg-prep.log 2>&1 || { tail -80 /tmp/bds-pgdg-prep.log; exit 1; }
  install -d /usr/share/postgresql-common/pgdg
  if [ ! -s /usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg ]; then
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg
  fi
  . /etc/os-release
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg] https://apt.postgresql.org/pub/repos/apt \${VERSION_CODENAME}-pgdg main" > /etc/apt/sources.list.d/pgdg.list
  run_apt update -qq
  run_apt install -y -qq postgresql-client-16 >/tmp/bds-pg-client-install.log 2>&1 || { tail -120 /tmp/bds-pg-client-install.log; exit 1; }
  ln -sf /usr/lib/postgresql/16/bin/pg_restore /usr/local/bin/pg_restore
  ln -sf /usr/lib/postgresql/16/bin/pg_dump /usr/local/bin/pg_dump
}
`;

function getRotationPanelPort(serverName: string): number {
  return serverName === 'sg4' ? 2053 : 8080;
}

async function getPanelTarget(serverName: string): Promise<PanelTarget> {
  const server = await VpnServer.findOne({ serverId: serverName }).lean().catch(() => null);
  return {
    domain: (server?.domain || `${serverName}.burmesedigital.store`).trim(),
    port: getRotationPanelPort(serverName),
    panelPath: normalizePanelPath(server?.panelPath),
    subPort: typeof server?.subPort === 'number' ? server.subPort : undefined,
    protocolPorts: server?.protocolPorts || undefined,
  };
}

function getFirewallPortsForServer(serverName: string, target: PanelTarget): number[] {
  const ports = new Set<number>();
  const addPort = (value?: number | null) => {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 65535) {
      ports.add(value);
    }
  };

  addPort(target.port);
  addPort(target.subPort);

  for (const port of Object.values(target.protocolPorts || {})) {
    addPort(port);
  }

  if (normalizeServerName(serverName) === 'sg4') {
    // Cloudflare orange-cloud HTTPS proxy ports used for sg4 panel, sub links, and inbounds.
    [443, 2053, 2083, 2087, 2096, 8443].forEach(addPort);
  }

  return [...ports].sort((a, b) => a - b);
}

function shouldProxyDnsForServer(serverName: string): boolean {
  return normalizeServerName(serverName) === 'sg4';
}

function cleanSecret(value?: string): string {
  return (value || '')
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^Authorization:\s*Bearer\s+/i, '')
    .trim();
}

function splitConfigList(value?: string): string[] {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseDropletImage(value?: string): string | number {
  const raw = String(value || '').trim();
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw || 'ubuntu-22-04-x64';
}

function parseDropletSshKeys(value?: string): Array<string | number> {
  return splitConfigList(value).map((item) => (/^\d+$/.test(item) ? Number(item) : item));
}

function parseJsonObject(value?: string, label = 'JSON'): JsonObject | null {
  const raw = String(value || '').trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${label} must be a JSON object.`);
    }
    return parsed as JsonObject;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} is invalid: ${message}`);
  }
}

function getConfiguredDropletRegion(serverName: string, config: { dropletRegion?: string }): string {
  const configuredRegion = String(config.dropletRegion || '').trim();
  if (configuredRegion) return configuredRegion;
  return serverName === 'sg4' ? 'nyc1' : 'sgp1';
}

function buildDropletUserData(config: { dropletUserData?: string }): string {
  const baseUserData = `#cloud-config
chpasswd:
  list: |
    root:Mka@2016Omk
  expire: False
ssh_pwauth: True
`;
  const customUserData = String(config.dropletUserData || '').trim();

  return customUserData
    ? `${baseUserData}\n# Admin custom cloud-init\n${customUserData}\n`
    : baseUserData;
}

function buildDropletCreatePayload(
  serverName: string,
  config: {
    dropletRegion?: string;
    dropletSize?: string;
    dropletImage?: string;
    dropletBackups?: boolean;
    dropletIpv6?: boolean;
    dropletMonitoring?: boolean;
    dropletPublicNetworking?: boolean;
    dropletAgent?: boolean;
    dropletSshKeys?: string;
    dropletTags?: string;
    dropletVpcUuid?: string;
    dropletVolumes?: string;
    dropletUserData?: string;
    dropletBackupPolicy?: string;
  }
) {
  const region = getConfiguredDropletRegion(serverName, config);
  const payload: JsonObject = {
    name: serverName,
    region,
    size: config.dropletSize || 's-1vcpu-1gb',
    image: parseDropletImage(config.dropletImage),
    backups: !!config.dropletBackups,
    ipv6: !!config.dropletIpv6,
    monitoring: config.dropletMonitoring !== false,
    with_droplet_agent: config.dropletAgent !== false,
    user_data: buildDropletUserData(config),
  };

  if (config.dropletPublicNetworking === false) {
    payload.public_networking = false;
    payload.ipv6 = false;
  }

  const sshKeys = parseDropletSshKeys(config.dropletSshKeys);
  if (sshKeys.length > 0) payload.ssh_keys = sshKeys;

  const tags = splitConfigList(config.dropletTags);
  if (tags.length > 0) payload.tags = tags;

  const volumes = splitConfigList(config.dropletVolumes);
  if (volumes.length > 0) payload.volumes = volumes;

  const vpcUuid = String(config.dropletVpcUuid || '').trim();
  if (vpcUuid) payload.vpc_uuid = vpcUuid;

  const backupPolicy = parseJsonObject(config.dropletBackupPolicy, 'Droplet backup policy');
  if (backupPolicy) payload.backup_policy = backupPolicy;

  return payload;
}

function normalizeServerName(value?: string): string {
  return (value || '').trim().toLowerCase();
}

function getDoTokenForServer(serverName: string, config: {
  doToken1?: string;
  doToken2?: string;
  doToken3?: string;
  doToken4?: string;
  doTokens?: Array<{
    id?: string;
    label?: string;
    token?: string;
    enabled?: boolean;
  }>;
  serverLinks?: Array<{
    id?: string;
    serverName?: string;
    tokenId?: string;
    enabled?: boolean;
  }>;
}): string {
  const normalized = normalizeServerName(serverName);
  const configuredTokens = (Array.isArray(config.doTokens) ? config.doTokens : [])
    .map((entry, index) => ({
      id: normalizeServerName(entry.id || `do-token-${index + 1}`) || `do-token-${index + 1}`,
      label: String(entry.label || `Token ${index + 1}`).trim() || `Token ${index + 1}`,
      token: cleanSecret(entry.token),
      enabled: entry.enabled !== false,
    }))
    .filter((entry) => entry.token && entry.enabled);

  const legacyTokens = [
    { id: 'do-token-1', token: cleanSecret(config.doToken1) },
    { id: 'do-token-2', token: cleanSecret(config.doToken2) },
    { id: 'do-token-3', token: cleanSecret(config.doToken3) },
    { id: 'do-token-4', token: cleanSecret(config.doToken4) },
  ].filter((entry) => entry.token);

  const tokenPool = configuredTokens.length > 0 ? configuredTokens : legacyTokens;
  const fallbackTokens = tokenPool.map((entry) => entry.token).filter(Boolean);

  const select = (...candidates: Array<string | undefined>) => {
    for (const candidate of candidates) {
      const token = cleanSecret(candidate);
      if (token) return token;
    }
    return fallbackTokens[0] || '';
  };

  const serverLink = Array.isArray(config.serverLinks)
    ? config.serverLinks.find((entry) => normalizeServerName(entry.serverName) === normalized && entry.enabled !== false)
    : undefined;

  if (serverLink?.tokenId) {
    const linked = tokenPool.find((entry) => normalizeServerName(entry.id) === normalizeServerName(serverLink.tokenId));
    if (linked?.token) return linked.token;
  }

  const token1 = tokenPool[0]?.token || cleanSecret(config.doToken1);
  const token2 = tokenPool[1]?.token || cleanSecret(config.doToken2);
  const token3 = tokenPool[2]?.token || cleanSecret(config.doToken3);
  const token4 = tokenPool[3]?.token || cleanSecret(config.doToken4);

  if (['jan', 'sg1', 'sg4'].includes(normalized)) return select(token1, token3, token2, token4);
  if (['sg2', 'sg3'].includes(normalized)) return select(token2, token4, token1, token3);
  if (normalized === 'backup') return select(token3, token4, token2, token1);

  return select(token4, token3, token2, token1);
}

function looksLikeGlobalApiKey(value: string): boolean {
  return /^[a-f0-9]{32,64}$/i.test(value);
}

async function readJsonResponse(res: Response, label: string): Promise<JsonObject> {
  const text = await res.text();
  let data: JsonObject;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    const preview = text.replace(/\s+/g, ' ').slice(0, 160);
    throw new Error(`${label}: Expected JSON but received HTTP ${res.status} ${res.statusText || ''}: ${preview || '(empty response)'}`);
  }

  if (!res.ok) {
    const message =
      data.errors?.[0]?.message ||
      data.message ||
      data.error ||
      `HTTP ${res.status} ${res.statusText || 'request failed'}`;
    throw new Error(`${label}: ${message}`);
  }

  return data;
}

function getCloudflareAuthCandidates(config: { cfToken?: string; cfEmail?: string }): Array<{ label: string; headers: HeaderMap }> {
  const cfToken = cleanSecret(config.cfToken);
  const cfEmail = (config.cfEmail || '').trim();

  if (!cfToken) {
    throw new Error('Cloudflare token/key is missing. Save a valid Cloudflare API Token or Global API Key first.');
  }

  const apiTokenCandidate = {
    label: 'API Token',
    headers: {
      Authorization: `Bearer ${cfToken}`,
      'Content-Type': 'application/json',
    },
  };

  if (cfEmail) {
    const globalKeyCandidate = {
      label: 'Global API Key',
      headers: {
        'X-Auth-Email': cfEmail,
        'X-Auth-Key': cfToken,
        'Content-Type': 'application/json',
      },
    };

    return looksLikeGlobalApiKey(cfToken)
      ? [globalKeyCandidate, apiTokenCandidate]
      : [apiTokenCandidate, globalKeyCandidate];
  }

  return [apiTokenCandidate];
}

async function fetchCloudflareJson(
  pathOrUrl: string,
  init: RequestInit,
  headers: HeaderMap,
  label: string
): Promise<JsonObject> {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${CF_API}${pathOrUrl}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers || {}),
    },
  });
  const data = await readJsonResponse(res, label);

  if (data.success === false) {
    const message = data.errors?.[0]?.message || 'Unknown Cloudflare error';
    throw new Error(`${label}: CF Error: ${message}`);
  }

  return data;
}

function getCloudflareZoneCandidates(domain?: string): string[] {
  const labels = String(domain || 'burmesedigital.store')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split('.')
    .filter(Boolean);

  const candidates: string[] = [];
  for (let index = 0; index <= labels.length - 2; index += 1) {
    candidates.push(labels.slice(index).join('.'));
  }

  return candidates.length > 0 ? candidates : ['burmesedigital.store'];
}

async function resolveCloudflareZone(config: { cfToken?: string; cfEmail?: string }, domain?: string) {
  const candidates = getCloudflareAuthCandidates(config);
  const errors: string[] = [];
  const zoneCandidates = getCloudflareZoneCandidates(domain);

  for (const candidate of candidates) {
    for (const zoneName of zoneCandidates) {
      try {
        const zonesData = await fetchCloudflareJson(
          `/zones?name=${encodeURIComponent(zoneName)}`,
          { method: 'GET' },
          candidate.headers,
          `Cloudflare Zones (${candidate.label})`
        );

        if (!zonesData.result?.[0]?.id) {
          throw new Error(`Cloudflare Zones (${candidate.label}): Zone ${zoneName} was not found or token lacks Zone Read permission`);
        }

        return {
          zoneId: zonesData.result[0].id as string,
          zoneName,
          headers: candidate.headers,
          authLabel: candidate.label,
        };
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }
  }

  const emailHint = (config.cfEmail || '').trim()
    ? ''
    : ' | Global API Key requires the Cloudflare account email in rotation config.';
  throw new Error(`${errors.join(' | ')}${emailHint}`);
}

async function sendFileTg(botToken: string, chatId: string, filePath: string, caption: string) {
  const buffer = await fs.promises.readFile(filePath);
  const blob = new Blob([buffer]);
  
  // Use native FormData which works correctly with Next.js native fetch
  const form = new globalThis.FormData();
  form.append('chat_id', chatId);
  form.append('caption', caption);
  form.append('document', blob, path.basename(filePath));

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description);
}

async function getDropletPublicIp(doToken: string, serverName: string): Promise<string | null> {
  const res = await fetch(`${DO_API}/droplets`, {
    headers: { 'Authorization': `Bearer ${doToken}`, 'Content-Type': 'application/json' }
  });
  const data = await res.json();
  const droplet = data.droplets?.find((d: any) => d.name === serverName);
  return droplet?.networks?.v4?.find((n: any) => n.type === 'public')?.ip_address || null;
}

async function waitForDropletPublicIp(doToken: string, serverName: string): Promise<string> {
  const deadline = Date.now() + DROPLET_IP_WAIT_MS;

  while (Date.now() < deadline) {
    const ip = await getDropletPublicIp(doToken, serverName);
    if (ip) return ip;
    await sleep(DROPLET_IP_POLL_MS);
  }

  throw new Error('Could not find public IP for new droplet. Ensure it is fully created.');
}

function sftpDownload(host: string, remotePath: string, localPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.sftp((err: any, sftp: any) => {
        if (err) { conn.end(); return reject(err); }
        sftp.fastGet(remotePath, localPath, {}, (downloadErr: any) => {
          conn.end();
          if (downloadErr) reject(downloadErr);
          else resolve();
        });
      });
    }).on('error', reject).connect({
      host, 
      port: 22, 
      username: 'root',
      password: 'Mka@2016Omk', // Hardcoded universal password as requested
      readyTimeout: 20000
    });
  });
}

// ================= Workflow Actions =================

// Step 2: Backup Function
export async function actionBackupServer(serverName: string) {
  const config = await getRotateConfig();
  const doToken = getDoTokenForServer(serverName, config);
  const panelTarget = await getPanelTarget(serverName);
  
  // 1. Get current IP from DO
  const res = await fetch(`${DO_API}/droplets`, {
    headers: { 'Authorization': `Bearer ${doToken}`, 'Content-Type': 'application/json' }
  });
  const data = await res.json();
  const droplet = data.droplets?.find((d: any) => d.name === serverName);
  
  if (!droplet) throw new Error(`Droplet ${serverName} not found in DigitalOcean account.`);
  const oldIp = droplet.networks.v4.find((n: any) => n.type === 'public')?.ip_address;
  if (!oldIp) throw new Error("Could not find public IP for current droplet.");

  // 2. Backup DB and SSL Certs via SSH into a tar.gz
  const backupsDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }
  const localDbPath = path.join(backupsDir, `${serverName}_backup.tar.gz`);
  
  // Backup the active database backend. SQLite needs a short stop/checkpoint,
  // while PostgreSQL must be dumped with pg_dump because x-ui.db is stale there.
  const tarCmd = `
set -e
backup=/root/${serverName}_backup.tar.gz
workdir=$(mktemp -d)
restart_needed=0
cleanup() {
  rm -rf "$workdir"
  if [ "$restart_needed" = "1" ]; then
    systemctl start x-ui >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT
db_type=sqlite
if [ -f /etc/default/x-ui ]; then
  db_type=$(grep -E '^XUI_DB_TYPE=' /etc/default/x-ui | tail -1 | cut -d= -f2- || true)
fi
db_type=\${db_type:-sqlite}
cd /
rm -f "$backup"
if [ "$db_type" = "postgres" ]; then
  [ -f /etc/default/x-ui ] || { echo "PostgreSQL config /etc/default/x-ui is missing"; exit 1; }
  set -a
  . /etc/default/x-ui
  set +a
  [ -n "\${XUI_DB_DSN:-}" ] || { echo "XUI_DB_DSN is missing for PostgreSQL backup"; exit 1; }
  command -v pg_dump >/dev/null 2>&1 || { echo "pg_dump is missing on the server"; exit 1; }
  pg_dump --format=custom --no-owner --no-privileges --dbname="$XUI_DB_DSN" --file="$workdir/x-ui-postgres.dump"
  cp /etc/default/x-ui "$workdir/x-ui-default.env"
  tar -czf "$backup" \
    -C "$workdir" x-ui-postgres.dump x-ui-default.env \
    $([ -d "root/cert" ] && echo "-C / root/cert") \
    $([ -d "root/.acme.sh" ] && echo "-C / root/.acme.sh")
  tar -tzf "$backup" | grep -qx 'x-ui-postgres.dump'
else
  if systemctl is-active --quiet x-ui; then restart_needed=1; fi
  systemctl stop x-ui >/dev/null 2>&1 || true
  sleep 3
  [ -s /etc/x-ui/x-ui.db ] || { echo "x-ui.db is missing or empty"; exit 1; }
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 /etc/x-ui/x-ui.db 'PRAGMA wal_checkpoint(TRUNCATE);' >/dev/null 2>&1 || true
  fi
  tar -czf "$backup" \
    etc/x-ui/x-ui.db \
    $([ -f "etc/x-ui/x-ui.db-wal" ] && echo "etc/x-ui/x-ui.db-wal") \
    $([ -f "etc/x-ui/x-ui.db-shm" ] && echo "etc/x-ui/x-ui.db-shm") \
    $([ -d "root/cert" ] && echo "root/cert") \
    $([ -d "root/.acme.sh" ] && echo "root/.acme.sh")
  tar -tzf "$backup" | grep -qx 'etc/x-ui/x-ui.db'
fi
`;
  await execSsh(oldIp, tarCmd);
  
  // Verify the file was created
  const checkTar = await execSsh(oldIp, `ls -l /root/${serverName}_backup.tar.gz || echo "NOT_FOUND"`);
  if (checkTar.includes("NOT_FOUND")) {
    throw new Error("Backup process failed to create the tar.gz file. The x-ui database may be missing on the server.");
  }
  
  await sftpDownload(oldIp, `/root/${serverName}_backup.tar.gz`, localDbPath);
  
  // Clean up remote tar
  await execSsh(oldIp, `rm -f /root/${serverName}_backup.tar.gz`);

  // 3. Send to Telegram
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChatId = process.env.TELEGRAM_CHANNEL_ID || process.env.TELEGRAM_CHAT_ID;
  if (!tgToken || !tgChatId) throw new Error("Telegram Bot Token or Chat ID not found in .env");

  await sendFileTg(tgToken, tgChatId, localDbPath, `🔄 Backup DB for [ ${serverName} ] before rotation\nTimestamp: ${new Date().toISOString()}`);

  return {
    success: true,
    message: `Database downloaded and sent to Telegram! Old IP was ${oldIp}`,
    oldIp,
    domain: panelTarget.domain,
    panelUrl: `https://${panelTarget.domain}:${panelTarget.port}${getPanelUiPath(panelTarget.panelPath)}`,
  };
}

// Step 3: Recreate VPS
export async function actionRecreateServer(serverName: string) {
  const config = await getRotateConfig();
  const doToken = getDoTokenForServer(serverName, config);
  const dropletPayload = buildDropletCreatePayload(serverName, config);
  const region = dropletPayload.region;

  // 1. Fetch current droplets to find ID
  const listRes = await fetch(`${DO_API}/droplets`, {
    headers: { 'Authorization': `Bearer ${doToken}`, 'Content-Type': 'application/json' }
  });
  const listData = await listRes.json();
  const oldDroplet = listData.droplets?.find((d: any) => d.name === serverName);
  const oldIp = oldDroplet?.networks?.v4?.find((n: any) => n.type === 'public')?.ip_address || null;

  // 2. Delete old droplet if exists
  if (oldDroplet) {
    await fetch(`${DO_API}/droplets/${oldDroplet.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${doToken}`, 'Content-Type': 'application/json' }
    });
    // Wait 35 seconds to prevent DO limit errors
    await sleep(35000); 
  }

  // 3. Create new droplet
  const createRes = await fetch(`${DO_API}/droplets`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${doToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(dropletPayload)
  });

  const createData = await createRes.json();
  if (!createRes.ok) {
    throw new Error(createData.message || "Failed to create new droplet");
  }

  return {
    success: true,
    message: `Droplet ${serverName} recreated successfully in ${region}`,
    oldIp,
    region,
    size: dropletPayload.size,
    image: String(dropletPayload.image),
    dropletId: createData.droplet?.id || null,
  };
}

// Step 4: Update DNS
export async function actionUpdateDNS(serverName: string) {
  const config = await getRotateConfig();
  const doToken = getDoTokenForServer(serverName, config);
  const panelTarget = await getPanelTarget(serverName);
  const DOMAIN = panelTarget.domain;

  // Get New IP
  let newIp: string;
  try {
    newIp = await waitForDropletPublicIp(doToken, serverName);
  } catch (err: any) {
    throw new Error(`DigitalOcean Fetch Error: ${err.message}`);
  }

  const { zoneId, headers: cfHeaders, authLabel } = await resolveCloudflareZone(config, DOMAIN);

  // Get DNS Record ID
  let record: any;
  let dnsData: any;
  try {
    dnsData = await fetchCloudflareJson(
      `/zones/${zoneId}/dns_records?type=A&name=${encodeURIComponent(DOMAIN)}`,
      { method: 'GET' },
      cfHeaders,
      `Cloudflare DNS Records (${authLabel})`
    );
    record = dnsData.result?.[0];
  } catch(err: any) {
    throw new Error(`Cloudflare DNS Records Error: ${err.message}`);
  }

  const proxied = shouldProxyDnsForServer(serverName);
  const body = JSON.stringify({ type: 'A', name: DOMAIN, content: newIp, proxied, ttl: proxied ? 1 : 60 });

  // Update or Create
  try {
    if (record) {
      await fetchCloudflareJson(
        `/zones/${zoneId}/dns_records/${record.id}`,
        { method: 'PUT', body },
        cfHeaders,
        `Cloudflare Update DNS (${authLabel})`
      );
    } else {
      await fetchCloudflareJson(
        `/zones/${zoneId}/dns_records`,
        { method: 'POST', body },
        cfHeaders,
        `Cloudflare Create DNS (${authLabel})`
      );
    }
  } catch(err: any) {
    throw new Error(`Cloudflare Update DNS Error: ${err.message}`);
  }

  return {
    success: true,
    message: `DNS updated successfully via ${authLabel}: ${DOMAIN} -> ${newIp}${proxied ? ' (Cloudflare proxied)' : ''}`,
    newIp,
    domain: DOMAIN,
    panelUrl: `https://${DOMAIN}:${panelTarget.port}${getPanelUiPath(panelTarget.panelPath)}`,
  };
}

// SSH execution helper 
function execSsh(host: string, command: string, timeoutMs = SSH_COMMAND_TIMEOUT_MS): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let output = '';
    let settled = false;
    let timer: NodeJS.Timeout | null = null;

    const appendOutput = (data: any) => {
      output += data?.toString?.() || String(data);
      if (output.length > 20000) {
        output = output.slice(-20000);
      }
    };

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      conn.end();
      if (error) reject(error);
      else resolve(output);
    };

    conn.on('ready', () => {
      conn.exec(command, (err: any, stream: any) => {
        if (err) return finish(err);
        timer = setTimeout(() => {
          finish(new Error(`SSH command timed out after ${Math.round(timeoutMs / 1000)} seconds. Output: ${output || '(no output)'}`));
        }, timeoutMs);
        stream.on('close', (code: any) => {
          if (code !== 0) return finish(new Error(`Command failed with code ${code}. Output: ${output}`));
          finish();
        }).on('data', appendOutput).stderr.on('data', appendOutput);
      });
    }).on('error', (err: Error) => finish(err)).connect({ host, port: 22, username: 'root', password: 'Mka@2016Omk', readyTimeout: 20000 });
  });
}

async function isXuiInstalled(host: string): Promise<boolean> {
  try {
    await execSsh(host, '[ -x /usr/local/x-ui/x-ui ] || command -v x-ui >/dev/null 2>&1', 30000);
    return true;
  } catch {
    return false;
  }
}

async function installFail2BanIpLimit(host: string, progress?: ProgressReporter) {
  await reportProgress(progress, 'Installing Fail2Ban and configuring 3x-ui IP Limit jail...');
  const script = `
set -e
export DEBIAN_FRONTEND=noninteractive

${aptWaitShell}

if command -v apt-get >/dev/null 2>&1; then
  export NEEDRESTART_MODE=a
  export MAX_APT_WAIT_SECS=120
  export APT_KILL_OLD_SEC=900
  wait_for_apt || { echo "Could not acquire apt lock"; exit 1; }
  run_apt update
  wait_for_apt || { echo "Could not acquire apt lock"; exit 1; }
  run_apt install -y fail2ban nftables iptables python3-pip
  python3 -m pip install pyasynchat --break-system-packages >/dev/null 2>&1 || true
elif command -v dnf >/dev/null 2>&1; then
  dnf -y install fail2ban nftables iptables
elif command -v yum >/dev/null 2>&1; then
  yum -y install epel-release || true
  yum -y install fail2ban nftables iptables
elif command -v apk >/dev/null 2>&1; then
  apk add fail2ban nftables iptables
else
  echo "Unsupported OS: cannot install fail2ban automatically"
  exit 1
fi

mkdir -p /var/log/x-ui /etc/fail2ban/jail.d /etc/fail2ban/filter.d /etc/fail2ban/action.d
touch /var/log/x-ui/3xipl.log /var/log/x-ui/3xipl-banned.log

if [ -f /etc/fail2ban/fail2ban.conf ]; then
  sed -i 's/#allowipv6 = auto/allowipv6 = auto/g' /etc/fail2ban/fail2ban.conf || true
fi

for file in /etc/fail2ban/jail.conf /etc/fail2ban/jail.local; do
  if [ -f "$file" ]; then
    sed -i '/^\\[3x-ipl\\]/,/^$/d' "$file" || true
  fi
done

cat > /etc/fail2ban/jail.d/3x-ipl.conf <<'EOF'
[3x-ipl]
enabled=true
backend=auto
filter=3x-ipl
action=3x-ipl
logpath=/var/log/x-ui/3xipl.log
maxretry=1
findtime=32
bantime=30m
EOF

cat > /etc/fail2ban/filter.d/3x-ipl.conf <<'EOF'
[Definition]
datepattern = ^%%Y/%%m/%%d %%H:%%M:%%S
failregex   = \\[LIMIT_IP\\]\\s*Email\\s*=\\s*<F-USER>.+</F-USER>\\s*\\|\\|\\s*Disconnecting OLD IP\\s*=\\s*<ADDR>\\s*\\|\\|\\s*Timestamp\\s*=\\s*\\d+
ignoreregex =
EOF

cat > /etc/fail2ban/action.d/3x-ipl.conf <<'EOF'
[INCLUDES]
before = iptables-allports.conf

[Definition]
actionstart = <iptables> -N f2b-<name>
              <iptables> -A f2b-<name> -j <returntype>
              <iptables> -I <chain> -p <protocol> -j f2b-<name>

actionstop = <iptables> -D <chain> -p <protocol> -j f2b-<name>
             <actionflush>
             <iptables> -X f2b-<name>

actioncheck = <iptables> -n -L <chain> | grep -q 'f2b-<name>[ \\t]'

actionban = <iptables> -I f2b-<name> 1 -s <ip> -j <blocktype>
            echo "$(date +"%%Y/%%m/%%d %%H:%%M:%%S")   BAN   [Email] = <F-USER> [IP] = <ip> banned for <bantime> seconds." >> /var/log/x-ui/3xipl-banned.log

actionunban = <iptables> -D f2b-<name> -s <ip> -j <blocktype>
              echo "$(date +"%%Y/%%m/%%d %%H:%%M:%%S")   UNBAN   [Email] = <F-USER> [IP] = <ip> unbanned." >> /var/log/x-ui/3xipl-banned.log

[Init]
name = default
protocol = tcp
chain = INPUT
EOF

if command -v systemctl >/dev/null 2>&1; then
  systemctl enable fail2ban
  systemctl restart fail2ban
else
  service fail2ban restart
fi

sleep 2
fail2ban-client status 3x-ipl
`;
  await execSsh(host, `timeout 3m bash -lc ${shellQuote(script)}`, 4 * 60 * 1000);
  await reportProgress(progress, 'Fail2Ban IP Limit jail is active.');
}

async function restartPanelAndXray(host: string, progress?: ProgressReporter) {
  await reportProgress(progress, 'Restarting 3x-ui panel (CLI option 13)...');
  await execSsh(
    host,
    '(command -v x-ui >/dev/null 2>&1 && timeout 90s x-ui restart) || systemctl restart x-ui',
    120000
  );
  await sleep(8000);

  await reportProgress(progress, 'Restarting Xray core (CLI option 14)...');
  await execSsh(
    host,
    '(command -v x-ui >/dev/null 2>&1 && timeout 90s x-ui restart-xray) || systemctl reload x-ui || systemctl restart x-ui',
    120000
  );
  await sleep(5000);
}

async function detectPanelProtocol(host: string, port: number, panelPath: string): Promise<PanelProtocol> {
  const urlPath = getPanelUiPath(panelPath);

  for (const protocol of ['https', 'http'] as const) {
    try {
      await execSsh(host, `curl -kfsS --max-time 8 -o /dev/null ${shellQuote(`${protocol}://127.0.0.1:${port}${urlPath}`)}`, 20000);
      return protocol;
    } catch {
      // Try the next protocol before declaring the panel unavailable.
    }
  }

  throw new Error(`x-ui service is active, but the panel did not respond on port ${port}${urlPath} via HTTPS or HTTP after restart.`);
}

async function getRestoredInboundCount(
  host: string,
  protocol: PanelProtocol,
  port: number,
  panelPath: string,
  username: string,
  password: string
): Promise<number> {
  const basePath = getPanelBasePath(panelPath);
  const baseUrl = `${protocol}://127.0.0.1:${port}${basePath}`;
  const loginBody = JSON.stringify({ username, password });
  const command = `
set -e
cookie=$(mktemp)
cleanup() { rm -f "$cookie"; }
trap cleanup EXIT
csrfResponse=$(curl -kfsS --max-time 15 -c "$cookie" -b "$cookie" \
  -H 'Accept: application/json' \
  ${shellQuote(`${baseUrl}/csrf-token`)})
csrfToken=$(printf '%s' "$csrfResponse" | sed -n 's/.*"obj":"\\([^"]*\\)".*/\\1/p')
if [ -z "$csrfToken" ]; then
  echo "Could not get CSRF token: $csrfResponse"
  exit 1
fi
curl -kfsS --max-time 15 -b "$cookie" -c "$cookie" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -H 'X-Requested-With: XMLHttpRequest' \
  -H "X-CSRF-Token: $csrfToken" \
  --data ${shellQuote(loginBody)} \
  ${shellQuote(`${baseUrl}/login`)} >/dev/null
curl -kfsS --max-time 15 -b "$cookie" \
  -H 'Accept: application/json' \
  ${shellQuote(`${baseUrl}/panel/api/inbounds/list`)} | python3 -c ${shellQuote(`
import json
import sys

data = json.load(sys.stdin)
if not data.get("success") or not isinstance(data.get("obj"), list):
    raise SystemExit(data.get("msg") or "Panel API did not return an inbound list")

print(f"INBOUND_COUNT:{len(data['obj'])}")
`)}
`;
  const output = await execSsh(host, command, 30000);
  const match = output.match(/INBOUND_COUNT:(\d+)/);
  if (!match) {
    throw new Error(`Panel API did not return an inbound count after restore: ${output.slice(0, 300) || '(empty)'}`);
  }

  return Number(match[1]);
}

async function getRestoredDatabaseInboundCount(host: string): Promise<number> {
  const command = `
set -e
[ -f /etc/default/x-ui ] || { echo "XUI_ENV_MISSING"; exit 1; }
set -a
. /etc/default/x-ui
set +a
[ "\${XUI_DB_TYPE:-}" = "postgres" ] || { echo "XUI_DB_TYPE_NOT_POSTGRES"; exit 1; }
[ -n "\${XUI_DB_DSN:-}" ] || { echo "XUI_DB_DSN_MISSING"; exit 1; }
psql "$XUI_DB_DSN" -tAc "select 'INBOUND_COUNT:' || count(*) from inbounds;"
`;
  const output = await execSsh(host, command, 30000);
  const match = output.match(/INBOUND_COUNT:(\d+)/);
  if (!match) {
    throw new Error(`PostgreSQL did not return an inbound count after restore: ${output.slice(0, 300) || '(empty)'}`);
  }

  return Number(match[1]);
}

async function inspectRemoteBackup(host: string, backup: BackupCandidate): Promise<{ databaseKind: BackupDatabaseKind; inboundCount: number }> {
  let command: string;

  if (backup.kind === 'postgres') {
    command = `
set -e
backup=${shellQuote(backup.remotePath)}
[ -s "$backup" ] || { echo "BACKUP_DB_MISSING"; exit 1; }
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a
${aptWaitShell}
${ensurePostgresRestoreToolsShell}
export MAX_APT_WAIT_SECS=300
wait_for_apt || { echo "Could not acquire apt lock"; exit 1; }
ensure_pg_restore_tools
pg_restore --data-only --table=inbounds --file=- "$backup" 2>/dev/null | python3 -c 'import sys
count = 0
in_copy = False
for line in sys.stdin:
    if line.startswith("COPY ") and "inbounds" in line:
        in_copy = True
        continue
    if in_copy:
        if line.strip() == "\\\\.":
            break
        count += 1
print(f"BACKUP_KIND:postgres\\nINBOUND_COUNT:{count}")'
`;
  } else {
    const archivePrepare = backup.kind === 'archive'
    ? `
workdir=$(mktemp -d)
cleanup() { rm -rf "$workdir"; }
trap cleanup EXIT
mkdir -p "$workdir"
tar -tzf ${shellQuote(backup.remotePath)} > "$workdir/list.txt"
if grep -qx 'x-ui-postgres.dump' "$workdir/list.txt"; then
  tar -xzf ${shellQuote(backup.remotePath)} -C "$workdir" x-ui-postgres.dump
  [ -s "$workdir/x-ui-postgres.dump" ] || { echo "BACKUP_DB_MISSING"; exit 1; }
  export DEBIAN_FRONTEND=noninteractive
  export NEEDRESTART_MODE=a
  ${aptWaitShell}
  ${ensurePostgresRestoreToolsShell}
  export MAX_APT_WAIT_SECS=300
  wait_for_apt || { echo "Could not acquire apt lock"; exit 1; }
  ensure_pg_restore_tools
  pg_restore --data-only --table=inbounds --file=- "$workdir/x-ui-postgres.dump" 2>/dev/null | python3 -c 'import sys
count = 0
in_copy = False
for line in sys.stdin:
    if line.startswith("COPY ") and "inbounds" in line:
        in_copy = True
        continue
    if in_copy:
        if line.strip() == "\\\\.":
            break
        count += 1
print(f"BACKUP_KIND:postgres\\nINBOUND_COUNT:{count}")'
  exit 0
fi
grep -qx 'etc/x-ui/x-ui.db' "$workdir/list.txt"
tar -xzf ${shellQuote(backup.remotePath)} -C "$workdir" etc/x-ui/x-ui.db
tar -xzf ${shellQuote(backup.remotePath)} -C "$workdir" etc/x-ui/x-ui.db-wal 2>/dev/null || true
tar -xzf ${shellQuote(backup.remotePath)} -C "$workdir" etc/x-ui/x-ui.db-shm 2>/dev/null || true
db="$workdir/etc/x-ui/x-ui.db"
`
    : `
db=${shellQuote(backup.remotePath)}
`;
    command = `
set -e
${archivePrepare}
[ -s "$db" ] || { echo "BACKUP_DB_MISSING"; exit 1; }
python3 - "$db" <<'PY'
import sqlite3
import sys

db_path = sys.argv[1]
conn = sqlite3.connect(db_path)
try:
    table_exists = conn.execute(
        "select count(*) from sqlite_master where type='table' and name='inbounds'"
    ).fetchone()[0]
    if not table_exists:
        print("INBOUND_COUNT:0")
        sys.exit(0)

    count = conn.execute("select count(*) from inbounds").fetchone()[0]
    print(f"BACKUP_KIND:sqlite\\nINBOUND_COUNT:{count}")
    sys.exit(0)
finally:
    conn.close()
PY
`;
  }

  const output = await execSsh(host, command, 30000);
  const kindMatch = output.match(/BACKUP_KIND:(sqlite|postgres)/);
  const match = output.match(/INBOUND_COUNT:(\d+)/);
  if (!kindMatch || !match) {
    throw new Error(`Could not verify backup database. Output: ${output.slice(0, 300) || '(empty)'}`);
  }

  const count = Number(match[1]);
  if (count < 1) {
    throw new Error('Backup database contains 0 inbounds.');
  }

  return { databaseKind: kindMatch[1] as BackupDatabaseKind, inboundCount: count };
}

// SFTP Upload helper
function sftpUpload(host: string, localPath: string, remotePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.sftp((err: any, sftp: any) => {
        if (err) { conn.end(); return reject(err); }
        sftp.fastPut(localPath, remotePath, (err: any) => {
          conn.end();
          if (err) reject(err);
          else resolve();
        });
      });
    }).on('error', reject).connect({ host, port: 22, username: 'root', password: 'Mka@2016Omk', readyTimeout: 20000 });
  });
}

// Step 5: Install & Restore
export async function actionInstall3xUI(serverName: string, progress?: ProgressReporter) {
  const config = await getRotateConfig();
  const doToken = getDoTokenForServer(serverName, config);
  const panelTarget = await getPanelTarget(serverName);
  const xuiInstallVersion = getXuiInstallVersion();
  const backupsDir = path.join(process.cwd(), 'backups');
  const backupCandidates = getBackupCandidates(backupsDir, serverName);

  if (backupCandidates.length < 1) {
    throw new Error(`Backup file not found or empty before install. Expected ${path.join(backupsDir, `${serverName}_backup.tar.gz`)}, ${path.join(backupsDir, `${serverName}_backup.dump`)}, ${path.join(backupsDir, `${serverName}.dump`)}, or ${path.join(backupsDir, `${serverName}_backup.db`)}.`);
  }

  await reportProgress(progress, `Using 3x-ui ${xuiInstallVersion} and ${backupCandidates.length} backup candidate(s) for ${serverName}.`);

  // Get New IP
  await reportProgress(progress, 'Finding the new DigitalOcean public IP...');
  const newIp = await waitForDropletPublicIp(doToken, serverName);

  // Wait extra 30s to make sure SSH is really up
  await reportProgress(progress, `New IP is ${newIp}. Waiting for SSH to become ready...`);
  await sleep(30000);

  let installed = await isXuiInstalled(newIp);

  if (installed) {
    await reportProgress(progress, '3x-ui is already installed. Continuing with restore/setup...');
  } else {
    const installScript = `
set -e
export DEBIAN_FRONTEND=noninteractive
curl -fsSL https://raw.githubusercontent.com/mhsanaei/3x-ui/master/install.sh -o /tmp/3x-ui-install.sh
printf '2\\n1\\ny\\n${panelTarget.port}\\n4\\n' | bash /tmp/3x-ui-install.sh ${xuiInstallVersion}
`;
    const installCmd = `timeout 12m bash -lc ${shellQuote(installScript)}`;

    let attempt = 0;
    while(attempt < 3 && !installed) {
      try {
        attempt++;
        await reportProgress(progress, `Installing 3x-ui on ${newIp} (attempt ${attempt}/3)...`);
        await execSsh(newIp, installCmd, XUI_INSTALL_TIMEOUT_MS + 60000);
        installed = await isXuiInstalled(newIp);
      } catch(err) {
        if (await isXuiInstalled(newIp)) {
          installed = true;
          await reportProgress(progress, '3x-ui install command did not exit cleanly, but the panel binary is installed. Continuing...');
          break;
        }
        const message = err instanceof Error ? err.message : String(err);
        await reportProgress(progress, `SSH/install attempt ${attempt} failed: ${message.slice(0, 500)}. Retrying in 10 seconds...`);
        await sleep(10000);
      }
    }
  }

  if (!installed) throw new Error("Failed to connect via SSH and install 3x-ui. VPS might still be booting.");

  // Restore DB and SSL Certificates
  if (backupCandidates.length > 0) {
    let selectedBackup: ValidatedBackup | null = null;
    const validationErrors: string[] = [];

    for (const candidate of backupCandidates) {
      const fileName = path.basename(candidate.localPath);
      await reportProgress(progress, `Uploading and validating ${fileName}...`);
      await sftpUpload(newIp, candidate.localPath, candidate.remotePath);

      try {
        const backupDetails = await inspectRemoteBackup(newIp, candidate);
        selectedBackup = { ...candidate, ...backupDetails };
        await reportProgress(progress, `Backup ${fileName} is ${backupDetails.databaseKind} and contains ${backupDetails.inboundCount} inbound(s).`);
        break;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        validationErrors.push(`${fileName}: ${message}`);
        await execSsh(newIp, `rm -f ${shellQuote(candidate.remotePath)}`).catch(() => {});
      }
    }

    if (!selectedBackup) {
      throw new Error(`No usable x-ui backup found for ${serverName}. ${validationErrors.join(' | ')}. Put a valid ${serverName}_backup.tar.gz, ${serverName}_backup.dump, ${serverName}.dump, or ${serverName}_backup.db in the backups folder and rerun Panel.`);
    }

    await reportProgress(progress, 'Stopping 3x-ui before database and certificate restore...');
    await execSsh(newIp, 'systemctl stop x-ui || true');

    // Restore the active DB backend from the selected backup.
    await reportProgress(progress, 'Restoring x-ui database and SSL certificate files...');
    const postgresDbName = `xui_${serverName.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
    const extractCmd = selectedBackup.databaseKind === 'postgres'
      ? selectedBackup.kind === 'archive'
        ? `
set -e
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a
backup=${shellQuote(selectedBackup.remotePath)}
db_name=${shellQuote(postgresDbName)}
db_user=${shellQuote(postgresDbName)}
pass_file="/root/.${postgresDbName}_pg_password"
workdir=$(mktemp -d)
cleanup() { rm -rf "$workdir"; }
trap cleanup EXIT
tar -tzf "$backup" | grep -qx 'x-ui-postgres.dump'
tar -xzf "$backup" -C "$workdir" x-ui-postgres.dump
tar -xzf "$backup" -C "$workdir" x-ui-default.env 2>/dev/null || true
tar -xzf "$backup" -C / root/cert 2>/dev/null || true
tar -xzf "$backup" -C / root/.acme.sh 2>/dev/null || true
[ -s "$workdir/x-ui-postgres.dump" ] || { echo "Restored PostgreSQL dump is missing or empty"; exit 1; }
${aptWaitShell}
${ensurePostgresRestoreToolsShell}
export MAX_APT_WAIT_SECS=300
wait_for_apt || { echo "Could not acquire apt lock"; exit 1; }
run_apt update -qq
wait_for_apt || { echo "Could not acquire apt lock"; exit 1; }
run_apt install -y -qq postgresql postgresql-client postgresql-contrib >/tmp/bds-pg-restore-install.log 2>&1 || { tail -120 /tmp/bds-pg-restore-install.log; exit 1; }
ensure_pg_restore_tools
systemctl enable --now postgresql >/dev/null
if [ -s "$pass_file" ]; then
  db_pass=$(cat "$pass_file")
else
  db_pass=$(openssl rand -hex 24)
  umask 077
  printf '%s' "$db_pass" > "$pass_file"
fi
if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$db_user'" | grep -q 1; then
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "CREATE ROLE $db_user LOGIN PASSWORD '$db_pass';" >/dev/null
else
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "ALTER ROLE $db_user WITH LOGIN PASSWORD '$db_pass';" >/dev/null
fi
if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='$db_name'" | grep -q 1; then
  runuser -u postgres -- createdb -O "$db_user" "$db_name"
fi
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d "$db_name" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public AUTHORIZATION $db_user;" >/dev/null
PGPASSWORD="$db_pass" pg_restore -h 127.0.0.1 -U "$db_user" -d "$db_name" --no-owner --no-privileges "$workdir/x-ui-postgres.dump"
dsn="postgres://$db_user:$db_pass@127.0.0.1:5432/$db_name?sslmode=disable"
if [ -f "$workdir/x-ui-default.env" ]; then
  grep -v -E '^(XUI_DB_TYPE|XUI_DB_DSN)=' "$workdir/x-ui-default.env" > /etc/default/x-ui || true
else
  : > /etc/default/x-ui
fi
{
  echo 'XUI_DB_TYPE=postgres'
  echo "XUI_DB_DSN=$dsn"
} >> /etc/default/x-ui
chmod 600 /etc/default/x-ui
rm -f "$backup"
PGPASSWORD="$db_pass" psql -h 127.0.0.1 -U "$db_user" -d "$db_name" -tAc "select 'RESTORED_PG_INBOUNDS=' || count(*) from inbounds;"
`
        : `
set -e
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a
backup=${shellQuote(selectedBackup.remotePath)}
db_name=${shellQuote(postgresDbName)}
db_user=${shellQuote(postgresDbName)}
pass_file="/root/.${postgresDbName}_pg_password"
workdir=$(mktemp -d)
cleanup() { rm -rf "$workdir"; }
trap cleanup EXIT
[ -s "$backup" ] || { echo "Restored PostgreSQL dump is missing or empty"; exit 1; }
${aptWaitShell}
${ensurePostgresRestoreToolsShell}
export MAX_APT_WAIT_SECS=300
wait_for_apt || { echo "Could not acquire apt lock"; exit 1; }
run_apt update -qq
wait_for_apt || { echo "Could not acquire apt lock"; exit 1; }
run_apt install -y -qq postgresql postgresql-client postgresql-contrib >/tmp/bds-pg-restore-install.log 2>&1 || { tail -120 /tmp/bds-pg-restore-install.log; exit 1; }
ensure_pg_restore_tools
systemctl enable --now postgresql >/dev/null
if [ -s "$pass_file" ]; then
  db_pass=$(cat "$pass_file")
else
  db_pass=$(openssl rand -hex 24)
  umask 077
  printf '%s' "$db_pass" > "$pass_file"
fi
if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$db_user'" | grep -q 1; then
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "CREATE ROLE $db_user LOGIN PASSWORD '$db_pass';" >/dev/null
else
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "ALTER ROLE $db_user WITH LOGIN PASSWORD '$db_pass';" >/dev/null
fi
if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='$db_name'" | grep -q 1; then
  runuser -u postgres -- createdb -O "$db_user" "$db_name"
fi
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d "$db_name" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public AUTHORIZATION $db_user;" >/dev/null
PGPASSWORD="$db_pass" pg_restore -h 127.0.0.1 -U "$db_user" -d "$db_name" --no-owner --no-privileges "$backup"
dsn="postgres://$db_user:$db_pass@127.0.0.1:5432/$db_name?sslmode=disable"
: > /etc/default/x-ui
{
  echo 'XUI_DB_TYPE=postgres'
  echo "XUI_DB_DSN=$dsn"
} >> /etc/default/x-ui
chmod 600 /etc/default/x-ui
rm -f "$backup"
PGPASSWORD="$db_pass" psql -h 127.0.0.1 -U "$db_user" -d "$db_name" -tAc "select 'RESTORED_PG_INBOUNDS=' || count(*) from inbounds;"
`
      : selectedBackup.kind === 'archive'
      ? `
set -e
backup=${shellQuote(selectedBackup.remotePath)}
tar -tzf "$backup" | grep -qx 'etc/x-ui/x-ui.db'
mkdir -p /etc/x-ui
rm -f /etc/x-ui/x-ui.db /etc/x-ui/x-ui.db-wal /etc/x-ui/x-ui.db-shm
tar -xzf "$backup" -C /
rm -f "$backup"
[ -s /etc/x-ui/x-ui.db ] || { echo "Restored x-ui.db is missing or empty"; exit 1; }
chown root:root /etc/x-ui/x-ui.db* 2>/dev/null || true
chmod 600 /etc/x-ui/x-ui.db* 2>/dev/null || true
`
      : `
set -e
backup=${shellQuote(selectedBackup.remotePath)}
mkdir -p /etc/x-ui
rm -f /etc/x-ui/x-ui.db /etc/x-ui/x-ui.db-wal /etc/x-ui/x-ui.db-shm
cp "$backup" /etc/x-ui/x-ui.db
rm -f "$backup"
[ -s /etc/x-ui/x-ui.db ] || { echo "Restored x-ui.db is missing or empty"; exit 1; }
chown root:root /etc/x-ui/x-ui.db
chmod 600 /etc/x-ui/x-ui.db
`;
    await execSsh(newIp, extractCmd);

    await reportProgress(progress, 'Applying panel username, password, port, and base path...');
    const resetTwoFactor = config.enable2FA ? 'false' : 'true';
    const settingCmd = [
      '/usr/local/x-ui/x-ui',
      'setting',
      '-username', shellQuote(config.xuiUsername || 'admin'),
      '-password', shellQuote(config.xuiPassword || 'admin'),
      '-port', String(panelTarget.port),
      '-webBasePath', shellQuote(panelTarget.panelPath),
      '-listenIP', '0.0.0.0',
      '-resetTwoFactor', resetTwoFactor,
    ].join(' ');
    await execSsh(newIp, `[ -x /usr/local/x-ui/x-ui ] || { echo "x-ui binary not found"; exit 1; }; if [ -f /etc/default/x-ui ]; then set -a; . /etc/default/x-ui; set +a; fi; ${settingCmd}`);

    await reportProgress(progress, `Looking for restored SSL files for ${panelTarget.domain}...`);
    const sslCmd = `
domain=${shellQuote(panelTarget.domain)}
cert=$(find /root/cert /root/.acme.sh -type f \\( -name 'fullchain.pem' -o -name 'fullchain.cer' \\) 2>/dev/null | grep -Fi "$domain" | sort | head -n 1)
if [ -z "$cert" ]; then cert=$(find /root/cert /root/.acme.sh -type f \\( -name '*.cer' -o -name '*.crt' \\) ! -name 'privkey.pem' ! -name '*.key' 2>/dev/null | grep -Fi "$domain" | sort | head -n 1); fi
key=$(find /root/cert /root/.acme.sh -type f \\( -name 'privkey.pem' -o -name '*.key' \\) 2>/dev/null | grep -Fi "$domain" | sort | head -n 1)
if [ -n "$cert" ] && [ -n "$key" ]; then
  /usr/local/x-ui/x-ui cert -webCert "$cert" -webCertKey "$key" || { echo "SSL_APPLY_FAILED"; exit 1; }
  echo "SSL_APPLIED:$cert"
else
  echo "SSL_NOT_FOUND"
fi
`;
    const sslOutput = await execSsh(newIp, sslCmd);
    const sslApplied = sslOutput.includes('SSL_APPLIED');

    const firewallPorts = getFirewallPortsForServer(serverName, panelTarget);
    await reportProgress(progress, `Opening VPS firewall ports: ${firewallPorts.join(', ')}...`);
    const firewallCmd = firewallPorts
      .map((port) => `ufw allow ${port}/tcp || true`)
      .join('\n');
    await execSsh(newIp, firewallCmd);

    await restartPanelAndXray(newIp, progress);

    const readyDeadline = Date.now() + XUI_READY_WAIT_MS;
    let ready = false;
    while (Date.now() < readyDeadline) {
      try {
        await reportProgress(progress, 'Waiting for x-ui service to become active...');
        await execSsh(newIp, 'systemctl is-active --quiet x-ui');
        ready = true;
        break;
      } catch (err) {
        await sleep(XUI_READY_POLL_MS);
      }
    }

    if (!ready) {
      throw new Error('x-ui service did not become active after restore.');
    }

    await reportProgress(progress, 'Checking whether the restored panel is serving HTTPS...');
    const protocol = await detectPanelProtocol(newIp, panelTarget.port, panelTarget.panelPath);
    await reportProgress(progress, 'Verifying restored database through the panel API...');
    let inboundCount: number;
    try {
      inboundCount = await getRestoredInboundCount(
        newIp,
        protocol,
        panelTarget.port,
        panelTarget.panelPath,
        config.xuiUsername || 'admin',
        config.xuiPassword || 'admin'
      );
    } catch (err) {
      if (selectedBackup.databaseKind !== 'postgres') throw err;
      const message = err instanceof Error ? err.message : String(err);
      await reportProgress(progress, `Panel API verification failed (${message.slice(0, 180)}). Checking restored PostgreSQL database directly...`);
      inboundCount = await getRestoredDatabaseInboundCount(newIp);
    }

    if (inboundCount < 1) {
      throw new Error(`Database restore completed from ${path.basename(selectedBackup.localPath)}, but the panel API still shows 0 inbounds. Restore a valid ${serverName}_backup.tar.gz, ${serverName}_backup.dump, or legacy ${serverName}_backup.db from Telegram/backups.`);
    }

    const urlPath = getPanelUiPath(panelTarget.panelPath);
    const sslNote = sslApplied
      ? (protocol === 'https' ? '' : ' SSL certificate files were applied, but HTTPS did not respond after restart, so the panel URL is HTTP.')
      : ' SSL certificate files were not found in the backup, so the panel URL is HTTP.';

    try {
      await installFail2BanIpLimit(newIp, progress);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await reportProgress(progress, `Fail2Ban IP Limit setup did not complete: ${message.slice(0, 500)}. Panel restore already succeeded; you can rerun Fail2Ban setup later.`);
    }

    return {
      success: true,
      message: `3X-UI successfully restored ${inboundCount} inbound(s)! Panel: ${protocol}://${panelTarget.domain}:${panelTarget.port}${urlPath}${sslNote}`,
      newIp,
      domain: panelTarget.domain,
      panelUrl: `${protocol}://${panelTarget.domain}:${panelTarget.port}${urlPath}`,
      panelPort: panelTarget.port,
      inboundCount,
    };
  } else {
    throw new Error(`Backup file not found to restore! Expected ${path.join(backupsDir, `${serverName}_backup.tar.gz`)}, ${path.join(backupsDir, `${serverName}_backup.dump`)}, ${path.join(backupsDir, `${serverName}.dump`)}, or ${path.join(backupsDir, `${serverName}_backup.db`)}`);
  }
}
