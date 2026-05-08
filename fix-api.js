const fs = require('fs');
let content = fs.readFileSync('src/lib/telegram-bot/api.ts', 'utf-8');

const inject = `export async function deleteMessage(chatId: number | string, messageId: number): Promise<boolean> {
  if (!BOT_TOKEN) return false;
  try {
    const res = await fetch(\`\${TELEGRAM_API}/deleteMessage\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}
`;

if (!content.includes('deleteMessage(')) {
    content += '\n' + inject;
    fs.writeFileSync('src/lib/telegram-bot/api.ts', content);
}
