import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  const cmd = `
    echo '===== PM2 LIST =====' && pm2 list || true
    echo '\n===== PM2 SHOW burmese-digital-store =====' && pm2 show burmese-digital-store || true
    echo '\n===== LAST PM2 LOG LINES (200) =====' && pm2 logs burmese-digital-store --lines 200 --nostream || true
    echo '\n===== NGINX STATUS =====' && sudo systemctl status nginx --no-pager || true
    echo '\n===== NGINX JOURNAL (200) =====' && sudo journalctl -u nginx -n 200 --no-pager || true
    echo '\n===== UPTIME & LISTENING PORTS =====' && uptime && ss -ltnp || true
  `;

  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('\nStream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data.toString());
    }).stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
}).connect({
  host: '139.59.247.115',
  port: 22,
  username: 'root',
  password: 'Mka@2016Omk'
});
