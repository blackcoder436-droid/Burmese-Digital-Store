import { Client } from 'ssh2';

const [ip, password, user = 'root'] = process.argv.slice(2);
if (!ip || !password) {
  console.error('Usage: node scripts/check-vps-app.mjs <ip> <password> [user]');
  process.exit(1);
}

const conn = new Client();
const commands = [
  'echo "--- PM2 SHOW ---"; pm2 show burmese-digital-store || true',
  'echo "--- PM2 STATUS ---"; pm2 status || true',
  'echo "--- PM2 LOGS (last 100 lines) ---"; pm2 logs burmese-digital-store --lines 100 --nostream || true',
  'echo "--- CURL LOCALHOST ---"; curl -I http://127.0.0.1:3000 || true',
  'echo "--- CURL EXTERNAL IP ---"; curl -I http://139.59.247.115:3000 || true',
  'echo "--- CURL DOMAIN HTTP ---"; curl -I http://burmesedigital.store || true',
  'echo "--- CURL DOMAIN HTTPS ---"; curl -I https://burmesedigital.store || true',
  'echo "--- LISTENER PORTS ---"; ss -ltnp | grep -E ":3000|:80|:443" || netstat -ltnp | grep -E ":3000|:80|:443" || true',
  'echo "--- UFW STATUS ---"; sudo ufw status verbose || true',
  'echo "--- NGINX CONFIG ---"; sudo nginx -T 2>/dev/null | sed -n "1,260p" || true',
  'echo "--- NGINX SERVERS ---"; sudo grep -RniE "server_name|proxy_pass|listen" /etc/nginx/sites-enabled /etc/nginx/nginx.conf || true',
  'echo "--- BUILD FOLDER ---"; ls -la /var/www/burmese-digital-store/.next || true',
  'echo "--- ENV VALUES ---"; grep -E "^(PORT|MONGODB_URI|NODE_ENV|NEXT_PUBLIC_|ADMIN_SECRET|JWT_SECRET)=" /var/www/burmese-digital-store/.env.local || true',
  'echo "--- LAST DEPLOY CHECK ---"; ls -la /var/www/burmese-digital-store && pwd',
];

function execRemote(command) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      stream.on('close', (code) => resolve(code)).on('data', (data) => process.stdout.write(data.toString())).stderr.on('data', (data) => process.stderr.write(data.toString()));
    });
  });
}

conn.on('ready', async () => {
  console.log(`Connected to ${ip}`);
  try {
    for (const command of commands) {
      await execRemote(command);
    }
    conn.end();
  } catch (error) {
    console.error('Error:', error.message);
    conn.end();
    process.exit(1);
  }
}).on('error', (err) => {
  console.error('Connection error:', err.message);
  process.exit(1);
}).connect({ host: ip, port: 22, username: user, password });
