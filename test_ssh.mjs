import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  conn.exec('ls -la /var/www/burmese-digital-store/public/uploads && ls -la /var/www/burmese-digital-store/public/uploads/gh-pack | head -n 10', (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      conn.end();
    }).on('data', (data) => {
      console.log(data.toString());
    }).stderr.on('data', (data) => {
      console.error('STDERR: ' + data);
    });
  });
}).connect({
  host: '139.59.247.115',
  port: 22,
  username: 'root',
  password: 'Mka@2016Omk' 
});