const fs = require('fs');

const editHelper = `
async function reply(chatId, messageId, text, options) {
  if (messageId) {
    const api = await import('../api');
    await api.editMessageText(chatId, messageId, text, options);
  } else {
    const api = await import('../api');
    await api.sendMessage(chatId, text, options);
  }
}
`;

let content = fs.readFileSync('src/lib/telegram-bot/handlers/purchase.ts', 'utf8');

if (!content.includes('async function reply(')) {
    content = content.replace("const log = createLogger({ module: 'bot-purchase' });", "const log = createLogger({ module: 'bot-purchase' });\n" + editHelper);
    
    // Add messageId to handleBuyKey
    content = content.replace(
        'export async function handleBuyKey(\n  chatId: number,\n  telegramId: number\n): Promise<void> {',
        'export async function handleBuyKey(\n  chatId: number,\n  telegramId: number,\n  messageId?: number\n): Promise<void> {'
    );

    // Add messageId to handleServerSelect
    content = content.replace(
        'export async function handleServerSelect(\n  chatId: number,\n  telegramId: number,\n  serverId: string\n): Promise<void> {',
        'export async function handleServerSelect(\n  chatId: number,\n  telegramId: number,\n  serverId: string,\n  messageId?: number\n): Promise<void> {'
    );

    // Add messageId to handleProtocolSelect
    content = content.replace(
        'export async function handleProtocolSelect(\n  chatId: number,\n  telegramId: number,\n  serverId: string,\n  protocol: string\n): Promise<void> {',
        'export async function handleProtocolSelect(\n  chatId: number,\n  telegramId: number,\n  serverId: string,\n  protocol: string,\n  messageId?: number\n): Promise<void> {'
    );

    // Add messageId to handleDeviceSelect
    content = content.replace(
        'export async function handleDeviceSelect(\n  chatId: number,\n  telegramId: number,\n  serverId: string,\n  devices: number\n): Promise<void> {',
        'export async function handleDeviceSelect(\n  chatId: number,\n  telegramId: number,\n  serverId: string,\n  devices: number,\n  messageId?: number\n): Promise<void> {'
    );

    // Add messageId to handlePlanSelect
    content = content.replace(
        'export async function handlePlanSelect(\n  chatId: number,\n  telegramId: number,\n  firstName: string,\n  username: string | undefined,\n  serverId: string,\n  planId: string\n): Promise<void> {',
        'export async function handlePlanSelect(\n  chatId: number,\n  telegramId: number,\n  firstName: string,\n  username: string | undefined,\n  serverId: string,\n  planId: string,\n  messageId?: number\n): Promise<void> {'
    );

    // Add messageId to handleSendScreenshot
    content = content.replace(
        'export async function handleSendScreenshot(\n  chatId: number,\n  telegramId: number,\n  orderId: string\n): Promise<void> {',
        'export async function handleSendScreenshot(\n  chatId: number,\n  telegramId: number,\n  orderId: string,\n  messageId?: number\n): Promise<void> {'
    );

    content = content.replace(/await sendMessage\(chatId,/g, 'await reply(chatId, messageId,');
    
    // Fix implicit any
    content = content.replace('async function reply(chatId, messageId, text, options)', 'async function reply(chatId: any, messageId: any, text: any, options?: any)');

    fs.writeFileSync('src/lib/telegram-bot/handlers/purchase.ts', content);
    console.log("Updated purchase.ts");
}
