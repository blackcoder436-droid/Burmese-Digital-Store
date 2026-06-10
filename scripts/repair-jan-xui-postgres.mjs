import fs from 'fs';
import path from 'path';
import { Client } from 'ssh2';

const [host, password, backupPath, serverName = 'jan'] = process.argv.slice(2);

if (!host || !password || !backupPath) {
  console.error('Usage: node scripts/repair-jan-xui-postgres.mjs <host> <password> <backup.tar.gz> [serverName]');
  process.exit(1);
}

const xuiVersion = 'v3.2.8';
const panelPort = serverName === 'sg4' ? 2053 : 8080;
const panelPath = '/mka';
const dbName = `xui_${serverName.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
const remoteBackup = `/root/${path.basename(backupPath)}`;
const remoteBackupScript = '/usr/local/bin/backup-xui-db.sh';

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

// Shell snippet to prepare/clear apt locks on remote hosts. Defines
// prepare_apt() and a wait_for_apt() wrapper for compatibility.
const aptWaitShell = `
prepare_apt() {
  max_wait=\${MAX_APT_WAIT_SECS:-600}
  kill_threshold=\${APT_KILL_OLD_SEC:-600}
  waited=0
  interval=5
  while :; do
    apt_pids=$(pgrep -f "apt|apt-get|unattended-upgrade|unattended-upgrades|dpkg" || true)
    if [ -z "$apt_pids" ]; then
      return 0
    fi
    kill_list=""
    for pid in $apt_pids; do
      etimes=$(ps -o etimes= -p "$pid" 2>/dev/null || echo 0)
      if [ -n "$etimes" ] && [ "$etimes" -ge "$kill_threshold" ]; then
        kill_list="$kill_list $pid"
      fi
    done
    if [ -n "$kill_list" ]; then
      echo "KILL_OLD_APT:$kill_list"
      kill -TERM $kill_list 2>/dev/null || true
      sleep 5
      for pid in $kill_list; do
        if kill -0 "$pid" >/dev/null 2>&1; then
          kill -KILL "$pid" 2>/dev/null || true
        fi
      done
      dpkg --configure -a || true
      apt-get update -qq || true
      return 0
    fi
    if [ "$waited" -ge "$max_wait" ]; then
      echo "APT_LOCK_TIMEOUT"
      echo "Held by pids: $apt_pids"
      ps -o pid,etime,cmd -p $apt_pids 2>/dev/null || true
      if command -v lsof >/dev/null 2>&1; then
        lsof /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock /var/lib/apt/lists/lock /var/cache/apt/archives/lock 2>/dev/null || true
      fi
      return 1
    fi
    sleep $interval
    waited=$((waited+interval))
  done
}

# Backwards-compatible wrapper
wait_for_apt() { prepare_apt "$@"; }
`;

function connect() {
  const conn = new Client();
  return new Promise((resolve, reject) => {
    conn.on('ready', () => resolve(conn))
      .on('error', reject)
      .connect({
        host,
        port: 22,
        username: 'root',
        password,
        readyTimeout: 30000,
      });
  });
}

function exec(conn, command, timeoutMs = 600000) {
  return new Promise((resolve, reject) => {
    conn.exec(command, { pty: false }, (err, stream) => {
      if (err) return reject(err);
      let output = '';
      const timer = setTimeout(() => {
        stream.close();
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      stream.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(output);
        else reject(new Error(`Command failed with code ${code}\n${output}`));
      }).on('data', (data) => {
        output += data.toString();
      }).stderr.on('data', (data) => {
        output += data.toString();
      });
    });
  });
}

function upload(conn, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.fastPut(localPath, remotePath, (uploadErr) => {
        if (uploadErr) reject(uploadErr);
        else resolve();
      });
    });
  });
}

function buildRemoteRepairCommand() {
  return `
set -e
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a
backup=${shellQuote(remoteBackup)}
db_name=${shellQuote(dbName)}
db_user=${shellQuote(dbName)}
pass_file="/root/.${dbName}_pg_password"
workdir=$(mktemp -d)
cleanup() { rm -rf "$workdir"; }
trap cleanup EXIT

echo "CHECK_BACKUP"
tar -tzf "$backup" | grep -qx 'x-ui-postgres.dump'
tar -xzf "$backup" -C "$workdir" x-ui-postgres.dump
tar -xzf "$backup" -C "$workdir" x-ui-default.env 2>/dev/null || true
tar -xzf "$backup" -C / root/cert 2>/dev/null || true
tar -xzf "$backup" -C / root/.acme.sh 2>/dev/null || true
[ -s "$workdir/x-ui-postgres.dump" ] || { echo "PostgreSQL dump missing or empty"; exit 1; }

