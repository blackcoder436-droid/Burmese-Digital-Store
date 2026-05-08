const fs = require('fs');

function replaceAllHelper(path, replacements) {
    let content = fs.readFileSync(path, 'utf-8');
    for (const [oldC, newC] of replacements) {
        content = content.replace(oldC, newC);
    }
    fs.writeFileSync(path, content);
}

const editHelper = `
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

function injectReply(path, moduleName) {
    let content = fs.readFileSync(path, 'utf-8');
    if (!content.includes('async function reply(')) {
        content = content.replace(`const log = createLogger({ module: '${moduleName}' });`, `const log = createLogger({ module: '${moduleName}' });\n${editHelper}`);
        content = content.replace(/await sendMessage\(chatId,/g, 'await reply(chatId, messageId,');
        fs.writeFileSync(path, content);
    }
}

function processFiles() {
    // 1. keys.ts
    injectReply('src/lib/telegram-bot/handlers/keys.ts', 'bot-keys');
    replaceAllHelper('src/lib/telegram-bot/handlers/keys.ts', [
        [
            `export async function handleMyKeys(\n  chatId: number,\n  telegramId: number,\n  firstName: string,\n  username?: string\n): Promise<void> {`,
            `export async function handleMyKeys(\n  chatId: number,\n  telegramId: number,\n  firstName: string,\n  username?: string,\n  messageId?: number\n): Promise<void> {`
        ],
        [
            `export async function handleViewKey(\n  chatId: number,\n  telegramId: number,\n  orderId: string\n): Promise<void> {`,
            `export async function handleViewKey(\n  chatId: number,\n  telegramId: number,\n  orderId: string,\n  messageId?: number\n): Promise<void> {`
        ],
        [
            `export async function handleExchangeKey(\n  chatId: number,\n  telegramId: number\n): Promise<void> {`,
            `export async function handleExchangeKey(\n  chatId: number,\n  telegramId: number,\n  messageId?: number\n): Promise<void> {`
        ],
        [
            `export async function handleExKeySelect(\n  chatId: number,\n  telegramId: number,\n  orderId: string\n): Promise<void> {`,
            `export async function handleExKeySelect(\n  chatId: number,\n  telegramId: number,\n  orderId: string,\n  messageId?: number\n): Promise<void> {`
        ],
        [
            `export async function handleExProtoSelect(\n  chatId: number,\n  telegramId: number,\n  orderId: string,\n  newProtocol: string\n): Promise<void> {`,
            `export async function handleExProtoSelect(\n  chatId: number,\n  telegramId: number,\n  orderId: string,\n  newProtocol: string,\n  messageId?: number\n): Promise<void> {`
        ],
        [
            `export async function handleCheckUsage(\n  chatId: number,\n  telegramId: number,\n  orderId: string\n): Promise<void> {`,
            `export async function handleCheckUsage(\n  chatId: number,\n  telegramId: number,\n  orderId: string,\n  messageId?: number\n): Promise<void> {`
        ]
    ]);

    // 2. referral.ts
    injectReply('src/lib/telegram-bot/handlers/referral.ts', 'bot-referral');
    replaceAllHelper('src/lib/telegram-bot/handlers/referral.ts', [
        [
            `export async function handleReferral(\n  chatId: number,\n  telegramId: number,\n  firstName: string,\n  username?: string\n): Promise<void> {`,
            `export async function handleReferral(\n  chatId: number,\n  telegramId: number,\n  firstName: string,\n  username?: string,\n  messageId?: number\n): Promise<void> {`
        ]
    ]);

    // 3. free-test.ts
    injectReply('src/lib/telegram-bot/handlers/free-test.ts', 'bot-free-test');
    replaceAllHelper('src/lib/telegram-bot/handlers/free-test.ts', [
        [
            `export async function handleFreeTest(\n  chatId: number,\n  telegramId: number,\n  firstName: string,\n  username?: string\n): Promise<void> {`,
            `export async function handleFreeTest(\n  chatId: number,\n  telegramId: number,\n  firstName: string,\n  username?: string,\n  messageId?: number\n): Promise<void> {`
        ],
        [
            `export async function handleFreeTestVerify(\n  chatId: number,\n  telegramId: number,\n  firstName: string,\n  username?: string\n): Promise<void> {`,
            `export async function handleFreeTestVerify(\n  chatId: number,\n  telegramId: number,\n  firstName: string,\n  username?: string,\n  messageId?: number\n): Promise<void> {`
        ],
        [
            `export async function handleFreeServerSelect(\n  chatId: number,\n  telegramId: number,\n  firstName: string,\n  username: string | undefined,\n  serverId: string\n): Promise<void> {`,
            `export async function handleFreeServerSelect(\n  chatId: number,\n  telegramId: number,\n  firstName: string,\n  username: string | undefined,\n  serverId: string,\n  messageId?: number\n): Promise<void> {`
        ],
        [
            `export async function handleFreeProtoSelect(\n  chatId: number,\n  telegramId: number,\n  firstName: string,\n  username: string | undefined,\n  serverId: string,\n  protocol: string\n): Promise<void> {`,
            `export async function handleFreeProtoSelect(\n  chatId: number,\n  telegramId: number,\n  firstName: string,\n  username: string | undefined,\n  serverId: string,\n  protocol: string,\n  messageId?: number\n): Promise<void> {`
        ]
    ]);

    // 4. purchase.ts
    injectReply('src/lib/telegram-bot/handlers/purchase.ts', 'bot-purchase');
    replaceAllHelper('src/lib/telegram-bot/handlers/purchase.ts', [
        [
            `export async function handleBuyKey(\n  chatId: number,\n  telegramId: number\n): Promise<void> {`,
            `export async function handleBuyKey(\n  chatId: number,\n  telegramId: number,\n  messageId?: number\n): Promise<void> {`
        ],
        [
            `export async function handleServerSelect(\n  chatId: number,\n  telegramId: number,\n  serverId: string\n): Promise<void> {`,
            `export async function handleServerSelect(\n  chatId: number,\n  telegramId: number,\n  serverId: string,\n  messageId?: number\n): Promise<void> {`
        ],
        [
            `export async function handleProtocolSelect(\n  chatId: number,\n  telegramId: number,\n  serverId: string,\n  protocol: string\n): Promise<void> {`,
            `export async function handleProtocolSelect(\n  chatId: number,\n  telegramId: number,\n  serverId: string,\n  protocol: string,\n  messageId?: number\n): Promise<void> {`
        ],
        [
            `export async function handleDeviceSelect(\n  chatId: number,\n  telegramId: number,\n  serverId: string,\n  devices: number\n): Promise<void> {`,
            `export async function handleDeviceSelect(\n  chatId: number,\n  telegramId: number,\n  serverId: string,\n  devices: number,\n  messageId?: number\n): Promise<void> {`
        ],
        [
            `export async function handlePlanSelect(\n  chatId: number,\n  telegramId: number,\n  firstName: string,\n  username: string | undefined,\n  serverId: string,\n  planId: string\n): Promise<void> {`,
            `export async function handlePlanSelect(\n  chatId: number,\n  telegramId: number,\n  firstName: string,\n  username: string | undefined,\n  serverId: string,\n  planId: string,\n  messageId?: number\n): Promise<void> {`
        ],
        [
            `export async function handleSendScreenshot(\n  chatId: number,\n  telegramId: number,\n  orderId: string\n): Promise<void> {`,
            `export async function handleSendScreenshot(\n  chatId: number,\n  telegramId: number,\n  orderId: string,\n  messageId?: number\n): Promise<void> {`
        ]
    ]);

    // 5. index.ts updates calls
    let indexTs = fs.readFileSync('src/lib/telegram-bot/index.ts', 'utf-8');
    
    // Replace all handler calls in index.ts to pass ctx.messageId
    indexTs = indexTs.replace(/handleMyKeys\(ctx\.chatId, ctx\.userId, ctx\.firstName, ctx\.username\)/g, 'handleMyKeys(ctx.chatId, ctx.userId, ctx.firstName, ctx.username, ctx.messageId)');
    indexTs = indexTs.replace(/handleViewKey\(ctx\.chatId, ctx\.userId, orderId\)/g, 'handleViewKey(ctx.chatId, ctx.userId, orderId, ctx.messageId)');
    indexTs = indexTs.replace(/handleExchangeKey\(ctx\.chatId, ctx\.userId\)/g, 'handleExchangeKey(ctx.chatId, ctx.userId, ctx.messageId)');
    indexTs = indexTs.replace(/handleExKeySelect\(ctx\.chatId, ctx\.userId, orderId\)/g, 'handleExKeySelect(ctx.chatId, ctx.userId, orderId, ctx.messageId)');
    indexTs = indexTs.replace(/handleExProtoSelect\(ctx\.chatId, ctx\.userId, orderId, protocol\)/g, 'handleExProtoSelect(ctx.chatId, ctx.userId, orderId, protocol, ctx.messageId)');
    indexTs = indexTs.replace(/handleCheckUsage\(ctx\.chatId, ctx\.userId, orderId\)/g, 'handleCheckUsage(ctx.chatId, ctx.userId, orderId, ctx.messageId)');

    indexTs = indexTs.replace(/handleReferral\(ctx\.chatId, ctx\.userId, ctx\.firstName, ctx\.username\)/g, 'handleReferral(ctx.chatId, ctx.userId, ctx.firstName, ctx.username, ctx.messageId)');
    
    indexTs = indexTs.replace(/handleFreeTest\(ctx\.chatId, ctx\.userId, ctx\.firstName, ctx\.username\)/g, 'handleFreeTest(ctx.chatId, ctx.userId, ctx.firstName, ctx.username, ctx.messageId)');
    indexTs = indexTs.replace(/handleFreeTestVerify\(ctx\.chatId, ctx\.userId, ctx\.firstName, ctx\.username\)/g, 'handleFreeTestVerify(ctx.chatId, ctx.userId, ctx.firstName, ctx.username, ctx.messageId)');
    indexTs = indexTs.replace(/handleFreeServerSelect\(ctx\.chatId, ctx\.userId, ctx\.firstName, ctx\.username, serverId\)/g, 'handleFreeServerSelect(ctx.chatId, ctx.userId, ctx.firstName, ctx.username, serverId, ctx.messageId)');
    indexTs = indexTs.replace(/handleFreeProtoSelect\(ctx\.chatId, ctx\.userId, ctx\.firstName, ctx\.username, serverId, protocol\)/g, 'handleFreeProtoSelect(ctx.chatId, ctx.userId, ctx.firstName, ctx.username, serverId, protocol, ctx.messageId)');

    indexTs = indexTs.replace(/handleBuyKey\(ctx\.chatId, ctx\.userId\)/g, 'handleBuyKey(ctx.chatId, ctx.userId, ctx.messageId)');
    indexTs = indexTs.replace(/handleServerSelect\(ctx\.chatId, ctx\.userId, serverId\)/g, 'handleServerSelect(ctx.chatId, ctx.userId, serverId, ctx.messageId)');
    indexTs = indexTs.replace(/handleProtocolSelect\(ctx\.chatId, ctx\.userId, serverId, protocol\)/g, 'handleProtocolSelect(ctx.chatId, ctx.userId, serverId, protocol, ctx.messageId)');
    indexTs = indexTs.replace(/handleDeviceSelect\(ctx\.chatId, ctx\.userId, serverId, +devices\)/g, 'handleDeviceSelect(ctx.chatId, ctx.userId, serverId, devices, ctx.messageId)');
    indexTs = indexTs.replace(/handlePlanSelect\(ctx\.chatId, ctx\.userId, ctx\.firstName, ctx\.username, serverId, planId\)/g, 'handlePlanSelect(ctx.chatId, ctx.userId, ctx.firstName, ctx.username, serverId, planId, ctx.messageId)');
    indexTs = indexTs.replace(/handleSendScreenshot\(ctx\.chatId, ctx\.userId, orderId\)/g, 'handleSendScreenshot(ctx.chatId, ctx.userId, orderId, ctx.messageId)');

    fs.writeFileSync('src/lib/telegram-bot/index.ts', indexTs);
    console.log("All done!");
}

processFiles();
