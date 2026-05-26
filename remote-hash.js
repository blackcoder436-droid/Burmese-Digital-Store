const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('stat -c "%s %y" /etc/x-ui/x-ui.db; sha256sum /etc/x-ui/x-ui.db', (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
      .on('data', d => process.stdout.write(d.toString()))
      .stderr.on('data', d => process.stderr.write(d.toString()));
  });
}).connect({ host: '159.223.34.120', port: 22, username: 'root', password: 'Mka@2016Omk', readyTimeout: 20000 });
