import fs from 'fs';
import path from 'path';
import { Client } from 'ssh2';

const [ip, password, user = 'root'] = process.argv.slice(2);
if (!ip || !password) {
  console.error('Usage: node scripts/setup-xui-backup.mjs <ip> <password> [user]');
  process.exit(1);
}

const localScriptPath = path.join(process.cwd(), 'scripts', 'backup-xui-db.sh');
const remoteScriptPath = '/usr/local/bin/backup-xui-db.sh';
const cronLine = '0 0,12 * * * /usr/local/bin/backup-xui-db.sh >> /var/log/backup-xui.log 2>&1';

function streamExec(conn, command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`command failed: ${command}\nexit ${code}\nstderr: ${stderr}`));
        }
        resolve({ stdout, stderr });
      }).on('data', (data) => {
        stdout += data.toString();
      }).stderr.on('data', (data) => {
        stderr += data.toString();
      });
    });
  });
}

function uploadFile(conn, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.fastPut(localPath, remotePath, (err2) => {
        if (err2) return reject(err2);
        resolve();
      });
    });
  });
}

const conn = new Client();
conn.on('ready', async () => {
  try {
    console.log(`Connected to ${ip}`);
    await uploadFile(conn, localScriptPath, remoteScriptPath);
    await streamExec(conn, `chmod +x ${remoteScriptPath}`);
    await streamExec(conn, `touch /var/log/backup-xui.log && chmod 644 /var/log/backup-xui.log`);
    await streamExec(conn, `mkdir -p /root/backup-xui && chmod 700 /root/backup-xui`);

    const cronCheck = await streamExec(conn, `crontab -l 2>/dev/null | grep -F \"${cronLine}\" || true`);
    if (cronCheck.stdout.trim()) {
      console.log('Cron job already exists.');
    } else {
      await streamExec(conn, `(crontab -l 2>/dev/null; echo "${cronLine}") | crontab -`);
      console.log('Installed cron job for x-ui backup at 00:00 and 12:00.');
    }

    await streamExec(conn, `bash ${remoteScriptPath}`);
    console.log('Ran backup script once to verify installation.');
    console.log('Backup script path:', remoteScriptPath);
    console.log('Log path: /var/log/backup-xui.log');
    conn.end();
  } catch (err) {
    console.error('Error:', err.message);
    conn.end();
    process.exit(1);
  }
}).on('error', (err) => {
  console.error('Connection failed:', err.message);
  process.exit(1);
}).connect({
  host: ip,
  port: 22,
  username: user,
  password,
  readyTimeout: 20000,
});
