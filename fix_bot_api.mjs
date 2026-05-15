import fs from 'fs';

let adminFile = fs.readFileSync('src/lib/telegram-bot/handlers/admin.ts', 'utf8');

adminFile = adminFile.replace(
`      const token = crypto.randomBytes(16).toString('hex');
      const subLink = \`https://burmesedigital.store/api/vpn/sub/\${token}\`;
  
      for (const server of targetServers) {
        try {
          const result = await provisionVpnKey({ serverId: server.id, userId: 'admin_bot_' + chatId, devices, expiryDays, dataLimitGB, protocol, username });
          if (result && result.success) {
             links.push(\`💻 <b>\${server.flag || '🏳️'} \${server.name.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</b>\`);
          } else {
             errCount++;
          }
        } catch (e) {
          errCount++;
        }
      }
  
      if (links.length === 0) {`,
`      const token = crypto.randomBytes(16).toString('hex');
      const subLink = \`https://burmesedigital.store/api/vpn/sub/\${token}\`;
  
      const serverSubLinks: string[] = [];

      const provisionPromises = targetServers.map(async (server) => {
        try {
          const result = await provisionVpnKey({ serverId: server.id, userId: 'admin_bot_' + chatId, devices, expiryDays, dataLimitGB, protocol, username });
          if (result && result.success) {
             return { success: true, server, result };
          } else {
             return { success: false };
          }
        } catch (e) {
          return { success: false };
        }
      });

      const promisesResults = await Promise.all(provisionPromises);
      for (const res of promisesResults) {
         if (res.success && res.server && res.result) {
            links.push(\`💻 <b>\${res.server.flag || '🏳️'} \${res.server.name.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</b>\`);
            serverSubLinks.push(res.result.subLink);
         } else {
            errCount++;
         }
      }
  
      if (links.length === 0) {`
);

adminFile = adminFile.replace(
`      await db.collection('vpn_keys').insertOne({
          userId: 'admin_bot_' + chatId,
          token: token,
          username: username,
          keyType: keyType,
          protocol,
          devices,
          expiryDays,
          dataLimitGB,
          createdAt: new Date(),
          status: 'active'
      });`,
`      await db.collection('vpn_keys').insertOne({
          userId: 'admin_bot_' + chatId,
          token: token,
          username: username,
          keyType: keyType,
          protocol,
          devices,
          expiryDays,
          expiryTime: Date.now() + expiryDays * 24 * 60 * 60 * 1000,
          dataLimitGB,
          createdAt: new Date(),
          status: 'active',
          serverSubLinks
      });`
);

fs.writeFileSync('src/lib/telegram-bot/handlers/admin.ts', adminFile);

console.log('Fixed Bot API keys creation!');
