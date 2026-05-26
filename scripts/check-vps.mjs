import { Client } from 'ssh2';

const ip = process.argv[2];
const password = process.argv[3];
const user = process.argv[4] || 'root';

if (!ip || !password) {
  console.error('Usage: node scripts/check-vps.mjs <ip> <password> [user]');
  process.exit(1);
}

const conn = new Client();

const commands = [
  'echo "--- LS /var/www ---"; ls -la /var/www || true',
  'echo "--- LS /home ---"; ls -la /home || true',
  'echo "--- DU /var/www ---"; du -sh /var/www/* 2>/dev/null || true',
  'echo "--- PS node ---"; ps aux | grep node || true',
  'echo "--- PM2 LIST ---"; pm2 list || true',
  'echo "--- DOCKER PS ---"; docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" || true',
  'echo "--- JOURNAL (last 200) ---"; sudo journalctl -n 200 --no-pager || true',
  'echo "--- ENV FILES ---"; ls -la /var/www/*/.env* /var/www/.env* 2>/dev/null || true',
  'echo "--- REPO FOLDERS ---"; ls -la /var/www || true',
  'echo "--- FIND DB FILES ---"; find / -type f \( -name "*.sqlite" -o -name "*.db" -o -name "*.sql" \) -mtime -365 2>/dev/null | head -n 80 || true',
  'echo "--- LIST /etc/x-ui ---"; ls -la /etc/x-ui 2>/dev/null || true'
];

function runCommandsSequentially(streamExec) {
  return commands.reduce((p, cmd) => p.then(() => streamExec(cmd)), Promise.resolve());
}

function streamExecCommand(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, { pty: true }, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('close', (code, signal) => {
        process.stdout.write('\n');
        resolve({ code, signal, out });
      }).on('data', (data) => {
        out += data.toString();
        process.stdout.write(data);
      }).stderr.on('data', (data) => {
        out += data.toString();
        process.stderr.write(data);
      });
    });
  });
}

conn.on('ready', async () => {
  console.log(`Connected to ${ip} as ${user}`);
  try {
    await runCommandsSequentially((cmd) => streamExecCommand(conn, `bash -lc "${cmd.replace(/"/g, '\\"')}"`));
    console.log('\nDiagnostics complete. Closing connection.');
    conn.end();
  } catch (e) {
    console.error('Error running commands:', e.message);
    conn.end();
  }
}).on('error', (err) => {
  console.error('Connection error:', err.message);
  process.exit(1);
}).connect({
  host: ip,
  port: 22,
  username: user,
  password,
  readyTimeout: 20000
});
