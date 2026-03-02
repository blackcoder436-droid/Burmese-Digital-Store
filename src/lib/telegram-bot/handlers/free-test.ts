// ==========================================
// Free Test Key Handler
// Channel join verification → free key provisioning
// ==========================================

import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { getOnlineServers, getServer } from '@/lib/vpn-servers';
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

const CHANNEL_USERNAME = '@BurmeseDigitalStore';

/**
 * Handle free_test callback — check feature flag, then prompt channel join
 */
export async function handleFreeTest(
  chatId: number,
  telegramId: number,
  firstName: string,
  username?: string
): Promise<void> {
  // Check feature flag
  const enabled = await getFeatureFlag('free_test_key');
  if (!enabled) {
    await sendMessage(chatId, MSG.notAvailable, {
      replyMarkup: mainMenuKeyboard(),
    });
    return;
  }

  await connectDB();
  const user = await findOrCreateTelegramUser(telegramId, firstName, undefined, username);

  // Check if already used
  if (user.freeVpnTestUsedAt) {
    await sendMessage(chatId, MSG.freeTestAlreadyUsed, {
      replyMarkup: mainMenuKeyboard(),
    });
    return;
  }

  // Prompt to join channel
  await sendMessage(chatId, MSG.freeTestJoinChannel, {
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
  username?: string
): Promise<void> {
  // Check channel membership
  const member = await getChatMember(CHANNEL_USERNAME, telegramId);
  const isMember = member && ['creator', 'administrator', 'member'].includes(member.status);

  if (!isMember) {
    await sendMessage(chatId, MSG.freeTestNotJoined, {
      replyMarkup: freeTestJoinKeyboard(),
    });
    return;
  }

  // Show server selection for free test
  const servers = await getOnlineServers();
  if (servers.length === 0) {
    await sendMessage(chatId, '❌ Server များ ယာယီပိတ်ထားပါသည်');
    return;
  }

  setSession(telegramId, { isFree: true });

  await sendMessage(chatId, `🎁 <b>Free Test Key</b>\n\nServer ရွေးပါ:`, {
    replyMarkup: freeServerKeyboard(servers),
  });
}

/**
 * Handle free server selection → show protocol selection
 */
export async function handleFreeServerSelect(
  chatId: number,
  telegramId: number,
  serverId: string
): Promise<void> {
  const server = await getServer(serverId);
  if (!server) {
    await sendMessage(chatId, MSG.error);
    return;
  }

  setSession(telegramId, {
    ...(getSession(telegramId) || {}),
    serverId,
    isFree: true,
  });

  await sendMessage(chatId, MSG.selectProtocol(server.name), {
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
  protocol: string
): Promise<void> {
  try {
    await connectDB();

    const user = await findOrCreateTelegramUser(telegramId, firstName, undefined, username);

    // Double-check not already used
    if (user.freeVpnTestUsedAt) {
      await sendMessage(chatId, MSG.freeTestAlreadyUsed, {
        replyMarkup: mainMenuKeyboard(),
      });
      return;
    }

    const server = await getServer(serverId);
    if (!server) {
      await sendMessage(chatId, MSG.error);
      return;
    }

    // Create free test key: 3GB, 72 hours, 1 device
    const result = await provisionVpnKey({
      serverId,
      username: username || firstName,
      userId: user._id.toString(),
      devices: 1,
      expiryDays: 3, // 72 hours
      dataLimitGB: 3,
      protocol,
    });

    if (!result) {
      await sendMessage(chatId, '❌ Key ဖန်တီးရာတွင် အမှားဖြစ်ပါသည်။ ပြန်ကြိုးစားပါ');
      return;
    }

    // Mark free test as used
    user.freeVpnTestUsedAt = new Date();
    await user.save();

    clearSession(telegramId);

    // Send key to user
    await sendMessage(
      chatId,
      MSG.freeTestGenerated({
        serverName: `${server.flag} ${server.name}`,
        protocol,
        subLink: result.subLink,
        configLink: result.configLink,
      }),
      { replyMarkup: mainMenuKeyboard() }
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
    await sendMessage(chatId, MSG.error);
  }
}
