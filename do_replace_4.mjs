import fs from 'fs';
let code = fs.readFileSync('src/lib/telegram-bot/handlers/admin.ts', 'utf8');

code = code.replace(/res\.subscriptionUrl/g, 'res.subLink');
code = code.replace(/parse_mode/g, 'parseMode');
code = code.replace(/activeServers = await getActiveServers\(\)/g, "serversMap = await getAllServers();\n    const activeServers = Object.values(serversMap)");
code = code.replace(/const db = \(await mongoClient\)\.db\(\);/g, "const db = mongoClient.connection.db;");

fs.writeFileSync('src/lib/telegram-bot/handlers/admin.ts', code);
console.log("Fixed more TS errors");
