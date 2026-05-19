// ==========================================
// Free Test Key Handler
// Channel join verification → free key provisioning
// ==========================================

import crypto from 'crypto';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { getOnlineServers, getServer, getEnabledServers } from '@/lib/vpn-servers';
import { provisionVpnKey } from '@/lib/xui';
import { getFeatureFlag } from '@/models/SiteSettings';
import { sendMessage, getChatMember } from '../api';
import { MSG } from '../messages';
import {
  freeTestJoinKeyboard,
  freeServerKeyboard,
  freeProtocolKeyboard,
  mainMenuKeyboard,
} from '../keyboards';
import { setSession, getSession, clearSession } from '../session';
import { findOrCreateTelegramUser } from './commands';
import { createLogger } from '@/lib/logger';

const log = createLogger({ module: 'bot-free-test' });

async function reply(chatId: any, messageId: any, text: any, options?: any) {
  if (messageId) {
    const api = await import('../api');
    await api.editMessageText(chatId, messageId, text, options);
  } else {
    const api = await import('../api');
    await api.sendMessage(chatId, text, options);
  }
}


const CHANNEL_USERNAME = '@BurmeseDigitalStore';

/**
 * Handle free_test callback — check feature flag, then prompt channel join
 */
export async function handleFreeTest(
  chatId: number,
  telegramId: number,
  firstName: string,
  username?: string,
  messageId?: number
): Promise<void> {
  // Check feature flag
  const enabled = await getFeatureFlag('free_test_key');
  if (!enabled) {
    await reply(chatId, messageId, MSG.notAvailable, {
      replyMarkup: mainMenuKeyboard(),
    });
    return;
  }

  await connectDB();
  const user = await findOrCreateTelegramUser(telegramId, firstName, undefined, username);

  // Check if already used
  if (user.freeVpnTestUsedAt) {
    await reply(chatId, messageId, MSG.freeTestAlreadyUsed, {
      replyMarkup: mainMenuKeyboard(),
    });
    return;
  }

  // Prompt to join channel
  await reply(chatId, messageId, MSG.freeTestJoinChannel, {
    replyMarkup: freeTestJoinKeyboard(),
  });
}

/**
 * Handle free_test_verify callback — check channel membership
 */
export async function handleFreeTestVerify(
  chatId: number,
  telegramId: number,
  firstName: string,
  username?: string,
  messageId?: number
): Promise<void> {
  // Check channel membership
  const member = await getChatMember(CHANNEL_USERNAME, telegramId);
  const isMember = member && ['creator', 'administrator', 'member'].includes(member.status);

  if (!isMember) {
    await reply(chatId, messageId, MSG.freeTestNotJoined, {
      replyMarkup: freeTestJoinKeyboard(),
    });
    return;
  }

  // Show protocol selection for multi-server free test
  const servers = await getOnlineServers();
  if (servers.length === 0) {
    await reply(chatId, messageId, '❌ Server များ ယာယီပိတ်ထားပါသည်');
    return;
  }

  setSession(telegramId, { isFree: true, serverId: 'all' });

  // Use intersection of protocols or just default to vless/trojan if they are in the active servers
  const enabledProtocols = Array.from(
    new Set(servers.flatMap(s => s.enabledProtocols))
  );

  await reply(chatId, messageId, `🎁 <b>Free Test Key (Multi-Server)</b>\n\nProtocol ရွေးပါ:`, {
    replyMarkup: freeProtocolKeyboard('all', enabledProtocols),
  });
}

/**
 * Handle free server selection → show protocol selection (OBSOLETE since we skip server selection for multi-server)
 */
export async function handleFreeServerSelect(
  chatId: number,
  telegramId: number,
  serverId: string,
  messageId?: number
): Promise<void> {
  const server = await getServer(serverId);
  if (!server) {
    await reply(chatId, messageId, MSG.error);
    return;
  }

  setSession(telegramId, {
    ...(getSession(telegramId) || {}),
    serverId,
    isFree: true,
  });

  await reply(chatId, messageId, MSG.selectProtocol(server.name), {
    replyMarkup: freeProtocolKeyboard(serverId, server.enabledProtocols),
  });
}

/**
 * Handle free protocol selection → create free test key immediately
 */
