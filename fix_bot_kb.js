const fs = require('fs');
let code = fs.readFileSync('src/lib/telegram-bot/handlers/admin.ts', 'utf8');
code = code.replace("adminCreateKeyProtocolKeyboard(keyType, 'all_servers')", "adminCreateKeyProtocolKeyboard('all_servers', keyType, ['trojan', 'vless', 'vmess', 'shadowsocks'])");
fs.writeFileSync('src/lib/telegram-bot/handlers/admin.ts', code);
