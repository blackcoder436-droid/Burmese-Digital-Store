const fs = require('fs');

// 1. Fix API
let api = fs.readFileSync('src/app/api/admin/vpn-keys/create/route.ts', 'utf8');

api = api.replace(
  "import { getActiveServers, generateVpnUrl } from '@/lib/vpn-servers';",
  "import { getEnabledServers } from '@/lib/vpn-servers';\nimport { provisionVpnKey } from '@/lib/xui';"
);

api = api.replace(
  "const activeServers = await getActiveServers();",
  "const activeServers = await getEnabledServers();"
);

api = api.replace(
  /generateVpnUrl\(\{[\s\S]*?\}\);/,
  `provisionVpnKey({
          serverId: server.id,
          username: prefix + '_' + server.name.replace(/\\s+/g, '-'),
          userId: 'admin_web',
          devices: deviceLimit,
          expiryDays: days,
          dataLimitGB: 0,
          protocol
        });`
);

fs.writeFileSync('src/app/api/admin/vpn-keys/create/route.ts', api);

// 2. Fix Bot's Keygen Command
let admin = fs.readFileSync('src/lib/telegram-bot/handlers/admin.ts', 'utf8');

admin = admin.replace(
  "const { getActiveServers, generateVpnUrl } = await import('@/lib/vpn-servers');",
  "const { getEnabledServers } = await import('@/lib/vpn-servers');\n    const { provisionVpnKey } = await import('@/lib/xui');"
);

admin = admin.replace(
  "const activeServers = await getActiveServers();",
  "const activeServers = await getEnabledServers();"
);

admin = admin.replace(
  /generateVpnUrl\(\{[\s\S]*?\}\);/g,
  `provisionVpnKey({
          serverId: server.id,
          username: prefix + '_' + server.name.replace(/\\s+/g, '-'),
          userId: 'admin_api',
          devices: limitIp,
          expiryDays: days,
          dataLimitGB: 0,
          protocol
        });`
);

fs.writeFileSync('src/lib/telegram-bot/handlers/admin.ts', admin);