export async function handleFreeProtocolSelect(
  chatId: number,
  telegramId: number,
  firstName: string,
  username: string | undefined,
  serverId: string,
  protocol: string,
  messageId?: number
): Promise<void> {
  try {
    await connectDB();

    const user = await findOrCreateTelegramUser(telegramId, firstName, undefined, username);

    // Double-check not already used
    if (user.freeVpnTestUsedAt) {
      await reply(chatId, messageId, MSG.freeTestAlreadyUsed, {
        replyMarkup: mainMenuKeyboard(),
      });
      return;
    }

    let targetServers: any[] = [];
    if (serverId === 'all') {
      targetServers = await getEnabledServers();
    } else {
      const server = await getServer(serverId);
      if (server) targetServers = [server];
    }

    if (targetServers.length === 0) {
      await reply(chatId, messageId, MSG.error);
      return;
    }

    await reply(chatId, messageId, '⏳ Key ဖန်တီးနေပါသည်...');

    const multiServerLinks: string[] = [];
    const serverSubLinks: string[] = [];
    const sanitizedName = (username || firstName).replace(/\s+/g, '-').slice(0, 20);
    const prefix = `free_${crypto.randomBytes(2).toString('hex')}_${sanitizedName}`;

    const token = crypto.randomBytes(16).toString('hex');
    const masterSubLink = `https://burmesedigital.store/api/vpn/sub/${token}`;

    const provisionPromises = targetServers.map(async (server) => {
      try {
        const finalUsername = serverId === 'all' ? prefix + '_' + server.name.replace(/\s+/g, '-') : prefix;
        const keyData = await provisionVpnKey({
          serverId: server.id,
          username: finalUsername,
          userId: user._id.toString(),
          devices: 1,
          expiryDays: 3, // 72 hours
          dataLimitGB: 3,
          protocol,
        });

        if (keyData && keyData.success) {
           return { serverName: server.name, subLink: keyData.subLink, configLink: keyData.configLink };
        }
        return null;
      } catch (err) {
        log.error(`Failed to provision free key on server ${server.id}:`, { error: err instanceof Error ? err.message : String(err) });
        return null;
      }
    });

    const results = await Promise.all(provisionPromises);
    
    // Process results
    for (const res of results) {
       if (res) {
         multiServerLinks.push(res.serverName);
         serverSubLinks.push(res.subLink);
       }
    }

    if (multiServerLinks.length === 0) {
      await reply(chatId, messageId, '❌ Key ဖန်တီးရာတွင် အမှားဖြစ်ပါသည်။ ပြန်ကြိုးစားပါ');
      return;
    }

    // Save into vpn_keys collection
    const mongoose = await import('mongoose');
    const db = mongoose.connection.getClient().db();
    
    const days = 3;
    const computedExpiryTimeMs = Date.now() + days * 24 * 60 * 60 * 1000;
    
    await db.collection('vpn_keys').insertOne({
        userId: user._id.toString(),
        token: token,
        username: sanitizedName,
        keyType: 'free_test',
        protocol,
        devices: 1,
        expiryDays: days,
        expiryTime: computedExpiryTimeMs,
        dataLimitGB: 3,
        createdAt: new Date(),
        status: 'active',
        serverSubLinks,
    });

    // Mark free test as used
    user.freeVpnTestUsedAt = new Date();
    await user.save();

    clearSession(telegramId);

    // Send key to user
    const linkToSend = serverId === 'all' ? masterSubLink : serverSubLinks[0];
    const serverNameDisplay = serverId === 'all' 
      ? `Multi-Server (${multiServerLinks.length} servers)` 
      : `${targetServers[0].flag} ${targetServers[0].name}`;

    // Create a new message rather than editing if it's cleaner, but edit works too.
    // wait, we changed the MSG.freeTestGenerated format, it takes configLink, we can pass empty string if it's all.
    await reply(
      chatId,
      messageId,
      MSG.freeTestGenerated({
        serverName: serverNameDisplay,
        protocol,
        subLink: linkToSend,
        configLink: serverId === 'all' ? '' : (results.find(r => r)?.configLink || ''),
      }),
      { replyMarkup: mainMenuKeyboard(), parse_mode: 'HTML' }
    );

    log.info('Free test key created via bot', {
      telegramId,
      serverId,
      protocol,
    });
  } catch (error) {
    log.error('Free test key error', {
      error: error instanceof Error ? error.message : String(error),
    });
    await reply(chatId, messageId, MSG.error);
  }
}
