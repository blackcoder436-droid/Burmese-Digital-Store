import fs from 'fs';
let content = fs.readFileSync('src/lib/telegram-bot/handlers/admin.ts', 'utf8');

const cliRegex = /export async function handleAdminKeygenCommand\([\s\S]*$/m;
const cliRep = `export async function handleAdminKeygenCommand(chatId: number, text: string): Promise<void> {
  const parts = text.split(' ');
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
}`;

content = content.replace(cliRegex, cliRep);

// And we still have error TS2554: Expected 1 arguments, but got 7 in provisionVpnKey.
// Let's check provisionVpnKey params.
content = content.replace(/await provisionVpnKey\(\s*server\.id,\s*'admin_bot_' \+ chatId,\s*devices,\s*expiryDays,\s*dataLimitGB,\s*protocol,\s*username\s*\)/g, "await provisionVpnKey({ serverId: server.id, userId: 'admin_bot_' + chatId, devices, expiryDays, dataLimitGB, protocol, username })");

fs.writeFileSync('src/lib/telegram-bot/handlers/admin.ts', content);
console.log('Fixed EOF');
