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

// ================= Helpers =================

type JsonObject = Record<string, any>;
type HeaderMap = Record<string, string>;
type ProgressReporter = (message: string) => void | Promise<void>;

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

function normalizePanelPath(value?: string): string {
  const raw = (value || '/mka').trim();
  if (!raw || raw === '/') return '/';
  return `/${raw.replace(/^\/+|\/+$/g, '')}`;
}

function getPortFromUrl(value?: string): number | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.port) return parseInt(url.port, 10);
    return url.protocol === 'https:' ? 443 : 80;
  } catch {
    return null;
  }
}

async function getPanelTarget(serverName: string, fallbackPort: number) {
  const server = await VpnServer.findOne({ serverId: serverName }).lean().catch(() => null);
  return {
    domain: (server?.domain || `${serverName}.burmesedigital.store`).trim(),
    port: getPortFromUrl(server?.url) || fallbackPort,
    panelPath: normalizePanelPath(server?.panelPath),
  };
}

function cleanSecret(value?: string): string {
  return (value || '')
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^Authorization:\s*Bearer\s+/i, '')
    .trim();
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

async function resolveCloudflareZone(config: { cfToken?: string; cfEmail?: string }) {
  const candidates = getCloudflareAuthCandidates(config);
  const errors: string[] = [];
  const zoneName = 'burmesedigital.store';

  for (const candidate of candidates) {
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
        headers: candidate.headers,
        authLabel: candidate.label,
      };
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
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
  const doToken = ['jan', 'sg1', 'sg4'].includes(serverName) ? config.doToken1 : config.doToken2;
  
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
  
  // Compress x-ui.db, cert directory, and .acme.sh directory relative to root (/)
  // Use a soft bash approach: touch dummy files or just add what's available so tar doesn't hard fail if .acme.sh is missing.
  const tarCmd = `cd / && rm -f /root/${serverName}_backup.tar.gz && tar -czf /root/${serverName}_backup.tar.gz etc/x-ui/x-ui.db $([ -d "root/cert" ] && echo "root/cert") $([ -d "root/.acme.sh" ] && echo "root/.acme.sh")`;
  await execSsh(oldIp, tarCmd);
  
  // Verify the file was created
  const checkTar = await execSsh(oldIp, `ls -l /root/${serverName}_backup.tar.gz || echo "NOT_FOUND"`);
  if (checkTar.includes("NOT_FOUND")) {
    throw new Error("Backup process failed to create the tar.gz file. x-ui.db may be missing on the server.");
  }
  
  await sftpDownload(oldIp, `/root/${serverName}_backup.tar.gz`, localDbPath);
  
  // Clean up remote tar
  await execSsh(oldIp, `rm -f /root/${serverName}_backup.tar.gz`);

  // 3. Send to Telegram
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChatId = process.env.TELEGRAM_CHANNEL_ID || process.env.TELEGRAM_CHAT_ID;
  if (!tgToken || !tgChatId) throw new Error("Telegram Bot Token or Chat ID not found in .env");

  await sendFileTg(tgToken, tgChatId, localDbPath, `🔄 Backup DB for [ ${serverName} ] before rotation\nTimestamp: ${new Date().toISOString()}`);

  return { success: true, message: `Database downloaded and sent to Telegram! Old IP was ${oldIp}` };
}

// Step 3: Recreate VPS
export async function actionRecreateServer(serverName: string) {
  const config = await getRotateConfig();
  const doToken = ['jan', 'sg1', 'sg4'].includes(serverName) ? config.doToken1 : config.doToken2;
  const region = serverName === 'sg4' ? 'nyc1' : 'sgp1';
  
  // Custom Cloud-Init to force specific root password as requested
  const userData = `#cloud-config
chpasswd:
  list: |
    root:Mka@2016Omk
  expire: False
ssh_pwauth: True
`;

  // 1. Fetch current droplets to find ID
  const listRes = await fetch(`${DO_API}/droplets`, {
    headers: { 'Authorization': `Bearer ${doToken}`, 'Content-Type': 'application/json' }
  });
  const listData = await listRes.json();
  const oldDroplet = listData.droplets?.find((d: any) => d.name === serverName);

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
    body: JSON.stringify({
      name: serverName,
      region,
      size: config.dropletSize,
      image: config.dropletImage,
      user_data: userData
    })
  });

  const createData = await createRes.json();
  if (!createRes.ok) {
    throw new Error(createData.message || "Failed to create new droplet");
  }

  return { success: true, message: `Droplet ${serverName} recreated successfully in ${region}` };
}

// Step 4: Update DNS
export async function actionUpdateDNS(serverName: string) {
  const config = await getRotateConfig();
  const doToken = ['jan', 'sg1', 'sg4'].includes(serverName) ? config.doToken1 : config.doToken2;
  const DOMAIN = `${serverName}.burmesedigital.store`;

  // Get New IP
  let newIp: string;
  try {
    newIp = await waitForDropletPublicIp(doToken, serverName);
  } catch (err: any) {
    throw new Error(`DigitalOcean Fetch Error: ${err.message}`);
  }

  const { zoneId, headers: cfHeaders, authLabel } = await resolveCloudflareZone(config);

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

  const body = JSON.stringify({ type: 'A', name: DOMAIN, content: newIp, proxied: false, ttl: 60 });

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

  return { success: true, message: `DNS updated successfully via ${authLabel}: ${DOMAIN} -> ${newIp}` };
}

