const fs = require('fs');
const mongoose = require('mongoose');

function loadEnv(path) {
  const txt = fs.readFileSync(path, 'utf8');
  const lines = txt.split(/\r?\n/);
  const env = {};
  for (const l of lines) {
    const m = l.match(/^\s*([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

(async function(){
  try {
    const env = loadEnv('.env.local');
    const uri = env.MONGODB_URI;
    if (!uri) {
      console.error('MONGODB_URI not found in .env.local');
      process.exit(1);
    }
    await mongoose.connect(uri, { dbName: 'burmese-digital-store' });
    const db = mongoose.connection.getClient().db();
    const docs = await db.collection('vpn_keys').find({}, { projection: { token:1, username:1, expiryTime:1, createdAt:1, serverSubLinks:1 } }).sort({ createdAt: -1 }).limit(20).toArray();
    console.log('Found', docs.length, 'vpn_keys');
    for (const d of docs) {
      console.log(JSON.stringify(d, null, 2));
    }
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error', err);
    process.exit(2);
  }
})();
