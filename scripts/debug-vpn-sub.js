#!/usr/bin/env node
// Simple debug script to inspect or create a vpn_keys entry for testing /api/vpn/sub
// Usage: node scripts/debug-vpn-sub.js <token> [--create-dummy]

import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    console.error('Usage: node scripts/debug-vpn-sub.js <token> [--create-dummy]');
    process.exit(1);
  }
  const token = argv[0];
  const createDummy = argv.includes('--create-dummy');

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/burmese-digital-store';
  const dbName = (() => {
    try {
      const m = uri.match(/\/(\w[\w-]*)\??/);
      return m ? m[1] : 'burmese-digital-store';
    } catch { return 'burmese-digital-store'; }
  })();

  console.log('Using MongoDB URI:', uri.replace(/(:[^:@]+@)/, ':****@'));

  const client = new MongoClient(uri, { connectTimeoutMS: 5000 });
  try {
    await client.connect();
    const db = client.db();

    const vpnKeys = db.collection('vpn_keys');
    const orders = db.collection('orders');

    const key = await vpnKeys.findOne({ token });
    if (key) {
      console.log('Found vpn_keys document:');
      console.log('  token:', key.token);
      console.log('  status:', key.status);
      console.log('  expiryTime:', key.expiryTime ? new Date(key.expiryTime).toString() : 'none');
      console.log('  serverSubLinks:', Array.isArray(key.serverSubLinks) ? key.serverSubLinks.length : 0);
      console.log('  serverConfigLinks:', Array.isArray(key.serverConfigLinks) ? key.serverConfigLinks.length : 0);
      if (Array.isArray(key.serverConfigLinks) && key.serverConfigLinks.length > 0) {
        console.log('  sample config link:', key.serverConfigLinks[0]);
      }
    } else {
      console.log('No vpn_keys doc found for token in vpn_keys collection.');
    }

    const ord = await orders.findOne({ multiSubToken: token });
    if (ord) {
      console.log('Found order with multiSubToken:');
      console.log('  orderId:', ord._id?.toString());
      console.log('  vpnProvisionStatus:', ord.vpnProvisionStatus);
      console.log('  vpnKeys count:', Array.isArray(ord.vpnKeys) ? ord.vpnKeys.length : 0);
    } else {
      console.log('No order found with that multiSubToken.');
    }

    if (!key && createDummy) {
      const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
      const dummy = {
        userId: 'local_test',
        token,
        username: 'local-test',
        keyType: 'admin_web',
        protocol: 'trojan',
        devices: 2,
        expiryDays: 7,
        expiryTime: expiry,
        dataLimitGB: 0,
        createdAt: new Date(),
        status: 'active',
        serverSubLinks: ['https://example.invalid/sub/abcdef1234567890'],
        serverConfigLinks: ['trojan://examplepassword@example.invalid:22716#local-test']
      };
      const res = await vpnKeys.insertOne(dummy);
      console.log('Inserted dummy vpn_keys doc with _id:', res.insertedId.toString());
      console.log('Now calling curl to test /api/vpn/sub endpoint may return the dummy config (if server running).');
    }

  } catch (err) {
    console.error('Error:', err?.message || String(err));
    process.exitCode = 2;
  } finally {
    await client.close();
  }
}

main();