// SSH execution helper 
function execSsh(host: string, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.exec(command, (err: any, stream: any) => {
        if (err) { conn.end(); return reject(err); }
        let output = '';
        stream.on('close', (code: any) => {
          conn.end();
          if (code !== 0) return reject(new Error(`Command failed with code ${code}. Output: ${output}`));
          resolve(output);
        }).on('data', (d: any) => output += d).stderr.on('data', (d: any) => output += d);
      });
    }).on('error', reject).connect({ host, port: 22, username: 'root', password: 'Mka@2016Omk', readyTimeout: 20000 });
  });
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
  const doToken = ['jan', 'sg1', 'sg4'].includes(serverName) ? config.doToken1 : config.doToken2;
  const adminPort = serverName === 'sg4' ? 2053 : 8080; // Only node 4 uses 2053
  const panelTarget = await getPanelTarget(serverName, adminPort);

  // Get New IP
  await reportProgress(progress, 'Finding the new DigitalOcean public IP...');
  const newIp = await waitForDropletPublicIp(doToken, serverName);

  // Wait extra 30s to make sure SSH is really up
  await reportProgress(progress, `New IP is ${newIp}. Waiting for SSH to become ready...`);
  await sleep(30000);

  // Use the exact installation script version requested by the user: v3.0.2
  // We feed "1" (SQLite), "n" (No custom port/user right now), "4" (Skip SSL setup)
  // because we are going to overwrite everything with our backup immediately after.
  const echoInputs = `1\nn\n4\n`;
  const installCmd = `echo -e "${echoInputs}" | bash <(curl -Ls https://raw.githubusercontent.com/mhsanaei/3x-ui/master/install.sh) v3.0.2`;

  let attempt = 0;
  let installed = false;
  while(attempt < 3 && !installed) {
    try {
      attempt++;
      await reportProgress(progress, `Installing 3x-ui on ${newIp} (attempt ${attempt}/3)...`);
      await execSsh(newIp, installCmd);
      installed = true;
    } catch(err) {
      await reportProgress(progress, `SSH/install attempt ${attempt} failed. Retrying in 10 seconds...`);
      await sleep(10000); // Wait 10s and test connection again
    }
  }
  
  if (!installed) throw new Error("Failed to connect via SSH and install 3x-ui. VPS might still be booting.");

  // Restore DB and SSL Certificates
  const backupsDir = path.join(process.cwd(), 'backups');
  const localTarPath = path.join(backupsDir, `${serverName}_backup.tar.gz`);

  if (fs.existsSync(localTarPath)) {
    await reportProgress(progress, 'Uploading backup archive to the new VPS...');
    const remoteTarPath = '/root/backup.tar.gz';
    await sftpUpload(newIp, localTarPath, remoteTarPath);

    await reportProgress(progress, 'Stopping 3x-ui before database and certificate restore...');
    await execSsh(newIp, 'systemctl stop x-ui || true');

    // Extract the tar file (which contains etc/x-ui/x-ui.db, root/cert, root/.acme.sh) relative to /
    await reportProgress(progress, 'Restoring x-ui database and SSL certificate files...');
    const extractCmd = `tar -xzf ${remoteTarPath} -C / && rm -f ${remoteTarPath} && (chmod 600 /etc/x-ui/x-ui.db || true)`;
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
      '-resetTwoFactor', resetTwoFactor,
    ].join(' ');
    await execSsh(newIp, `[ -x /usr/local/x-ui/x-ui ] || { echo "x-ui binary not found"; exit 1; }; ${settingCmd}`);

    await reportProgress(progress, `Looking for restored SSL files for ${panelTarget.domain}...`);
    const sslCmd = `
cert=$(find /root/cert /root/.acme.sh -type f \\( -name 'fullchain.cer' -o -name '*.cer' -o -name '*.crt' -o -name 'fullchain.pem' -o -name '*.pem' \\) 2>/dev/null | grep -i ${shellQuote(panelTarget.domain)} | head -n 1)
key=$(find /root/cert /root/.acme.sh -type f -name '*.key' 2>/dev/null | grep -i ${shellQuote(panelTarget.domain)} | head -n 1)
if [ -z "$cert" ]; then cert=$(find /root/cert /root/.acme.sh -type f \\( -name 'fullchain.cer' -o -name '*.cer' -o -name '*.crt' -o -name 'fullchain.pem' -o -name '*.pem' \\) 2>/dev/null | head -n 1); fi
if [ -z "$key" ]; then key=$(find /root/cert /root/.acme.sh -type f -name '*.key' 2>/dev/null | head -n 1); fi
if [ -n "$cert" ] && [ -n "$key" ]; then
  /usr/local/x-ui/x-ui cert -webCert "$cert" -webCertKey "$key"
  echo "SSL_APPLIED:$cert"
else
  echo "SSL_NOT_FOUND"
fi
`;
    const sslOutput = await execSsh(newIp, sslCmd);
    const sslApplied = sslOutput.includes('SSL_APPLIED');

    await reportProgress(progress, 'Restarting 3x-ui panel...');
    await execSsh(newIp, 'systemctl restart x-ui');

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

    const protocol = sslApplied ? 'https' : 'http';
    const finalBasePath = panelTarget.panelPath.endsWith('/') ? panelTarget.panelPath : `${panelTarget.panelPath}/`;
    const urlPath = finalBasePath === '/' ? '/panel' : `${finalBasePath}`;
    const sslNote = sslApplied ? '' : ' SSL certificate files were not found in the backup, so the panel URL is HTTP.';

    return { success: true, message: `3X-UI successfully restored! Panel: ${protocol}://${panelTarget.domain}:${panelTarget.port}${urlPath}${sslNote}` };
  } else {
    throw new Error(`Backup file not found to restore! Looked for: ${localTarPath}`);
  }
}
