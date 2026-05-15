const fs = require('fs');

let code = fs.readFileSync('src/lib/telegram-bot/handlers/admin.ts', 'utf8');

const startIdx = code.indexOf('async function createAdminKey');

if (startIdx !== -1) {
  let openBraces = 0;
  let endIdx = -1;
  let started = false;

  for (let i = startIdx; i < code.length; i++) {
    if (code[i] === '{') {
      openBraces++;
      started = true;
    } else if (code[i] === '}') {
      openBraces--;
      if (started && openBraces === 0) {
        endIdx = i;
        break;
      }
    }
  }

  if (endIdx !== -1) {
    const oldFunc = code.substring(startIdx, endIdx + 1);

    const newFunc = `async function createAdminKey(
  chatId: number,
  messageId: number | undefined,
  keyType: string,
  serverId: string, // Kept to match signature, but ignored
  protocol: string,
  devices: number,
  expiryDays: number,
  dataLimitGB: number
): Promise<void> {

  const { getEnabledServers } = await import('@/lib/vpn-servers');
  const { provisionVpnKey } = await import('@/lib/xui');

  await editOrSend(chatId, messageId, '⏳ Key ဖန်တီးနေပါသည်... (Multi-Server)');

  try {
    const activeServers = await getEnabledServers();
    if (activeServers.length === 0) {
      await sendMessage(chatId, '❌ Active server မရှိသေးပါ။ Server များကို အရင် check ပါ။', { replyMarkup: adminPanelKeyboard() });
      return;
    }

    const multiServerLinks: string[] = [];
    const multiConfigLinks: string[] = [];
    const label = keyType === 'test' ? 'test' : 'admin';
    const prefix = \`\${label}_\${Date.now().toString(36)}\`;

    for (const server of activeServers) {
      try {
        const username = prefix + '_' + server.name.replace(/\\s+/g, '-');
        
        const keyData = await provisionVpnKey({
          serverId: server.id,
          username,
          userId: \`admin_bot_\${chatId}\`,
          devices,
          expiryDays,
          dataLimitGB,
          protocol
        });

        if (keyData && keyData.subLink) {
          multiServerLinks.push(\`\${server.flag} \${server.name}:\\n<code>\${keyData.subLink}</code>\`);
          if (keyData.configLink) {
            multiConfigLinks.push(\`\${server.flag} \${server.name}:\\n<code>\${keyData.configLink}</code>\`);
          }
        }
      } catch (err) {
         log.error(\`Bot admin failed to provision on \${server.id}\`, { error: String(err) });
      }
    }

    if (multiServerLinks.length === 0) {
      await sendMessage(chatId, '❌ Key များ ဖန်တီးရာတွင် အမှားဖြစ်ပါသည်။ Server ချိတ်ဆက်မှု စစ်ဆေးပါ', {
        replyMarkup: adminPanelKeyboard(),
      });
      return;
    }

    const typeLabel = keyType === 'test' ? '🧪 TEST KEY' : '🔑 SELL KEY';
    const dataLabel = dataLimitGB === 0 ? 'Unlimited' : \`\${dataLimitGB} GB\`;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + expiryDays);

    const resultMsg = [
      \`✅ <b>\${typeLabel} Created on \${multiServerLinks.length} Servers!</b>\`,
      '',
      \`🔧 Protocol: \${protocol.toUpperCase()}\`,
      \`📱 Devices: \${devices}\`,
      \`📅 Expiry: \${expiryDays} days (\${expiryDate.toLocaleDateString('en-GB')})\`,
      \`📊 Data: \${dataLabel}\`,
      '',
      \`📋 <b>Subscription Links:</b>\`,
      multiServerLinks.join('\\n\\n'),
      '',
      \`📋 <b>Config Links:</b>\`,
      multiConfigLinks.join('\\n\\n'),
      '',
      '👆 Link ကိုနှိပ်ပြီး Copy ယူပါ'
    ].join('\\n');

    await sendMessage(chatId, resultMsg, {
      replyMarkup: adminPanelKeyboard(),
      parse_mode: 'HTML'
    });

  } catch (error: any) {
    log.error('Admin create key error', { error: error?.message });
    await sendMessage(chatId, '❌ Key ဖန်တီးရာတွင် အမှားဖြစ်ပါသည်', {
      replyMarkup: adminPanelKeyboard(),
    });
  }
}`;

    code = code.replace(oldFunc, newFunc);
    
    // Quick patch for handleAdminKeyType to bypass Server Selection automatically.
    // The user clicks "Test Key" -> bypasses Server -> Goes straight to Protocol.
    code = code.replace(
      /export async function handleAdminKeyType\([\s\S]*?\}\s*?\}/,
      `export async function handleAdminKeyType(
  chatId: number,
  keyType: string,
  messageId?: number
): Promise<void> {
  // Bypassing server step, directly advancing to protocol step
  const label = keyType === 'test' ? '🧪 Test Key' : '🔑 Sell Key';
  await editOrSend(
    chatId,
    messageId,
    \`\${label}\\n\\nProtocol ရွေးပါ:\`,
    adminCreateKeyProtocolKeyboard(keyType, 'all_servers')
  );
}`
    );

    fs.writeFileSync('src/lib/telegram-bot/handlers/admin.ts', code);
    console.log("Success");
  }
}
