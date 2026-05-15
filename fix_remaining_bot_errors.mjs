import fs from 'fs';

function replaceInFile(path, replaceFn) {
    if (!fs.existsSync(path)) return;
    let text = fs.readFileSync(path, 'utf8');
    text = replaceFn(text);
    fs.writeFileSync(path, text);
}

// 1. messages.ts
replaceInFile('src/lib/telegram-bot/messages.ts', t => {
   t = t.replace(/export const getWelcomeMessage = \(name, lang\) =>/g, "export const getWelcomeMessage = (name: string, lang: string) =>");
   t = t.replace(/export const getHelpMessage = \(lang\) =>/g, "export const getHelpMessage = (lang: string) =>");
   t = t.replace(/export const getUnknownCommandMessage = \(lang\) =>/g, "export const getUnknownCommandMessage = (lang: string) =>");
   return t;
});

// 2. index.ts -> notifyAdmin
replaceInFile('src/lib/telegram-bot/index.ts', t => {
   t = t.replace(/await notifyAdmin\(`❌ Bot error:/g, "await notifyAdmin(`❌ Bot error: ${String(error)}`, 'error'");
   return t;
});

// 3. shop.ts -> shop error Expected 2-3 arguments
replaceInFile('src/lib/telegram-bot/handlers/shop.ts', t => {
    t = t.replace(/await notifyAdmin\(`❌ Payment error/g, "await notifyAdmin(`❌ Payment error`, 'error'");
    return t;
});

// 4. vps.ts
replaceInFile('src/lib/telegram-bot/handlers/vps.ts', t => {
   t = t.replace(/ctx\.answerCbQuery/g, "ctx.answerCallbackQuery");
   t = t.replace(/ctx\.fromUser/g, "ctx.from");
   t = t.replace(/\(ctx\.from\)/g, "ctx.from");
   t = t.replace(/ctx\.answerCallbackQuery\(\)/g, "ctx.answerCallbackQuery()");
   return t;
});

// 5. free-test.ts -> messageId context stuff
replaceInFile('src/lib/telegram-bot/handlers/free-test.ts', t => {
   t = t.replace(/ctx\.message\?\.message_id,/g, "messageId,");
   return t;
});

console.log('Fixed Telegram Bot ts files');