echo "INSTALL_PANEL"
if [ ! -x /usr/local/x-ui/x-ui ] || ! /usr/local/x-ui/x-ui version 2>/dev/null | grep -q '${xuiVersion}'; then
  curl -fsSL https://raw.githubusercontent.com/mhsanaei/3x-ui/master/install.sh -o /tmp/3x-ui-install.sh
  printf '2\\n1\\ny\\n${panelPort}\\n4\\n' | timeout 12m bash /tmp/3x-ui-install.sh ${xuiVersion}
fi

echo "INSTALL_POSTGRES"
${aptWaitShell}
wait_for_apt || { echo "Could not acquire apt lock"; exit 1; }
apt-get update -qq
wait_for_apt || { echo "Could not acquire apt lock"; exit 1; }
apt-get install -y -qq postgresql postgresql-client postgresql-contrib >/tmp/bds-pg-restore-install.log 2>&1 || { tail -120 /tmp/bds-pg-restore-install.log; exit 1; }
systemctl enable --now postgresql >/dev/null

if [ -s "$pass_file" ]; then
  db_pass=$(cat "$pass_file")
else
  db_pass=$(openssl rand -hex 24)
  umask 077
  printf '%s' "$db_pass" > "$pass_file"
fi

echo "RESTORE_POSTGRES"
if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$db_user'" | grep -q 1; then
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "CREATE ROLE $db_user LOGIN PASSWORD '$db_pass';" >/dev/null
else
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "ALTER ROLE $db_user WITH LOGIN PASSWORD '$db_pass';" >/dev/null
fi
if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='$db_name'" | grep -q 1; then
  runuser -u postgres -- createdb -O "$db_user" "$db_name"
fi
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -d "$db_name" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public AUTHORIZATION $db_user;" >/dev/null
PGPASSWORD="$db_pass" pg_restore -h 127.0.0.1 -U "$db_user" -d "$db_name" --no-owner --no-privileges "$workdir/x-ui-postgres.dump"

echo "CONFIGURE_PANEL"
dsn="postgres://$db_user:$db_pass@127.0.0.1:5432/$db_name?sslmode=disable"
if [ -f "$workdir/x-ui-default.env" ]; then
  grep -v -E '^(XUI_DB_TYPE|XUI_DB_DSN)=' "$workdir/x-ui-default.env" > /etc/default/x-ui || true
else
  : > /etc/default/x-ui
fi
{
  echo 'XUI_DB_TYPE=postgres'
  echo "XUI_DB_DSN=$dsn"
} >> /etc/default/x-ui
chmod 600 /etc/default/x-ui

if [ -f /etc/default/x-ui ]; then set -a; . /etc/default/x-ui; set +a; fi
/usr/local/x-ui/x-ui setting -port ${panelPort} -webBasePath ${shellQuote(panelPath)} -listenIP 0.0.0.0 -resetTwoFactor true

domain="${serverName}.burmesedigital.store"
cert=$(find /root/cert /root/.acme.sh -type f \\( -name 'fullchain.pem' -o -name 'fullchain.cer' \\) 2>/dev/null | grep -Fi "$domain" | sort | head -n 1)
key=$(find /root/cert /root/.acme.sh -type f \\( -name 'privkey.pem' -o -name '*.key' \\) 2>/dev/null | grep -Fi "$domain" | sort | head -n 1)
if [ -n "$cert" ] && [ -n "$key" ]; then
  /usr/local/x-ui/x-ui cert -webCert "$cert" -webCertKey "$key" || true
fi

ufw allow ${panelPort}/tcp >/dev/null 2>&1 || true
systemctl daemon-reload
systemctl restart x-ui
sleep 5
systemctl is-active --quiet x-ui
PGPASSWORD="$db_pass" psql -h 127.0.0.1 -U "$db_user" -d "$db_name" -tAc "select 'RESTORED_PG_INBOUNDS=' || count(*) from inbounds;"
/usr/local/x-ui/x-ui version 2>/dev/null || true
`;
}

const conn = await connect();
try {
  console.log(`Connected to ${host}`);
  console.log('Uploading backup archive...');
  await upload(conn, backupPath, remoteBackup);

  const localBackupScript = path.join(process.cwd(), 'scripts', 'backup-xui-db.sh');
  if (fs.existsSync(localBackupScript)) {
    console.log('Uploading PostgreSQL-aware backup script...');
    await upload(conn, localBackupScript, remoteBackupScript);
    await exec(conn, `chmod +x ${shellQuote(remoteBackupScript)} && mkdir -p /root/backup-xui && chmod 700 /root/backup-xui`);
  }

  console.log('Repairing panel and restoring PostgreSQL dump...');
  const output = await exec(conn, buildRemoteRepairCommand(), 1200000);
  console.log(output);
} finally {
  conn.end();
}
