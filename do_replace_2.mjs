import fs from 'fs';

const path = 'src/lib/telegram-bot/handlers/admin.ts';
let code = fs.readFileSync(path, 'utf8');

const typeStart = "export async function handleAdminKeyType(";
const typeEnd = "adminCreateKeyServerKeyboard(serverList, keyType)\n  );\n}";
const typeIdx = code.indexOf(typeStart);
const typeEndIdx = code.indexOf(typeEnd, typeIdx) + typeEnd.length;

if (typeIdx !== -1 && typeEndIdx > typeIdx) {
  const newType = `export async function handleAdminKeyType(
  chatId: number,
  keyType: string,
  messageId?: number
): Promise<void> {
  const label = keyType === 'test' ? '🧪 Test Key' : '🔑 Sell Key';
  await editOrSend(
    chatId,
    messageId,
    \`\${label}\\n\\nProtocol ရွေးပါ:\`,
    adminCreateKeyProtocolKeyboard(keyType, 'all')
  );
}`;
  code = code.substring(0, typeIdx) + newType + code.substring(typeEndIdx);
  fs.writeFileSync(path, code);
  console.log('Replaced successfully');
} else { throw new Error("Could not find handleAdminKeyType"); }
