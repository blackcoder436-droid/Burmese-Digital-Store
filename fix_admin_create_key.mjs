import fs from 'fs';

let code = fs.readFileSync('src/lib/telegram-bot/handlers/admin.ts', 'utf8');

const regex = /async function createAdminKey\([\s\S]*?^export async function handleAdminKeygenCommand/m;

const replacement = `async function createAdminKey(
  chatId: number,
  messageId: number | undefined,
  keyType: string,
  serverId: string,
  protocol: string,
  devices: number,
  expiryDays: number,
  dataLimitGB: number
): Promise<void> {
  await editOrSend(chatId, messageId, '⏳ Key ဖန်တီးနေပါသည်...');

  try {
    const { getEnabledServers, getServer } = await import('@/lib/vpn-servers');
    const { provisionVpnKey } = await import('@/lib/xui');
    const crypto = await import('crypto');

    let targetServers = [];
    if (serverId === 'all') {
      targetServers = await getEnabledServers();
    } else {
      const singleServer = await getServer(serverId);
      if (singleServer) targetServers = [singleServer];
    }

    if (!targetServers || targetServers.length === 0) {
      await sendMessage(chatId, '❌ Active server မရှိပါ', { replyMarkup: adminPanelKeyboard() });
      return;
    }

    const label = keyType === 'test' ? 'test' : 'admin';
    const username = \`\${label}_\${crypto.randomBytes(4).toString('hex')}\`;
    const links: string[] = [];
    let errCount = 0;
    
    const token = crypto.randomBytes(16).toString('hex');
    const subLink = \`https://burmesedigital.store/api/vpn/sub/\${token}\`;

    for (const server of targetServers) {
      try {
        const result = await provisionVpnKey(
           server.id,
           'admin_bot_' + chatId,
           devices,
           expiryDays,
           dataLimitGB,
           protocol,
           username
        );
        if (result && result.success) {
           links.push(\`💻 <b>\${server.flag || '🏳️'} \${server.name.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</b>\`);
        } else {
           errCount++;
        }
      } catch (e) {
        errCount++;
      }
    }

    if (links.length === 0) {
      await sendMessage(chatId, '❌ Key ဖန်တီးရာတွင် အမှားဖြစ်ပါသည်။ Server ချိတ်ဆက်မှု စစ်ဆေးပါ', {
        replyMarkup: adminPanelKeyboard(),
      });
      return;
    }

    const typeLabel = keyType === 'test' ? '🧪 TEST KEY' : '🔑 SELL KEY';
    const dataLabel = dataLimitGB === 0 ? 'Unlimited' : \`\${dataLimitGB} GB\`;
    const dummyExpiryDate = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB');

    const resultMsg = [
      \`✅ <b>\${typeLabel} \${serverId === 'all' ? '(Multi-Server)' : ''}</b>\`,
      \`\`,
      \`👤 Name: <code>\${username}</code>\`,
      \`📱 Devices: <b>\${devices}</b>\`,
      \`⏳ Duration: <b>\${expiryDays} Days</b>\`,
      \`📅 Expiry: <b>\${dummyExpiryDate}</b>\`,
      \`🌍 Data: <b>\${dataLabel}</b>\`,
      \`\`,
      \`🔗 <b>Subscription Link</b>:\`,
      \`<code>\${subLink}</code>\`,
      \`\`,
      ...links,
    ];

    if (errCount > 0) {
      resultMsg.push(\`\`, \`⚠️ <i>\${errCount} server(s) failed.</i>\`);
    }

    const { default: clientPromise } = await import('@/lib/mongodb');
    const client = await clientPromise;
    const db = client.db();
    await db.collection('vpn_keys').insertOne({
        userId: 'admin_bot_' + chatId,
        token: token,
        username,
        keyType,
        protocol,
        devices,
        expiryDays,
        dataLimitGB,
        createdAt: new Date(),
        status: 'active'
    });

    await sendMessage(chatId, resultMsg.join('\\n'), {
      parseMode: 'HTML',
      replyMarkup: adminPanelKeyboard(),
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await sendMessage(chatId, \`❌ <b>Error:</b> \${errorMsg}\`, {
      parseMode: 'HTML',
      replyMarkup: adminPanelKeyboard(),
    });
  }
}

export async function handleAdminKeygenCommand`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/lib/telegram-bot/handlers/admin.ts', code);
console.log('Done');
