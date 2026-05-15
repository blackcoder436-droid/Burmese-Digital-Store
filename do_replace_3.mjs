import fs from 'fs';
let code = fs.readFileSync('src/lib/telegram-bot/handlers/admin.ts', 'utf8');

// Replace getEnabledServers
code = code.replace(/getEnabledServers/g, 'getAllServers');
code = code.replace(/Object.values\(activeServers\)/g, 'activeServers');

// wait, if activeServers is from getAllServers(), it's a map.
// so we need Object.values(await getAllServers())
code = code.replace(/await getAllServers\(\)/g, 'Object.values(await getAllServers())');

fs.writeFileSync('src/lib/telegram-bot/handlers/admin.ts', code);
console.log('Fixed wrapper issues');
