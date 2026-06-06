import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { Client } from 'ssh2';
import mongoose from 'mongoose';
import FormData from 'form-data';

/**
 * 🚀 VPN Server Rotation Script 🚀
 * Usage: node scripts/rotate-vpn.mjs <server_name>
 * Example: node scripts/rotate-vpn.mjs sg1
 */

// Load basic env config manually if needed, or assume process.env has it.
// Next.js loads .env.local automatically when running next commands, 
// but for a raw Node script, we parse it manually.
try {
  const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^#\s]+)=(.*)$/);
    if (match) process.env[match[1]] = match[2].trim();
  });
} catch (e) {
  console.log('No .env.local file found or error parsing it. Using existing env variables.');
}

const serverName = process.argv[2];

if (!serverName) {
  console.error("❌ Error: Missing server name.\n👉 Usage: node scripts/rotate-vpn.mjs <server_name>\n👉 Example: node scripts/rotate-vpn.mjs sg1");
  process.exit(1);
}

// Ensure DO_TOKEN etc logic will be loaded from DB later.
// We must connect to MongoDB first, then load the RotateConfig.
const MONGO_URI = process.env.MONGODB_URI;

// Retrieve SSH credentials from ENV
const SSH_PRIVATE_KEY_PATH = process.env.VPN_SSH_KEY_PATH || path.join(process.env.HOME || process.env.USERPROFILE, '.ssh', 'id_rsa');
const SSH_PASSWORD = process.env.VPN_SSH_PASSWORD; // If password auth is used instead of key

const DO_API = 'https://api.digitalocean.com/v2';
const CF_API = 'https://api.cloudflare.com/client/v4';

const DOMAIN = `${serverName}.burmesedigital.store`;

// Define Global Config
let config;
let doToken = '';
let dropletRegion = 'sgp1';


// ============== HELPER FUNCTIONS ==============

async function notifyTg(message) {
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChatId = process.env.TELEGRAM_CHANNEL_ID || process.env.TELEGRAM_CHAT_ID;
  if (!tgToken || !tgChatId) {
    console.log(`[LOG]: ${message}`);
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgChatId, text: `🔄 [Rotation - ${serverName}]\n${message}` })
    });
  } catch (err) {
    console.log(`[LOG]: ${message}`);
  }
}

async function sendFileTg(filePath, caption) {
   const tgToken = process.env.TELEGRAM_BOT_TOKEN;
   const tgChatId = process.env.TELEGRAM_CHANNEL_ID || process.env.TELEGRAM_CHAT_ID;
   if (!tgToken || !tgChatId) return;

   try {
     const form = new FormData();
     form.append('chat_id', tgChatId);
     form.append('caption', caption);
     form.append('document', fs.createReadStream(filePath));

     await fetch(`https://api.telegram.org/bot${tgToken}/sendDocument`, {
       method: 'POST',
       body: form,
     });
   } catch (err) {
     console.error('Failed to send file to TG', err);
   }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchDO(path, options = {}) {
  const res = await fetch(`${DO_API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${doToken}`,
      ...options.headers
    }
  });
  if (res.status === 204) return null;
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `DO API Error: ${res.status}`);
  return json;
}

async function fetchCF(path, options = {}) {
  const res = await fetch(`${CF_API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.cfToken}`,
      ...options.headers
    }
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.errors?.[0]?.message || 'Cloudflare API Error');
  return json;
}

// ==== SSH Helpers ====
function getConnectionConfig(host) {
  const config = { host, port: 22, username: 'root', readyTimeout: 10000 };
  if (SSH_PRIVATE_KEY_PATH && fs.existsSync(SSH_PRIVATE_KEY_PATH)) {
    config.privateKey = fs.readFileSync(SSH_PRIVATE_KEY_PATH);
  } else if (SSH_PASSWORD) {
    config.password = SSH_PASSWORD;
  } else {
    throw new Error('❌ No valid SSH private key or password found. Check .env.local');
  }
  return config;
}

function sftpDownload(host, remotePath, localPath) {
  return new Promise((resolve, reject) => {
     const conn = new Client();
     conn.on('ready', () => {
        conn.sftp((err, sftp) => {
            if (err) { conn.end(); return reject(err); }
            sftp.fastGet(remotePath, localPath, {}, (downloadErr) => {
                conn.end();
                if (downloadErr) reject(downloadErr);
                else resolve();
            });
        });
     }).on('error', reject).connect(getConnectionConfig(host));
  });
}

// ==== MAIN FLOW ====
import { getRotateConfig } from '../src/models/RotateConfig.js'; // You might need proper ts-node/register to run this directly
import connectDB from '../src/lib/mongodb.js';

