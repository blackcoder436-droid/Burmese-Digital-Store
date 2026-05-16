import { findClientBySubIdAcrossServers } from './src/lib/xui';
import mongoose from 'mongoose';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vpn');
  console.log('connected to db');
  const client = await findClientBySubIdAcrossServers('1om95seh63pdnh6l');
  console.log('client:', client);
  process.exit(0);
}

run().catch(console.error);