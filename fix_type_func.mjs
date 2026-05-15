import fs from 'fs';

let content = fs.readFileSync('src/lib/telegram-bot/handlers/admin.ts', 'utf8');

const replacement = `export async function handleAdminKeyType(
  chatId: number,
  keyType: string,
  messageId?: number
): Promise<void> {
  const { getEnabledServers } = await import('@/lib/vpn-servers');
  const servers = await getEnabledServers();
  const label = keyType === 'test' ? '🧪 Test Key' : '🔑 Sell Key';
  
  await editOrSend(
    chatId,
    messageId,
    \`\${label}\\n\\nServer ရွေးပါ:\`,
    adminCreateKeyServerKeyboard(servers, keyType)
  );
}

/**
 * Handle server selection → show protocol list
 */
export async function handleAdminKeyServer(
  chatId: number,
  keyType: string,
  serverId: string,
  messageId?: number
): Promise<void> {`;

content = content.replace(/export async function handleAdminKeyType\([\s\S]*?export async function handleAdminKeyServer\(\r?\n\s+chatId: number,\r?\n\s+keyType: string,\r?\n\s+serverId: string,\r?\n\s+messageId\?: number\r?\n\):\s*Promise<void>\s*\{/m, replacement);

fs.writeFileSync('src/lib/telegram-bot/handlers/admin.ts', content);
console.log('Fixed block');
