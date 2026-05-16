import { findClientByConfigLinkAcrossServers } from './src/lib/xui';
import mongoose from 'mongoose';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vpn');
  console.log('connected to db');
  try {
    const configLink = "vless://840aa416-4a91-449b-bcba-3fdf6543e225@sg1.burmesedigital.store:20256?type=ws&encryption=none&path=%2F&host=&security=none#SG1-Dean%20-%201%20Device";
    const client = await findClientByConfigLinkAcrossServers(configLink);
    console.log('client:', client);
  } catch(e) {
    console.error('Error:', e);
  }
  process.exit(0);
}

run().catch(console.error);