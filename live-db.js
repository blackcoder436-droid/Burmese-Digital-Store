const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const q = `sqlite3 /etc/x-ui/x-ui.db "select 'users', count(*) from users union all select 'settings', count(*) from settings union all select 'inbounds', count(*) from inbounds union all select 'api_tokens', count(*) from api_tokens union all select 'client_traffics', count(*) from client_traffics;"`;
  conn.exec(q, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end())
      .on('data', d => process.stdout.write(d.toString()))
      .stderr.on('data', d => process.stderr.write(d.toString()));
  });
}).connect({ host: '159.223.34.120', port: 22, username: 'root', password: 'Mka@2016Omk', readyTimeout: 20000 });
