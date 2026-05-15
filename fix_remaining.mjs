import fs from 'fs';

// Helper to replace text
function replaceInFile(path, fromLine, toLine, replaceFn) {
    if (!fs.existsSync(path)) return;
    let text = fs.readFileSync(path, 'utf8');
    text = replaceFn(text);
    fs.writeFileSync(path, text);
}

// 1. messages.ts
replaceInFile('src/lib/telegram-bot/messages.ts', 0, 0, t => {
   t = t.replace(/export const getWelcomeMessage = \(name, lang\) =>/g, "export const getWelcomeMessage = (name: string, lang: string) =>");
   t = t.replace(/export const getHelpMessage = \(lang\) =>/g, "export const getHelpMessage = (lang: string) =>");
   t = t.replace(/export const getUnknownCommandMessage = \(lang\) =>/g, "export const getUnknownCommandMessage = (lang: string) =>");
   return t;
});

// 2. index.ts -> Expected 2-3 arguments, but got 1 in notifyAdmin (notifyAdmin expects 2)
replaceInFile('src/lib/telegram-bot/index.ts', 0, 0, t => {
   // handle notifyAdmin errors, we'll just add a dummy message type or ensure it's correct
   t = t.replace(/await notifyAdmin\(`❌ Bot error:/g, "await notifyAdmin(`❌ Bot error: ${String(error)}`, 'error'");
   return t;
});

// 3. shop.ts -> shop error Expected 2-3 arguments
replaceInFile('src/lib/telegram-bot/handlers/shop.ts', 0, 0, t => {
    t = t.replace(/await notifyAdmin\(`❌ Payment error/g, "await notifyAdmin(`❌ Payment error`, 'error'");
    return t;
});

// 4. vps.ts
replaceInFile('src/lib/telegram-bot/handlers/vps.ts', 0, 0, t => {
   t = t.replace(/ctx\.answerCbQuery/g, "ctx.answerCallbackQuery");
   t = t.replace(/ctx\.fromUser/g, "ctx.from");
   t = t.replace(/\(ctx\.from\)/g, "ctx.from");
   t = t.replace(/ctx\.answerCallbackQuery\(\)/g, "ctx.answerCallbackQuery()");
   return t;
});

// 5. free-test.ts -> replace ctx.message back to messageId where needed, actually the function didn't have ctx inside the keyboard handlers!
// let's restore free-test isolated messageId issues
replaceInFile('src/lib/telegram-bot/handlers/free-test.ts', 0, 0, t => {
   t = t.replace(/ctx\.message\?\.message_id,/g, "messageId,");
   return t;
});

// 6. admin.ts
replaceInFile('src/lib/telegram-bot/handlers/admin.ts', 0, 0, t => {
    t = t.replace(/Cannot redeclare block-scoped variable 'clientPromise'/g, ""); 
    // Wait, the error is inside the file itself. I will rewrite admin.ts properly for clientPromise
    t = t.replace(/const \{ default: clientPromise \} = await import\('@\/lib\/mongodb'\);/g, "const clientPromise = (await import('@/lib/mongodb')).default;");
    t = t.replace(/const client = await clientPromise;/g, "const mongoose = await import('mongoose');\n  const client = mongoose.connection.getClient();");
    
    // the subLink does not exist on type string -> generateSubscriptionUrl doesn't return string if we replaced it with url string incorrectly.
    t = t.replace(/const res = await provisionVpnKey[^\n]+/g, "const res = await provisionVpnKey(server, keyType, protocol, limitIp, expiryDays, totalGB);\n      const url = `https://burmesedigital.store/api/vpn/sub/${res.token || token}`;");
    
    // configLink
    t = t.replace(/url\.subLink/g, "url"); // wait, if url is string, it has no subLink
    t = t.replace(/url\.configLink/g, "url"); // or something
    
    // randomBytes error
    t = t.replace(/const token = randomBytes/g, "const crypto = await import('crypto');\n      const token = crypto.randomBytes(16).toString('hex');");
    
    t = t.replace(/import \{ v4 as uuidv4 \} from 'uuid';\n/g, "");
    
    // Fix undefined
    t = t.replace(/const \{ randomBytes \} = await import\('crypto'\);\n/g, "");
    
    return t;
});

console.log('Fixed more errors');
