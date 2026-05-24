import { Client } from 'ssh2';

const [ip, password, user = 'root'] = process.argv.slice(2);
if (!ip || !password) {
  console.error('Usage: node scripts/verify-xui-backup.mjs <ip> <password> [user]');
  process.exit(1);
}

const conn = new Client();
conn.on('ready', () => {
  conn.exec('crontab -l 2>/dev/null && echo "---" && cat /usr/local/bin/backup-xui-db.sh && echo "---" && ls -la /root/backup-xui 2>/dev/null', (err, stream) => {
    if (err) throw err;
    stream.on('close', (code) => {
      conn.end();
      process.exit(code);
    }).on('data', (data) => process.stdout.write(data.toString()))
      .stderr.on('data', (data) => process.stderr.write(data.toString()));
  });
}).on('error', (err) => {
  console.error('Connection error:', err.message);
  process.exit(1);
}).connect({ host: ip, port: 22, username: user, password });
