import { sendMessage, editMessageText } from '../api';
import { adminPanelKeyboard, adminCreateKeyTypeKeyboard } from '../keyboards';
import { getServer, getEnabledServers } from '@/lib/vpn-servers';
import { provisionVpnKey } from '@/lib/xui';
import { createLogger } from '@/lib/logger';
import { getSession, setSession, clearSession } from '../session';
import crypto from 'crypto';

const log = createLogger({ route: 'telegram-bot/admin' });

async function editOrSend(chatId: number, messageId: number | undefined, text: string, options?: any) {
  if (messageId) {
    try {
      await editMessageText(chatId, messageId, text, options);
    } catch {
      await sendMessage(chatId, text, options);
    }
  } else {
    await sendMessage(chatId, text, options);
  }
}

export async function handleAdminCommand(chatId: number, text: string): Promise<void> {
  const keyboard = adminPanelKeyboard();
  await sendMessage(chatId, '👨‍💻 <b>Admin Panel</b>\n\nChoose an action:', {
    replyMarkup: keyboard,
  });
}

export async function handleAdminKeygenCommand(chatId: number, text: string): Promise<void> {
  const parts = text.split(' ');
  const name = parts[1];
  const paramDays = Number(parts[2]);
  const days = Number.isNaN(paramDays) ? 30 : paramDays;
  const paramLimit = Number(parts[3]);
  const limitIp = Number.isNaN(paramLimit) ? 2 : paramLimit;
  const protocol = parts[4] || 'vless';

  if (!name) {
    await sendMessage(chatId, '❌ Format လွဲနေပါသည်။\n\n<b>Usage:</b>\n/keygen &lt;Name&gt; &lt;Days&gt; &lt;DeviceLimit&gt; [Protocol]\n\n<b>Example:</b>\n/keygen VIP-Aung 30 2', {
      parseMode: 'HTML'
    });
    return;
  }

  await sendMessage(chatId, '⏳ Multis-server key ဖန်တီးနေပါသည်... ခဏစောင့်ပါ။');

  try {
    const activeServers = await getEnabledServers();
    if (activeServers.length === 0) {
      await sendMessage(chatId, '❌ Active server မရှိသေးပါ။ Server များကို အရင် check ပါ။');
      return;
    }

    const multiServerLinks: string[] = [];
    const multiConfigLinks: string[] = [];
    const sanitizedName = name.replace(/\s+/g, '-').slice(0, 20);
    const prefix = `bot_${crypto.randomUUID().slice(0, 4)}_${sanitizedName}`;

    for (const server of activeServers) {
      try {
        const username = prefix + '_' + server.name.replace(/\s+/g, '-');
        
        const keyData = await provisionVpnKey({
          serverId: server.id,
          username,
          userId: `admin_bot_${chatId}`,
          devices: limitIp,
          expiryDays: days,
          dataLimitGB: 0,
          protocol
        });

        if (keyData && keyData.subLink) {
          multiServerLinks.push(`${server.flag} ${server.name} :\n<code>${keyData.subLink}</code>`);
          if (keyData.configLink) {
            multiConfigLinks.push(`${server.flag} ${server.name} :\n<code>${keyData.configLink}</code>`);
          }
        }
      } catch (err) {
        log.error(`Bot admin failed to provision on ${server.id}`, { error: String(err) });
      }
    }

    if (multiServerLinks.length === 0) {
       await sendMessage(chatId, '❌ Key များ ဖန်တီး၍ မရပါ။ Server Error.');
       return;
    }

    const resultMsg = [
      `✅ <b>Custom Key Created on ${multiServerLinks.length} Servers!</b>`,
      '',
      `👤 Name: ${name}`,
      `🔧 Protocol: ${protocol.toUpperCase()}`,
      `📱 Devices: ${limitIp}`,
      `📅 Expiry: ${days} days`,
      '',
      `📋 <b>Subscription Links:</b>`,
      multiServerLinks.join('\n\n'),
      '',
      `📋 <b>Config Links (Optional):</b>`,
      multiConfigLinks.join('\n\n'),
      '',
      '👆 Link များကိုနှိပ်ပြီး Copy ယူပါ'
    ].join('\n');

    await sendMessage(chatId, resultMsg, {
      parseMode: 'HTML'
    });

  } catch (error: any) {
    log.error('Custom keygen error', { error: error.message });
    await sendMessage(chatId, '❌ Error: ' + error.message);
  }
}

