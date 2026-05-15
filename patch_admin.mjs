import fs from 'fs';

let content = fs.readFileSync('src/lib/telegram-bot/handlers/admin.ts', 'utf8');

const typeRegex = /export async function handleAdminKeyType[\s\S]*?adminCreateKeyServerKeyboard\(serverList, keyType\)\s*\);\s*}/m;
content = content.replace(typeRegex, `export async function handleAdminKeyType(
  chatId: number,
  keyType: string,
  messageId?: number
): Promise<void> {
  const label = keyType === 'test' ? '🧪 Test Key' : '🔑 Sell Key';
  const { adminCreateKeyProtocolKeyboard } = await import('../keyboards');
  await editOrSend(
    chatId,
    messageId,
    \`\${label}\\n\\nProtocol ရွေးပါ:\`,
    adminCreateKeyProtocolKeyboard(keyType, 'all')
  );
}`);

const createRegex = /async function createAdminKey[\s\S]*?replyMarkup: adminPanelKeyboard\(\),\s*\}\);\s*\}/m;
content = content.replace(createRegex, `async function createAdminKey(
  chatId: number,
  messageId: number | undefined,
  keyType: string,
  _serverId: string,
  protocol: string,
  devices: number,
  expiryDays: number,
  dataLimitGB: number
): Promise<void> {
  await editOrSend(chatId, messageId, '⏳ Multi-server Key ဖန်တီးနေပါသည်...');

  try {
    const activeServers = await getEnabledServers();
    if (activeServers.length === 0) {
      await sendMessage(chatId, '❌ Active server မရှိပါ', { replyMarkup: adminPanelKeyboard() });
      return;
    }

    const label = keyType === 'test' ? 'test' : 'admin';
    const username = \`\${label}_\${crypto.randomBytes(4).toString('hex')}\`;
    const links: string[] = [];
    let errCount = 0;

    for (const server of activeServers) {
      try {
        const res = await provisionVpnKey({
          serverId: server.id,
          username,
          userId: \`admin_bot_\${chatId}\`,
          devices,
          expiryDays,
          dataLimitGB,
          protocol,
        });
        if (res && res.subscriptionUrl) {
          links.push(\`💻 <b>\${server.name.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</b>: \n<code>\${res.subscriptionUrl}</code>\`);
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
      \`✅ <b>\${typeLabel} (Multi-Server)</b>\`,
      \`\`,
      \`👤 Name: <code>\${username}</code>\`,
      \`📱 Devices: <b>\${devices}</b>\`,
      \`⏳ Duration: <b>\${expiryDays} Days</b>\`,
      \`📅 Expiry: <b>\${dummyExpiryDate}</b>\`,
      \`🌍 Data: <b>\${dataLabel}</b>\`,
      \`\`,
      \`🔗 <b>Subscription Links:</b>\`,
      ...links,
    ];

    if (errCount > 0) {
      resultMsg.push(\`\`, \`⚠️ <i>\${errCount} server(s) failed.</i>\`);
    }

    await sendMessage(chatId, resultMsg.join('\\n'), {
      parseMode: 'HTML',
      replyMarkup: adminPanelKeyboard(),
    });
  } catch (err) {
    const e = err as Error;
    await sendMessage(chatId, \`❌ <b>Error:</b> \${e.message}\`, { parseMode: 'HTML', replyMarkup: adminPanelKeyboard() });
  }
}`);

fs.writeFileSync('src/lib/telegram-bot/handlers/admin.ts', content);
