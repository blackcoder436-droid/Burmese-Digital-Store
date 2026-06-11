import fs from 'fs';
import { MongoClient } from 'mongodb';

const env = fs.readFileSync('.env.local', 'utf8');
const uri = env.match(/^MONGODB_URI=(.*)$/m)?.[1]?.trim();

if (!uri) {
  console.error('MONGODB_URI not found in .env.local');
  process.exit(1);
}

const client = await MongoClient.connect(uri);
try {
  const db = client.db();
  const collections = await db.listCollections().toArray();
  const findings = [];

  for (const { name } of collections) {
    const docs = await db.collection(name).find({
      $or: [
        { serverSubLinks: /sg4\.burmesedigital\.store/i },
        { serverConfigLinks: /sg4\.burmesedigital\.store/i },
        { subLink: /sg4\.burmesedigital\.store/i },
        { configLink: /sg4\.burmesedigital\.store/i },
      ],
    }).limit(50).toArray();

    for (const doc of docs) {
      const links = [
        ...(Array.isArray(doc.serverSubLinks) ? doc.serverSubLinks : []),
        ...(Array.isArray(doc.serverConfigLinks) ? doc.serverConfigLinks : []),
        doc.subLink,
        doc.configLink,
      ].filter((value) => typeof value === 'string' && value.includes('sg4.burmesedigital.store'));

      for (const link of links) {
        const match = link.match(/sg4\.burmesedigital\.store:(\d+)/i);
        findings.push({
          collection: name,
          id: String(doc._id),
          port: match?.[1] || '',
          linkPreview: link.replace(/\/sub\/[^/?#]+/i, '/sub/[redacted]').slice(0, 160),
        });
      }
    }
  }

  console.log(JSON.stringify(findings, null, 2));
} finally {
  await client.close();
}
