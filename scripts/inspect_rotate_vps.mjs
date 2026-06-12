import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH ready — gathering VPS inspection info');
  const cmd = `
echo '--- HOSTNAME ---'
hostname -f || hostname
echo '\n--- /etc/default/x-ui ---'
cat /etc/default/x-ui 2>/dev/null || echo 'MISSING /etc/default/x-ui'
echo '\n--- /etc/x-ui listing ---'
ls -la /etc/x-ui 2>/dev/null || echo 'MISSING /etc/x-ui'
echo '\n--- nginx sites-enabled ---'
ls -la /etc/nginx/sites-enabled 2>/dev/null || echo 'MISSING /etc/nginx/sites-enabled'
echo '\n--- grep server_name in nginx configs ---'
grep -R "server_name" /etc/nginx -n 2>/dev/null || true
echo '\n--- pm2 list ---'
pm2 list || echo 'pm2 not installed or no access'
echo '\n--- systemctl x-ui status ---'
systemctl is-active x-ui 2>/dev/null || echo 'x-ui service unknown or missing'
`;

  conn.exec(cmd, {pty: true}, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).connect({
  host: '139.59.247.115',
  port: 22,
  username: 'root',
  password: 'Mka@2016Omk'
});
