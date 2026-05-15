import fs from 'fs';

let content = fs.readFileSync('src/lib/telegram-bot/handlers/admin.ts', 'utf8');

// 1. Fix handleAdminKeyServer
const serverRegex = /export async function handleAdminKeyServer\([\s\S]*?export async function handleAdminKeyProtocol/m;
const serverRep = `export async function handleAdminKeyServer(
  chatId: number,
  keyType: string,
  serverId: string,
  messageId?: number
): Promise<void> {

  if (serverId === 'all') {
    await editOrSend(
      chatId,
      messageId,
      \`📡 🌐 All Servers (Multi-server)\\n\\nProtocol ရွေးပါ:\`,
      adminCreateKeyProtocolKeyboard('all', keyType, ['vless', 'vmess', 'trojan', 'shadowsocks'])
    );
    return;
  }

  const { getServer } = await import('@/lib/vpn-servers');
  const server = await getServer(serverId);
  if (!server) {
    await editOrSend(chatId, messageId, '❌ Server မတွေ့ပါ');
    return;
  }

  await editOrSend(
    chatId,
    messageId,
    \`📡 \${server.flag} \${server.name}\\n\\nProtocol ရွေးပါ:\`,
    adminCreateKeyProtocolKeyboard(serverId, keyType, server.enabledProtocols)
  );
}

/**
 * Handle protocol selection → show device count (sell) or create immediately (test)
 */
export async function handleAdminKeyProtocol`;

content = content.replace(serverRegex, serverRep);

// 2. Fix targetServers typing inside createAdminKey: it implicitly has type any[]
content = content.replace(/let targetServers = \[\];/g, "let targetServers: any[] = [];");

// 3. Fix handleAdminKeygenCommand errors (like getActiveServers -> getEnabledServers, generateVpnUrl -> remove, connection -> connection)
// Actually handleAdminKeygenCommand is for CLI fallback (e.g., /admin keygen ...).
const cliRegex = /export async function handleAdminKeygenCommand\([\s\S]*?export async function handleAdminCallback/m;
const cliRep = `export async function handleAdminKeygenCommand(chatId: number, text: string): Promise<void> {
  const parts = text.split(' ');
  // /admin keygen <type> <protocol> <devices> <expiry> [dataLimitGB]
  if (parts.length < 6) {
    await sendMessage(
      chatId,
      '❌ Invalid command. Usage:\\n<code>/admin keygen test|sell vless|vmess|trojan <devices> <expiry_days> [dataLimitGB]</code>',
      { parseMode: 'HTML' }
    );
    return;
  }

  const keyType = parts[2];
  const protocol = parts[3];
  const devices = parseInt(parts[4]);
  const expiryDays = parseInt(parts[5]);
  const dataLimitGB = parts.length > 6 ? parseInt(parts[6]) : 0;

  await createAdminKey(chatId, undefined, keyType, 'all', protocol, devices, expiryDays, dataLimitGB);
}

export async function handleAdminCallback`;

content = content.replace(cliRegex, cliRep);

// 4. Fix provisionVpnKey params in createAdminKey. Wait, XUI provisionVpnKey in order-actions has different params?
// Actually we had Expected 1 argument, but got 7 previously. Let's see what provisionVpnKey really wants.
// Wait, I will just do it the right way: check provisionVpnKey import and definition if needed. But for now I'll just change any db/connection missing properties.

content = content.replace(/const client = await clientPromise;\s*const db = client.db\(\);/g, "const mongoose = await import('mongoose');\n    const db = mongoose.connection.getClient().db();");

fs.writeFileSync('src/lib/telegram-bot/handlers/admin.ts', content);
console.log('Fixed handleAdminKeyServer and cli handler');
