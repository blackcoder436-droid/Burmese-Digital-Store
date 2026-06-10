import { Client } from 'ssh2';

const [host, password, ...commandParts] = process.argv.slice(2);
const command = commandParts.join(' ');

if (!host || !password || !command) {
  console.error('Usage: node scripts/ssh-exec.mjs <host> <password> <command>');
  process.exit(1);
}

const conn = new Client();
conn.on('ready', () => {
  conn.exec(command, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code) => {
      conn.end();
      process.exit(code || 0);
    }).on('data', (data) => process.stdout.write(data.toString()))
      .stderr.on('data', (data) => process.stderr.write(data.toString()));
  });
}).on('error', (err) => {
  console.error(err.message);
  process.exit(1);
}).connect({
  host,
  port: 22,
  username: 'root',
  password,
  readyTimeout: 30000,
});
