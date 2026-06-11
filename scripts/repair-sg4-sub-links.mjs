import fs from 'fs';
import { MongoClient } from 'mongodb';

const env = fs.readFileSync('.env.local', 'utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)?.[1]?.trim();
const apply = process.argv.includes('--apply');

if (!uri) {
  console.error('MONGODB_URI not found in .env.local');
  process.exit(1);
}

const BAD_SG4_SUB_RE = /^(https:\/\/sg4\.burmesedigital\.store):209(\/sub\/)/i;

function repairValue(value) {
  return typeof value === 'string'
    ? value.replace(BAD_SG4_SUB_RE, '$1:2096$2')
    : value;
}

function repairArray(values) {
  if (!Array.isArray(values)) return values;
  return values.map(repairValue);
}

const client = await MongoClient.connect(uri);
try {
  const db = client.db();
  const collection = db.collection('vpn_keys');
  const docs = await collection.find({
    $or: [
      { serverSubLinks: /https:\/\/sg4\.burmesedigital\.store:209\/sub\//i },
      { serverConfigLinks: /https:\/\/sg4\.burmesedigital\.store:209\/sub\//i },
      { subLink: /https:\/\/sg4\.burmesedigital\.store:209\/sub\//i },
      { configLink: /https:\/\/sg4\.burmesedigital\.store:209\/sub\//i },
    ],
  }).toArray();

  let changed = 0;
  for (const doc of docs) {
    const update = {};

    const nextServerSubLinks = repairArray(doc.serverSubLinks);
    if (JSON.stringify(nextServerSubLinks) !== JSON.stringify(doc.serverSubLinks)) {
      update.serverSubLinks = nextServerSubLinks;
    }

    const nextServerConfigLinks = repairArray(doc.serverConfigLinks);
    if (JSON.stringify(nextServerConfigLinks) !== JSON.stringify(doc.serverConfigLinks)) {
      update.serverConfigLinks = nextServerConfigLinks;
    }

    for (const field of ['subLink', 'configLink']) {
      const nextValue = repairValue(doc[field]);
      if (nextValue !== doc[field]) update[field] = nextValue;
    }

    if (Object.keys(update).length === 0) continue;
    changed += 1;

    console.log(`${apply ? 'repairing' : 'would repair'} ${doc._id}: ${Object.keys(update).join(', ')}`);
    if (apply) {
      await collection.updateOne({ _id: doc._id }, { $set: update });
    }
  }

  console.log(JSON.stringify({ matched: docs.length, changed, applied: apply }, null, 2));
} finally {
  await client.close();
}