async function createAdminKey(
  chatId: number,
  messageId: number | undefined,
  keyType: string,
  serverId: string, // ignored
  protocol: string,
  devices: number,
  expiryDays: number,
  dataLimitGB: number
): Promise<void> {

  await editOrSend(chatId, messageId, '⏳Multi-server Key ဖန်တီးနေပါသည်...');

  try {
    const activeServers = await getEnabledServers();
    if (activeServers.length === 0) {
      await editOrSend(chatId, messageId, '❌ Active server မရှိသေးပါ။ Server များကို အရင် check ပါ။');
      return;
    }

    const multiServerLinks: string[] = [];
    const multiConfigLinks: string[] = [];
    const label = keyType === 'test' ? 'test' : 'admin';
    const prefix = `${label}_bot_${crypto.randomUUID().slice(0, 4)}`;

    for (const server of activeServers) {
      try {
        const username = prefix + '_' + server.name.replace(/\s+/g, '-');
        
        const keyData = await provisionVpnKey({
          serverId: server.id,
          username,
          userId: `admin_bot_${chatId}`,
          devices,
          expiryDays,
          dataLimitGB,
          protocol
        });

        if (keyData && keyData.subLink) {
          multiServerLinks.push(`${server.flag} ${server.name}:\n<code>${keyData.subLink}</code>`);
          if (keyData.configLink) {
            multiConfigLinks.push(`${server.flag} ${server.name}:\n<code>${keyData.configLink}</code>`);
          }
        }
      } catch (err) {
        log.error(`Bot admin failed to provision on ${server.id}`, { error: String(err) });
      }
    }

    if (multiServerLinks.length === 0) {
      await sendMessage(chatId, '❌ Key များ ဖန်တီးရာတွင် အမှားဖြစ်ပါသည်။ Server ချိတ်ဆက်မှု စစ်ဆေးပါ', {
        replyMarkup: adminPanelKeyboard(),
      });
      return;
    }

    const typeLabel = keyType === 'test' ? '🧪 TEST KEYS' : '🔑 SELL KEYS';
    const dataLabel = dataLimitGB === 0 ? 'Unlimited' : `${dataLimitGB} GB`;
    
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + expiryDays);

    const resultMsg = [
      `✅ <b>${typeLabel} Created on ${multiServerLinks.length} Servers!</b>`,
      '',
      `🔧 Protocol: ${protocol.toUpperCase()}`,
      `📱 Devices: ${devices}`,
      `📅 Expiry: ${expiryDays} days (${expiryDate.toLocaleDateString('en-GB')})`,
      `📊 Data: ${dataLabel}`,
      '',
      `📋 <b>Subscription Links:</b>`,
      multiServerLinks.join('\n\n'),
      '',
      `📋 <b>Config Links:</b>`,
      multiConfigLinks.join('\n\n'),
      '',
      '👆 Link ကိုနှိပ်ပြီး Copy ယူပါ',
    ].join('\n');

    await sendMessage(chatId, resultMsg, {
      replyMarkup: adminPanelKeyboard(),
    });

    log.info('Admin created multi-server VPN key via bot', {
      keyType,
      devices,
      expiryDays,
    });
  } catch (error: any) {
    log.error('Admin create key error', { error: error?.message });
    await sendMessage(chatId, '❌ Key ဖန်တီးရာတွင် အမှားဖြစ်ပါသည်', {
      replyMarkup: adminPanelKeyboard(),
    });
  }
}

export async function handleAdminCallback(
  chatId: number,
  data: string,
  messageId?: number
): Promise<void> {
  const parts = data.split('_');
  const action = parts[1];

  switch (action) {
    case 'stats':
      await handleKeygenStartFlow(chatId, messageId);
      break;

    case 'keygenFlow':
      await handleKeygenStartFlow(chatId, messageId);
      break;

    case 'selectServer':
      const flowType = parts[2]; 
      
      await editOrSend(chatId, messageId, 
        `💡 <b>${flowType.toUpperCase()} Key Custom Setup</b>\n\n` + 
        `Key ကို ကိုယ်တိုင် name, expire date, device limit သတ်မှတ်ပြီး ထုတ်ရန်:\n`+
        `<code>/keygen name days limits protocol</code>\n`+
        `<b>ဥပမာ:</b>\n<code>/keygen test_user 7 2 vless</code>\n\n`+
        `ပုံမှန် Auto Key အလိုအလျောက် ထုတ်ယူလိုလျှင် အောက်ပါခလုတ်ကိုနှိပ်ပါ။`, 
        {
          parseMode: 'HTML',
          replyMarkup: {
            inline_keyboard: [
              [{ text: `🚀 ${flowType.toUpperCase()} Auto Generate`, callback_data: `admin_autoKey_${flowType}` }],
              [{ text: '🔙 Back', callback_data: 'admin_back' }]
            ]
          }
        }
      );
      break;

    case 'autoKey':
      const kType = parts[2] || 'sell'; 
      const dDays = kType === 'test' ? 2 : 30;
      const dIp = kType === 'test' ? 1 : 2;
      clearSession(chatId);
      await createAdminKey(chatId, messageId, kType, 'dummy_all', 'vless', dIp, dDays, 0);
      break;

    case 'back':
      clearSession(chatId);
      await editOrSend(chatId, messageId, '👨‍💻 <b>Admin Panel</b>', {
        replyMarkup: adminPanelKeyboard(),
      });
      break;

    default:
      log.warn(`Unknown admin callback action: ${action}`);
  }
}

async function handleKeygenStartFlow(chatId: number, messageId?: number) {
  await editOrSend(chatId, messageId, '🔑 <b>Generate VPN Key</b>\n\nSelect Key Type:', {
    replyMarkup: adminCreateKeyTypeKeyboard(),
  });
}
