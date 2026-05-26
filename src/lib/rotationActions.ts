import fs from 'fs';
import path from 'path';
import { Client } from 'ssh2';
import { getRotateConfig } from '@/models/RotateConfig';
import { getDoTokenField, getRotationTarget } from '@/lib/rotationTargets';

const DO_API = 'https://api.digitalocean.com/v2';
const CF_API = 'https://api.cloudflare.com/client/v4';
const DROPLET_IP_WAIT_MS = 5 * 60 * 1000;
const DROPLET_IP_POLL_MS = 15000;
const XUI_READY_WAIT_MS = 5 * 60 * 1000;
const XUI_READY_POLL_MS = 10000;

// ================= Helpers =================

export async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
      conn.sftp((err: Error | undefined, sftp: any) => {
        if (err) { conn.end(); return reject(err); }
        sftp.fastGet(remotePath, localPath, {}, (downloadErr: Error | undefined) => {
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
  const target = getRotationTarget(serverName);
  if (!target) throw new Error(`Unknown rotation server: ${serverName}`);
  const doToken = config[getDoTokenField(serverName)];
  
  // 1. Get current IP from DO
  const res = await fetch(`${DO_API}/droplets`, {
    headers: { 'Authorization': `Bearer ${doToken}`, 'Content-Type': 'application/json' }
  });
  const data = await res.json();
  const droplet = data.droplets?.find((d: any) => d.name === serverName);
  
  if (!droplet) throw new Error(`Droplet ${serverName} not found in ${target.accountLabel}.`);
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
  const target = getRotationTarget(serverName);
  if (!target) throw new Error(`Unknown rotation server: ${serverName}`);
  const doToken = config[getDoTokenField(serverName)];
  const region = target.region;
  
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
  const target = getRotationTarget(serverName);
  if (!target) throw new Error(`Unknown rotation server: ${serverName}`);
  const doToken = config[getDoTokenField(serverName)];
  const DOMAIN = target.domain;

  // Get New IP
  let newIp: string;
  try {
    newIp = await waitForDropletPublicIp(doToken, serverName);
  } catch (err: any) {
    throw new Error(`DigitalOcean Fetch Error: ${err.message}`);
  }

  const cfHeaders: {
    Authorization?: string;
    'Content-Type': string;
    'X-Auth-Email'?: string;
    'X-Auth-Key'?: string;
  } = {
    'Authorization': `Bearer ${config.cfToken?.trim()}`,
    'Content-Type': 'application/json'
  };

  // Get Zone ID
  let CF_ZONE_ID: string;
  try {
    const zonesRes = await fetch(`${CF_API}/zones?name=burmesedigital.store`, { headers: cfHeaders });
    const zonesData = await zonesRes.json();
    if (!zonesData.success || !zonesData.result?.[0]) {
      throw new Error(`CF Error: ${zonesData.errors?.[0]?.message || 'Unknown. Make sure CF Token is a valid API Token (not Global Key)'}`);
    }
    CF_ZONE_ID = zonesData.result[0].id;
  } catch (err: any) {
    // If it's a 4xx error or invalid header
    if (err.message.includes('fetch failed')) {
      // Fallback to try global key if Bearer failed
      cfHeaders['X-Auth-Email'] = config.cfEmail?.trim();
      cfHeaders['X-Auth-Key'] = config.cfToken?.trim();
      delete cfHeaders.Authorization;
      throw new Error(`Cloudflare Fetch Failed. Invalid headers or network issue. Try saving config again.`);
    }
    throw new Error(`Cloudflare Zones Error: ${err.message}`);
  }

  // Get DNS Record ID
  let record: any;
  let dnsData: any;
  try {
    const dnsRes = await fetch(`${CF_API}/zones/${CF_ZONE_ID}/dns_records?name=${DOMAIN}`, { headers: cfHeaders });
    dnsData = await dnsRes.json();
    record = dnsData.result?.[0];
  } catch(err: any) {
    throw new Error(`Cloudflare DNS Records Error: ${err.message}`);
  }

  const body = JSON.stringify({ type: 'A', name: DOMAIN, content: newIp, proxied: false, ttl: 60 });

  // Update or Create
  let finalRes;
  try {
    if (record) {
      finalRes = await fetch(`${CF_API}/zones/${CF_ZONE_ID}/dns_records/${record.id}`, { method: 'PUT', headers: cfHeaders as any, body });
    } else {
      finalRes = await fetch(`${CF_API}/zones/${CF_ZONE_ID}/dns_records`, { method: 'POST', headers: cfHeaders as any, body });
    }
  
    const finalData = await finalRes.json();
    if (!finalData.success) {
      throw new Error(`Failed to update DNS record. CF Error: ${finalData.errors?.[0]?.message || 'Unknown'}`);
    }
  } catch(err: any) {
    throw new Error(`Cloudflare Update DNS Error: ${err.message}`);
  }

  return { success: true, message: `DNS updated successfully: ${DOMAIN} -> ${newIp}` };
}

// SSH execution helper 
function execSsh(host: string, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.exec(command, (err: Error | undefined, stream: any) => {
        if (err) { conn.end(); return reject(err); }
        let output = '';
        stream.on('close', (code: number) => {
          conn.end();
          if (code !== 0) return reject(new Error(`Command failed with code ${code}. Output: ${output}`));
          resolve(output);
        }).on('data', (d: string | Buffer) => output += d.toString()).stderr.on('data', (d: string | Buffer) => output += d.toString());
      });
    }).on('error', reject).connect({ host, port: 22, username: 'root', password: 'Mka@2016Omk', readyTimeout: 20000 });
  });
}

