import fs from 'fs';
let code = fs.readFileSync('src/lib/telegram-bot/handlers/admin.ts', 'utf8');

// 1. Fix handleAdminKeyType
code = code.replace("adminCreateKeyProtocolKeyboard(keyType, 'all')", "adminCreateKeyProtocolKeyboard('all', keyType, ['vless', 'vmess', 'trojan'])");

// 2. Fix generateVpnUrl import usage (it was probably provisionVpnKey?)
// actually in handleAdminKeygenCommand, the dynamic import uses generateVpnUrl:
// const { getActiveServers, generateVpnUrl } = await import('@/lib/vpn-servers');
// We should replace that with getEnabledServers and xui provisionVpnKey
code = code.replace(/const \{ getActiveServers, generateVpnUrl \} = await import\('@\/lib\/vpn-servers'\);/g, "const { getEnabledServers } = await import('@/lib/vpn-servers');\n    const { provisionVpnKey } = await import('@/lib/xui');");
code = code.replace(/const activeServers = await getActiveServers\(\);/g, "const activeServers = await getEnabledServers();");
code = code.replace(/const db = \(await mongoClient\)\.db\(\);/g, "const db = (await mongoClient).connection.db;");

// Fix UUID error (it's using randomBytes from crypto already, probably somewhere we need to make sure)
code = code.replace(/const \{ randomBytes \} = await import\('crypto'\);/g, ""); // Remove it if it exists inside handleAdminKeygenCommand
code = code.replace(/const token = uuidv4\(\);/g, "const { randomBytes } = await import('crypto');\n      const token = randomBytes(16).toString('hex');");
code = code.replace(/import \{ v4 as uuidv4 \} from 'uuid';/g, ""); 

// Fix server.country -> server.flag
code = code.replace(/server\.country/g, "server.flag");

// Fix mongoClient.connection.db
code = code.replace(/const db = mongoClient\.connection\.db;/g, "const mongoClient = (await import('@/lib/mongodb')).default;\n  const db = (await mongoClient).connection?.db || (await mongoClient).db();");

// we'll save it and check TS again.
fs.writeFileSync('src/lib/telegram-bot/handlers/admin.ts', code);
console.log('Fixed admin.ts basic errors');
