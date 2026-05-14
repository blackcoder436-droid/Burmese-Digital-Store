const sqlite3 = require('sqlite3');
const fs = require('fs');

const dbPath = `C:\\Users\\Asus\\Downloads\\x-ui (28).db`;

const targets = [
  'Kyaw YE',
  'Ko_HtooHtoo',
  'Rein_2030',
  'admin_mmbm0wpi',
  'Chit Suu',
  'admin_mmbpd549',
  'admin_mmd1rl4e',
  'test_mmd705pn',
  'admin_mmde85c2',
  'Thawdar Win',
  'admin_mmebfams',
  'test_mmebxxgf',
  'admin_mmemonfu',
  'test_mmf0gt9e',
  'Kyi Phyu Sin',
  'Thet Khaing Soe',
  'Akari Kyaw',
  'Lae Yin Tun',
  'test_mminchix',
  'Sabal Phyu',
  'admin_mmjav4fs',
  'barlar972',
  'admin_mmkw0z1o',
  'admin_mmn2caju',
  'Thet - 1D',
  'yanlinnnaing',
  'dataseller202',
  'Aye Chan'
];

if (!fs.existsSync(dbPath)) {
  console.error('DB not found at', dbPath);
  process.exit(1);
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to open DB:', err);
    process.exit(1);
  }
});

function runDeleteTraffic(target) {
  return new Promise((resolve) => {
    db.run("DELETE FROM client_traffics WHERE email LIKE ?", [`%${target}%`], function (err) {
      if (err) {
        console.error('Error deleting traffic for', target, err);
      } else if (this.changes && this.changes > 0) {
        console.log(`Traffic clear '${target}': ${this.changes} rows deleted`);
      }
      resolve();
    });
  });
}

function updateInbounds() {
  return new Promise((resolve) => {
    db.all("SELECT id, settings FROM inbounds", [], (err, rows) => {
      if (err) {
        console.error('Error reading inbounds:', err);
        return resolve();
      }

      let pending = 0;
      rows.forEach((row) => {
        if (!row.settings) return;
        try {
          const settings = JSON.parse(row.settings);
          if (!settings.clients || !Array.isArray(settings.clients)) return;

          const original = settings.clients.length;
          const filtered = settings.clients.filter((c) => {
            const email = (c.email || '').toString();
            const low = email.toLowerCase();
            const matched = targets.some(t => low.includes(t.toLowerCase()));
            if (matched) console.log(`[inbound ${row.id}] Removing matched client: '${email}'`);
            return !matched;
          });

          if (filtered.length < original) {
            pending++;
            const newSettings = JSON.stringify(Object.assign({}, settings, { clients: filtered }));
            db.run('UPDATE inbounds SET settings = ? WHERE id = ?', [newSettings, row.id], function (uErr) {
              if (uErr) console.error('Error updating inbounds', row.id, uErr);
              else console.log(`[inbound ${row.id}] Updated. Count changed ${original} -> ${filtered.length}`);
              pending--;
              if (pending === 0) resolve();
            });
          }
        } catch (e) {
          // ignore JSON parse errors for rows that aren't expected
        }
      });

      if (pending === 0) resolve();
    });
  });
}

async function main() {
  console.log('Starting cleanup on', dbPath);

  // 1) Update inbounds JSONs
  await updateInbounds();

  // 2) Delete traffics
  for (const t of targets) await runDeleteTraffic(t);

  // 3) Verification: list remaining matches in both tables
  console.log('\nVerification: scanning client_traffics for targets...');
  for (const t of targets) {
    await new Promise((res) => {
      db.all('SELECT id, email FROM client_traffics WHERE email LIKE ?', [`%${t}%`], (err, rows) => {
        if (err) console.error('Error scanning traffics for', t, err);
        else if (rows && rows.length) {
          console.log(`Found in client_traffics for '${t}':`);
          rows.forEach(r => console.log('  ', r.email));
        }
        res();
      });
    });
  }

  console.log('\nVerification: scanning inbounds JSON for targets...');
  await new Promise((res) => {
    db.all('SELECT id, settings FROM inbounds', [], (err, rows) => {
      if (err) {
        console.error('Error reading inbounds for verification', err);
        return res();
      }
      rows.forEach(r => {
        try {
          const s = JSON.parse(r.settings || '{}');
          if (s.clients && Array.isArray(s.clients)) {
            s.clients.forEach(c => {
              const email = (c.email || '').toString();
              targets.forEach(t => {
                if (email.toLowerCase().includes(t.toLowerCase())) {
                  console.log(`[inbound ${r.id}] Remaining: ${email}`);
                }
              });
            });
          }
        } catch (e) {}
      });
      res();
    });
  });

  db.close(() => console.log('\nCleanup/verification finished.'));
}

main();