async function main() {
  // We use mongoose to fetch the config from DB.
  // We must import it dynamically or assume the user runs scripts/rotate-vpn.mjs via ts-node / tsx
  await connectDB();
  config = await getRotateConfig();

  // Assign correct DO Token
  if (['jan', 'sg1', 'sg4'].includes(serverName)) {
     doToken = config.doToken1;
  } else if (['sg2', 'sg3', 'backup'].includes(serverName)) {
     doToken = config.doToken2;
  } else {
     throw new Error("Unknown server name for token assignment.");
  }

  await notifyTg(`Started Server Rotation Process`);

  // Step 1: Find old Droplet
  const dropletsRes = await fetchDO('/droplets');
  const oldDroplet = dropletsRes.droplets.find(d => d.name === serverName);
  
  if (!oldDroplet) {
      await notifyTg(`⚠️ Warning: Old droplet ${serverName} not found in DO. We will proceed to create a new one anyway.`);
  } else {
      const oldIp = oldDroplet.networks.v4.find(n => n.type === 'public')?.ip_address;
      
      // Step 2: Backup x-ui.db
      if (oldIp) {
         try {
            await notifyTg(`Backing up database from ${oldIp}...`);
            const localDbPath = path.join(process.cwd(), `${serverName}_backup.db`);
            await sftpDownload(oldIp, '/etc/x-ui/x-ui.db', localDbPath);
            await sendFileTg(localDbPath, `Backup database for ${serverName} before rotation.`);
         } catch (err) {
            await notifyTg(`❌ Failed to backup DB: ${err.message}`);
         }
      }

      // Step 3: Destroy old Droplet
      await notifyTg(`Destroying old droplet...`);
      await fetchDO(`/droplets/${oldDroplet.id}`, { method: 'DELETE' });
  }

  // NOTE: Logic for VPS Create, DNS Update, Install and DB Restore will be added next.
  await notifyTg(`Part 1 Completed: DB Backed up and Old Server Destroyed.`);
  
  console.log("Phase 1 done. Waiting for the next instruction line to proceed with VPS Creation & Installation.");
  process.exit(0);
}

