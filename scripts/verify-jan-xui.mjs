import { Client } from 'ssh2';

const [host, password] = process.argv.slice(2);

if (!host || !password) {
  console.error('Usage: node scripts/verify-jan-xui.mjs <host> <password>');
  process.exit(1);
}

const command = `
set -e
echo "SERVICE=$(systemctl is-active x-ui)"
echo "DB_TYPE=$(grep -E '^XUI_DB_TYPE=' /etc/default/x-ui | cut -d= -f2-)"
pg_restore --version
if [ -f /etc/default/x-ui ]; then
  set -a
  . /etc/default/x-ui
  set +a
fi
/usr/local/x-ui/x-ui setting -show true | sed -n '1,80p'
psql "$XUI_DB_DSN" -tAc "select 'INBOUNDS=' || count(*) from inbounds;"
# Prefer HEAD check but fall back to GET on the UI root (/mka/) because some panel
# versions (v3.2.8) return 404 for HEAD while GET returns 200. Also try HTTP as
# a last resort.
(
  status=$(curl -kfsS --max-time 10 -o /dev/null -w "%{http_code}" -I https://127.0.0.1:8080/mka/panel 2>/dev/null || true)
  if [ "$status" = "200" ]; then
    echo "HTTP_HEAD=200 https://127.0.0.1:8080/mka/panel"
  else
    # try GET on the UI root
    status2=$(curl -kfsS --max-time 10 -o /dev/null -w "%{http_code}" https://127.0.0.1:8080/mka/ 2>/dev/null || true)
    if [ "$status2" = "200" ]; then
      echo "HTTP_GET=200 https://127.0.0.1:8080/mka/"
    else
      # fallback to HTTP if HTTPS failed
      status3=$(curl -fsS --max-time 10 -o /dev/null -w "%{http_code}" -I http://127.0.0.1:8080/mka/panel 2>/dev/null || true)
      status4=$(curl -fsS --max-time 10 -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/mka/ 2>/dev/null || true)
      echo "HEAD_HTTPS=$status HEAD_GET_HTTPS=$status2 HEAD_HTTP=$status3 GET_HTTP=$status4"
    fi
  fi
)
`;

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
