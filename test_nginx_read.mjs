import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  conn.exec('cat /etc/nginx/sites-available/burmesedigital.store', (err, stream) => {
    if (err) throw err;
    let data = '';
    stream.on('data', d => data += d.toString())
          .on('close', () => {
            console.log(data);
            conn.end();
          });
  });
}).connect({host: '139.59.247.115', port: 22, username: 'root', password: 'Mka@2016Omk'});