main().catch(console.error);
/*
          if (code !== 0) return reject(new Error(`Command failed with code ${code}. Output: ${output}`));
          resolve(output);
        }).on('data', data => output += data).stderr.on('data', data => output += data);
      });
    }).on('error', reject).connect(getConnectionConfig(host));
  });
}

function sftpDownload(host, remoteFile, localFile) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.sftp((err, sftp) => {
        if (err) { conn.end(); return reject(err); }
        sftp.fastGet(remoteFile, localFile, (err) => {
          conn.end();
          if (err) return reject(err);
          resolve();
        });
      });
    }).on('error', reject).connect(getConnectionConfig(host));
  });
}

function sftpUpload(host, localFile, remoteFile) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.sftp((err, sftp) => {
        if (err) { conn.end(); return reject(err); }
        sftp.fastPut(localFile, remoteFile, (err) => {
          conn.end();
          if (err) return reject(err);
          // Set proper permissions for x-ui.db
          conn.exec(`chmod 644 ${remoteFile}`, (err2, stream) => {
             resolve();
          });
        });
      });
    }).on('error', reject).connect(getConnectionConfig(host));
  });
}


// ============== MAIN LOGIC ==============

async function rotateDatabase() {
  console.log(`\n⏳ Starting Server Rotation for: ${serverName}`);
  
  if (!DO_TOKEN || !CF_TOKEN) {
    throw new Error("Missing DO_API_TOKEN or CF_API_TOKEN in .env.local");
  }

  // 1. Find Current Droplet
  console.log('🔍 Locating old droplet...');
  const { droplets } = await fetchDO('/droplets?per_page=100');
  const oldDroplet = droplets.find(d => d.name === serverName);
  
  let backupFile = path.join(process.cwd(), `backup_${serverName}_x-ui.db`);
  
  if (oldDroplet) {
    const oldIpName = oldDroplet.networks.v4.find(n => n.type === 'public')?.ip_address;
    console.log(`✅ Old Droplet found. IP: ${oldIpName}`);
    
    // 2. Backup x-ui.db
    console.log(`📥 Downloading 3x-UI database from old server...`);
    try {
      await sftpDownload(oldIpName, '/etc/x-ui/x-ui.db', backupFile);
      console.log(`✅ Database backed up to: ${backupFile}`);
    } catch (e) {
      console.error(`⚠️ Failed to download DB. Error: ${e.message}`);
      console.log('Proceeding anyway? Press Ctrl+C to abort, or wait 5s...');
      await sleep(5000);
    }

    // 3. Delete Droplet
    console.log(`🚮 Deleting old droplet ID: ${oldDroplet.id} ...`);
    await fetchDO(`/droplets/${oldDroplet.id}`, { method: 'DELETE' });
    console.log(`✅ Old droplet deleted.`);
  } else {
    console.log(`⚠️ No existing droplet named '${serverName}' found. Proceeding to create new one.`);
    if (!fs.existsSync(backupFile)) {
       console.log(`⚠️ No local backup file found at ${backupFile}. Panel will start empty!`);
    }
  }

  // 4. Create New Droplet
  console.log(`🏗️ Creating new droplet '${serverName}' (Ubuntu 24.04)...`);
  const createPayload = {
    name: serverName,
    region: 'sgp1', // Change region if needed
    size: 's-1vcpu-1gb', // Basic size
    image: 'ubuntu-24-04-x64',
    vpc_uuid: undefined,
    ssh_keys: DO_SSH_KEY_ID ? [DO_SSH_KEY_ID] : [] // Essential so you can login without prompt
  };

  const createRes = await fetchDO('/droplets', { method: 'POST', body: JSON.stringify(createPayload) });
  const dropletId = createRes.droplet.id;
  
  console.log(`⏳ Waiting for new droplet to boot...`);
  let newIp = null;
  while (!newIp) {
    await sleep(5000); // Check every 5 seconds
    const statusRes = await fetchDO(`/droplets/${dropletId}`);
    const dp = statusRes.droplet;
    if (dp.status === 'active') {
      newIp = dp.networks.v4?.find(n => n.type === 'public')?.ip_address;
    }
  }
  console.log(`✅ New Droplet Active! New IP: ${newIp}`);

  // 5. Update Cloudflare DNS
  console.log(`🌐 Updating Cloudflare DNS for ${DOMAIN} ...`);
  const dnsRes = await fetchCF(`/zones/${CF_ZONE_ID}/dns_records?name=${DOMAIN}`);
  const record = dnsRes.result[0];

  if (record) {
    await fetchCF(`/zones/${CF_ZONE_ID}/dns_records/${record.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        type: 'A',
        name: DOMAIN,
        content: newIp,
        proxied: false, // VPN shouldn't be Cloudflare proxied via orange cloud
        ttl: 60
      })
    });
    console.log(`✅ DNS Record updated to point to ${newIp}`);
  } else {
    await fetchCF(`/zones/${CF_ZONE_ID}/dns_records`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'A',
        name: DOMAIN,
        content: newIp,
        proxied: false,
        ttl: 60
      })
    });
    console.log(`✅ DNS Record created for ${DOMAIN} to ${newIp}`);
  }

  // 6. Wait for SSH to be ready
  console.log(`⏳ Waiting 30 seconds for SSH service to start on new droplet...`);
  await sleep(30000);

  // 7. Install 3x-UI
  console.log(`⚙️ Installing 3x-UI panel on new server...`);
  // Non-interactive 3x-ui install: sets default admin/admin port 2053
  const installCmd = `echo -e "y\nadmin\nadmin\n2053\n" | bash <(curl -Ls https://raw.githubusercontent.com/mhsanaei/3x-ui/master/install.sh)`;
  
  let attempt = 0;
  let installed = false;
  while(attempt < 5 && !installed) {
    try {
      attempt++;
      await execSsh(newIp, installCmd);
      installed = true;
    } catch(err) {
      console.log(`   (Attempt ${attempt}/5) SSH connection failed. Retrying in 10s...`);
      await sleep(10000);
    }
  }
  if (!installed) throw new Error("❌ Failed to connect via SSH and install 3x-ui.");
  console.log(`✅ 3x-UI successfully installed!`);

  // 8. Restore x-ui.db
  if (fs.existsSync(backupFile)) {
    console.log(`📤 Uploading database backup to new server...`);
    await sftpUpload(newIp, backupFile, '/etc/x-ui/x-ui.db');
    console.log(`✅ Database restored.`);

    console.log(`🔄 Restarting x-ui service...`);
    await execSsh(newIp, `systemctl restart x-ui`);
    console.log(`✅ Service restarted.`);
  } else {
    console.log(`⚠️ No local backup file found to restore.`);
  }

  console.log(`\n🎉 SERVER ROTATION COMPLETE! 🎉`);
  console.log(`👉 Domain: ${DOMAIN}`);
  console.log(`👉 IP: ${newIp}`);
  console.log(`👉 Panel UI: http://${newIp}:2053/panel`);
}

rotateDatabase().catch(console.error);
*/
