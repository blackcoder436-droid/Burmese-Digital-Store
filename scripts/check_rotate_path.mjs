import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH ready — checking /etc/x-ui/x-ui.db');
  conn.exec('ls -l /etc/x-ui/x-ui.db || echo "MISSING"', (err, stream) => {
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
