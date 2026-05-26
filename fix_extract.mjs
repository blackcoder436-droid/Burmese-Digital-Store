import { Client } from 'ssh2';
import fs from 'fs';
const client = new Client();
client.on('ready', () => {
  client.exec('ls -la /root/backup.tar.gz && tar -tf /root/backup.tar.gz | head -n 10', (err, stream) => {
    stream.on('data', (data) => console.log('STDOUT: ' + data));
    stream.stderr.on('data', (data) => console.log('STDERR: ' + data));
    stream.on('close', () => client.end());
  });
}).connect({ host: '159.223.34.120',  port: 22, username: 'root', password: 'Mka@2016Omk', readyTimeout: 20000 });
