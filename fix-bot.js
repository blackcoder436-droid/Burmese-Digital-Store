const fs = require('fs');

function processFile(path, replacements) {
    let content = fs.readFileSync(path, 'utf-8');
    for (const [oldStr, newStr] of replacements) {
        content = content.split(oldStr).join(newStr);
    }
    fs.writeFileSync(path, content);
    console.log('Updated ' + path);
}

function processRegex(path, regexes) {
    let content = fs.readFileSync(path, 'utf-8');
    for (const [reg, newStr] of regexes) {
        content = content.replace(reg, newStr);
    }
    fs.writeFileSync(path, content);
    console.log('Regex Updated ' + path);
}

// 1. Update index.ts to pass messageId
processRegex('src/lib/telegram-bot/index.ts', [
    [/handleMyKeys\(ctx\.chatId, ctx\.userId, ctx\.firstName, ctx\.username\)/g, 'handleMyKeys(ctx.chatId, ctx.userId, ctx.firstName, ctx.username, ctx.messageId)'],
    [/handleViewKey\(ctx\.chatId, ctx\.userId, orderId\)/g, 'handleViewKey(ctx.chatId, ctx.userId, orderId, ctx.messageId)'],
    [/handleExchangeKey\(ctx\.chatId, ctx\.userId\)/g, 'handleExchangeKey(ctx.chatId, ctx.userId, ctx.messageId)'],
    [/handleReferral\(ctx\.chatId, ctx\.userId, ctx\.firstName, ctx\.username\)/g, 'handleReferral(ctx.chatId, ctx.userId, ctx.firstName, ctx.username, ctx.messageId)'],
    [/handleFreeTest\(ctx\.chatId, ctx\.userId, ctx\.firstName, ctx\.username\)/g, 'handleFreeTest(ctx.chatId, ctx.userId, ctx.firstName, ctx.username, ctx.messageId)'],
    [/handleFreeTestVerify\(ctx\.chatId, ctx\.userId, ctx\.firstName, ctx\.username\)/g, 'handleFreeTestVerify(ctx.chatId, ctx.userId, ctx.firstName, ctx.username, ctx.messageId)']
]);

// Helper to inject editMessageText utility
const injectEdit = `
async function reply(chatId: any, messageId: any, text: any, options?: any) {
  if (messageId) {
    const api = await import('../api');
    await api.editMessageText(chatId, messageId, text, options);
  } else {
    const api = await import('../api');
    await api.sendMessage(chatId, text, options);
  }
}
`;

// 2. keys.ts
let keysTs = fs.readFileSync('src/lib/telegram-bot/handlers/keys.ts', 'utf-8');
if (!keysTs.includes('reply(chatId, messageId')) {
    keysTs = keysTs.replace(`const log = createLogger({ module: 'bot-keys' });`, `const log = createLogger({ module: 'bot-keys' });\n${injectEdit}`);
    
    keysTs = keysTs.replace(
        `export async function handleMyKeys(\n  chatId: number,\n  telegramId: number,\n  firstName: string,\n  username?: string\n): Promise<void> {`,
        `export async function handleMyKeys(\n  chatId: number,\n  telegramId: number,\n  firstName: string,\n  username?: string,\n  messageId?: number\n): Promise<void> {`
    );
    keysTs = keysTs.replace(/await sendMessage\(chatId,/g, 'await reply(chatId, messageId,');
    
    keysTs = keysTs.replace(
        `export async function handleExchangeKey(\n  chatId: number,\n  telegramId: number\n): Promise<void> {`,
        `export async function handleExchangeKey(\n  chatId: number,\n  telegramId: number,\n  messageId?: number\n): Promise<void> {`
    );

    keysTs = keysTs.replace(
        `export async function handleViewKey(\n  chatId: number,\n  telegramId: number,\n  orderId: string\n): Promise<void> {`,
        `export async function handleViewKey(\n  chatId: number,\n  telegramId: number,\n  orderId: string,\n  messageId?: number\n): Promise<void> {`
    );

    fs.writeFileSync('src/lib/telegram-bot/handlers/keys.ts', keysTs);
}

// 3. referral.ts
let refTs = fs.readFileSync('src/lib/telegram-bot/handlers/referral.ts', 'utf-8');
if (!refTs.includes('reply(chatId, messageId')) {
    refTs = refTs.replace(`const log = createLogger({ module: 'bot-referral' });`, `const log = createLogger({ module: 'bot-referral' });\n${injectEdit}`);
    
    refTs = refTs.replace(
        `export async function handleReferral(\n  chatId: number,\n  telegramId: number,\n  firstName: string,\n  username?: string\n): Promise<void> {`,
        `export async function handleReferral(\n  chatId: number,\n  telegramId: number,\n  firstName: string,\n  username?: string,\n  messageId?: number\n): Promise<void> {`
    );
    refTs = refTs.replace(/await sendMessage\(chatId,/g, 'await reply(chatId, messageId,');
    fs.writeFileSync('src/lib/telegram-bot/handlers/referral.ts', refTs);
}

// 4. free-test.ts
let freeTs = fs.readFileSync('src/lib/telegram-bot/handlers/free-test.ts', 'utf-8');
if (!freeTs.includes('reply(chatId, messageId')) {
    freeTs = freeTs.replace(`const log = createLogger({ module: 'bot-free-test' });`, `const log = createLogger({ module: 'bot-free-test' });\n${injectEdit}`);
    
    freeTs = freeTs.replace(
        `export async function handleFreeTest(\n  chatId: number,\n  telegramId: number,\n  firstName: string,\n  username?: string\n): Promise<void> {`,
        `export async function handleFreeTest(\n  chatId: number,\n  telegramId: number,\n  firstName: string,\n  username?: string,\n  messageId?: number\n): Promise<void> {`
    );
    freeTs = freeTs.replace(
       `export async function handleFreeTestVerify(\n  chatId: number,\n  telegramId: number,\n  firstName: string,\n  username?: string\n): Promise<void> {`,
       `export async function handleFreeTestVerify(\n  chatId: number,\n  telegramId: number,\n  firstName: string,\n  username?: string,\n  messageId?: number\n): Promise<void> {` 
    );
    freeTs = freeTs.replace(/await sendMessage\(chatId,/g, 'await reply(chatId, messageId,');
    fs.writeFileSync('src/lib/telegram-bot/handlers/free-test.ts', freeTs);
}

console.log("Done");
