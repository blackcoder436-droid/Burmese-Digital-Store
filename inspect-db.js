const Database = require('better-sqlite3');
const db = new Database('backups/backup_backup.db', { readonly: true });
const tables = db.prepare("select name from sqlite_master where type='table' order by name").all().map(r => r.name);
console.log('TABLES', tables);
for (const table of tables) {
  try {
    const row = db.prepare(`select count(*) as c from ${table}`).get();
    console.log('COUNT', table, row.c);
  } catch (e) {
    console.log('COUNTERR', table, e.message);
  }
}
for (const table of ['users','settings','inbounds','clients','nodes','accounts']) {
  try {
    const rows = db.prepare(`select * from ${table} limit 3`).all();
    console.log('ROWS', table, JSON.stringify(rows));
  } catch (e) {
    console.log('ROWSERR', table, e.message);
  }
}
