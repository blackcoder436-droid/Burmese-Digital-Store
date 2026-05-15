const fs = require('fs');
let code = fs.readFileSync('src/lib/telegram-bot/handlers/admin.ts', 'utf8');

const regex = /const typeLabel =[\s\S]*?await sendMessage\(chatId, resultMsg, \{/;

const newStr = `const typeLabel = keyType === 'test' ? '🧪 TEST KEY' : '🔑 SELL KEY';
    const dataLabel = dataLimitGB === 0 ? 'Unlimited' : \`\${dataLimitGB} GB\`;
    const expiryDate = new Date(result.expiryTime).toLocaleDateString('en-GB');

    const resultMsgArr = [
      \`✅ <b>\${typeLabel} Created! (Multi-Server)</b>\`,
      '',
      \`🔧 Protocol: \${protocol.toUpperCase()}\`,
      \`📱 Devices: \${devices}\`,
      \`📅 Expiry: \${expiryDays} days (\${expiryDate})\`,
      \`📊 Data: \${dataLabel}\`,
      '',
      \`📋 <b>Subscription Links:</b>\`,
    ];

    for (const link of multiServerLinks) {
      resultMsgArr.push(\`🌍 <b>\${link.server}</b>:\\n<code>\${link.subLink}</code>\\n\`);
    }
    
    resultMsgArr.push('👆 Link ကိုနှိပ်ပြီး Copy ယူပါ');
    const finalMsg = resultMsgArr.join('\\n');

    // Final result: send as new message (links are important, ensure they display)
    await sendMessage(chatId, finalMsg, {`;

code = code.replace(regex, newStr);
fs.writeFileSync('src/lib/telegram-bot/handlers/admin.ts', code);