// SFTP Upload helper
function sftpUpload(host: string, localPath: string, remotePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.sftp((err: Error | undefined, sftp: any) => {
        if (err) { conn.end(); return reject(err); }
        sftp.fastPut(localPath, remotePath, (err: Error | undefined) => {
          conn.end();
          if (err) reject(err);
          else resolve();
        });
      });
    }).on('error', reject).connect({ host, port: 22, username: 'root', password: 'Mka@2016Omk', readyTimeout: 20000 });
  });
}

// Step 5: Install & Restore
export async function actionInstall3xUI(serverName: string) {
  const config = await getRotateConfig();
  const target = getRotationTarget(serverName);
  if (!target) throw new Error(`Unknown rotation server: ${serverName}`);
  const doToken = config[getDoTokenField(serverName)];
  const adminPort = serverName === 'sg4' ? 2053 : 8080; // Only node 4 uses 2053

  // Get New IP
  const newIp = await waitForDropletPublicIp(doToken, serverName);

  // Wait extra 30s to make sure SSH is really up
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
      await execSsh(newIp, installCmd);
      installed = true;
    } catch(err) {
      await sleep(10000); // Wait 10s and test connection again
    }
  }
  
  if (!installed) throw new Error("Failed to connect via SSH and install 3x-ui. VPS might still be booting.");

  // Restore DB and SSL Certificates
  const backupsDir = path.join(process.cwd(), 'backups');
  const localTarPath = path.join(backupsDir, `${serverName}_backup.tar.gz`);
  
  if (fs.existsSync(localTarPath)) {
    const remoteTarPath = '/root/backup.tar.gz';
    await sftpUpload(newIp, localTarPath, remoteTarPath);
    
    // Extract the tar file (which contains etc/x-ui/x-ui.db, root/cert, root/.acme.sh) relative to /
    const extractCmd = `tar -xzf ${remoteTarPath} -C / && rm -f ${remoteTarPath}`;
    await execSsh(newIp, extractCmd);
    
    await execSsh(newIp, 'systemctl restart x-ui');

    const readyDeadline = Date.now() + XUI_READY_WAIT_MS;
    while (Date.now() < readyDeadline) {
      try {
        await execSsh(newIp, 'systemctl is-active --quiet x-ui');
        break;
      } catch (err) {
        await sleep(XUI_READY_POLL_MS);
      }
    }
  } else {
    throw new Error(`Backup file not found to restore! Looked for: ${localTarPath}`);
  }

  // Look up the restored port in the database to return the correct URL
  let restoredPort = adminPort;
  try {
    const portRes = await execSsh(newIp, `sqlite3 /etc/x-ui/x-ui.db "SELECT value FROM settings WHERE key='webPort';"`);
    if (portRes && portRes.trim()) {
      restoredPort = parseInt(portRes.trim(), 10);
    }
  } catch(e) { }

  let restoredBasePath = '';
  try {
    const pathRes = await execSsh(newIp, `sqlite3 /etc/x-ui/x-ui.db "SELECT value FROM settings WHERE key='webBasePath';"`);
    if (pathRes && pathRes.trim() && pathRes.trim() !== '/') {
      restoredBasePath = pathRes.trim();
    }
  } catch(e) { }

  // Check if SSL is enabled so we can return https
  let isSSL = false;
  try {
    const sslRes = await execSsh(newIp, `sqlite3 /etc/x-ui/x-ui.db "SELECT value FROM settings WHERE key='webCertFile';"`);
    if (sslRes && sslRes.trim() && sslRes.trim().length > 5) {
      isSSL = true;
    }
  } catch(e) { }

  const protocol = isSSL ? 'https' : 'http';
  // Ensure the base path ends with a slash if it exists
  const finalBasePath = restoredBasePath.endsWith('/') ? restoredBasePath : `${restoredBasePath}/`;
  const urlPath = finalBasePath === '/' ? '/panel' : `${finalBasePath}`;
  
  return { success: true, message: `3X-UI successfully restored! Panel: ${protocol}://${newIp}:${restoredPort}${urlPath}` };
}
