// ==========================================
// Telegram Inline Keyboard Builders
// Burmese Digital Store - Integrated Bot
// ==========================================

import type { InlineKeyboard, InlineKeyboardMarkup } from './types';
import type { VpnServer } from '@/lib/vpn-servers';
import type { VpnPlan } from '@/lib/vpn-plans';

/**
 * Wrap keyboard array into InlineKeyboardMarkup
 */
export function markup(keyboard: InlineKeyboard): InlineKeyboardMarkup {
  return { inline_keyboard: keyboard };
}

// ---- Main Menu ----

export function mainMenuKeyboard(lang: 'en' | 'my' = 'my'): InlineKeyboardMarkup {
  return markup([
    [
      { text: lang === 'en' ? '🛒 Buy VPN' : '🛒 VPN ဝယ်မည်', callback_data: 'buy_key' },
      { text: lang === 'en' ? '🛍️ Shop Products' : '🛍️ Products ဝယ်မည်', callback_data: 'shop_categories' }
    ],
    [
      { text: '🔑 My Keys', callback_data: 'my_keys' },
      { text: '🎁 Free Test', callback_data: 'free_test' }
    ],
    [
      { text: lang === 'en' ? '🔄 Exchange Protocol' : '🔄 Protocol ပြောင်း', callback_data: 'exchange_key' },
      { text: lang === 'en' ? '📊 Check Usage' : '📊 Usage စစ်ဆေး', callback_data: 'check_usage' }
    ],
    [
      { text: '🎯 Referral', callback_data: 'referral' },
      { text: '📖 Help', callback_data: 'help' }
    ],
    [
      { text: '🌐 Language/ဘာသာစကား', callback_data: 'settings_language' },
      { text: lang === 'en' ? '📞 Contact Support' : '📞 ဆက်သွယ်ရန်', callback_data: 'contact' }
    ],
  ]);
}

// ---- Server Selection ----

export function serverKeyboard(
  servers: VpnServer[],
  prefix = 'server'
): InlineKeyboardMarkup {
  const keyboard: InlineKeyboard = [];
  
  for (let i = 0; i < servers.length; i += 2) {
    const row = [];
    const server1 = servers[i];
    row.push({
      text: `${server1.flag} ${server1.name} ${server1.online ? '🟢' : '🔴'}${server1.badge ? ` [${server1.badge}]` : ''}`,
      callback_data: `${prefix}_${server1.id}`,
    });
    
    if (i + 1 < servers.length) {
      const server2 = servers[i + 1];
      row.push({
        text: `${server2.flag} ${server2.name} ${server2.online ? '🟢' : '🔴'}${server2.badge ? ` [${server2.badge}]` : ''}`,
        callback_data: `${prefix}_${server2.id}`,
      });
    }
    keyboard.push(row);
  }

  keyboard.push([{ text: '🏠 Main Menu', callback_data: 'main_menu' }]);
  return markup(keyboard);
}

// ---- Protocol Selection ----

export function protocolKeyboard(
  serverId: string,
  enabledProtocols: string[],
  prefix = 'proto'
): InlineKeyboardMarkup {
  const protocolInfo: Record<string, { icon: string; label: string; recommended?: boolean }> = {
    trojan: { icon: '⭐', label: 'Trojan', recommended: true },
    vless: { icon: '⚡', label: 'VLESS' },
    vmess: { icon: '🔒', label: 'VMess' },
    shadowsocks: { icon: '🌐', label: 'Shadowsocks' },
  };

  const keyboard: InlineKeyboard = [];

  for (let i = 0; i < enabledProtocols.length; i += 2) {
    const row = [];
    const p1 = enabledProtocols[i];
    const info1 = protocolInfo[p1];
    if (info1) {
      row.push({
        text: info1.recommended ? `${info1.icon} ${info1.label}(Best)` : `${info1.icon} ${info1.label}`,
        callback_data: `${prefix}:${serverId}:${p1}`
      });
    }

    if (i + 1 < enabledProtocols.length) {
      const p2 = enabledProtocols[i + 1];
      const info2 = protocolInfo[p2];
      if (info2) {
        row.push({
          text: info2.recommended ? `${info2.icon} ${info2.label}(Best)` : `${info2.icon} ${info2.label}`,
          callback_data: `${prefix}:${serverId}:${p2}`
        });
      }
    }
    
    if (row.length > 0) {
      keyboard.push(row);
    }
  }

  keyboard.push([{ text: '◀️ နောက်သို့', callback_data: 'buy_key' }]);
  return markup(keyboard);
}

// ---- Device Count Selection ----

export function deviceKeyboard(serverId: string): InlineKeyboardMarkup {
  const keyboard: InlineKeyboard = [];

  for (let d = 1; d <= 4; d += 2) {
    const row = [];
    row.push({ text: d === 1 ? '📱 1 Device' : `📱 ${d} Devices`, callback_data: `device:${serverId}:${d}` });
    row.push({ text: `📱 ${d + 1} Devices`, callback_data: `device:${serverId}:${d + 1}` });
    keyboard.push(row);
  }
  keyboard.push([{ text: '📱 5 Devices', callback_data: `device:${serverId}:5` }]);

  keyboard.push([{ text: '◀️ နောက်သို့', callback_data: `server_${serverId}` }]);
  return markup(keyboard);
}

// ---- Plan/Duration Selection ----

export function planKeyboard(
  serverId: string,
  plans: VpnPlan[]
): InlineKeyboardMarkup {
  const keyboard: InlineKeyboard = [];

  // Show one plan per row (single column) for better visibility
  for (const plan of plans) {
    keyboard.push([{
      text: `📅 ${plan.months} Month${plan.months > 1 ? 's' : ''} - ${plan.price.toLocaleString()} Ks`,
      callback_data: `plan:${serverId}:${plan.id}`,
    }]);
  }

  keyboard.push([{ text: '◀️ နောက်သို့', callback_data: `server_${serverId}` }]);
  return markup(keyboard);
}

// ---- Send Screenshot Button ----

export function sendScreenshotKeyboard(orderId: string): InlineKeyboardMarkup {
  return markup([
    [{ text: '📸 Screenshot ပို့မည်', callback_data: `send_screenshot_${orderId}` }],
    [{ text: '❌ Cancel', callback_data: 'main_menu' }],
  ]);
}

// ---- Admin Approve/Reject ----

export function approveRejectKeyboard(
  orderId: string,
  userId: number
): InlineKeyboardMarkup {
  return markup([
    [
      { text: '✅ Approve', callback_data: `bot_approve_${orderId}_${userId}` },
      { text: '❌ Reject', callback_data: `bot_reject_${orderId}_${userId}` },
    ],
  ]);
}

// ---- Free Test Channel Join ----

export function freeTestJoinKeyboard(): InlineKeyboardMarkup {
  return markup([
    [{ text: '📢 Channel Join', url: 'https://t.me/BurmeseDigitalStore' }],
    [{ text: '✅ စစ်ဆေးမည်', callback_data: 'free_test_verify' }],
    [{ text: '🏠 Main Menu', callback_data: 'main_menu' }],
  ]);
}

// ---- Free Test Server Selection ----

export function freeServerKeyboard(servers: VpnServer[]): InlineKeyboardMarkup {
  return serverKeyboard(servers, 'free_server');
}

// ---- Free Test Protocol Selection ----

export function freeProtocolKeyboard(
  serverId: string,
  enabledProtocols: string[]
): InlineKeyboardMarkup {
  return protocolKeyboard(serverId, enabledProtocols, 'free_proto');
}

// ---- My Keys: View Key Detail ----

export function viewKeyKeyboard(keyId: string): InlineKeyboardMarkup {
  return markup([
    [{ text: '📋 Key Details', callback_data: `view_key_${keyId}` }],
  ]);
}

// ---- Exchange Key: Select Protocol ----

export function exchangeProtocolKeyboard(
  keyId: string,
  enabledProtocols: string[],
  currentProtocol: string
): InlineKeyboardMarkup {
  const keyboard: InlineKeyboard = [];

  const protocolLabels: Record<string, string> = {
    trojan: '⭐ Trojan',
    vless: '⚡ VLESS',
    vmess: '🔒 VMess',
    shadowsocks: '🌐 Shadowsocks',
  };

  for (const proto of enabledProtocols) {
    if (proto === currentProtocol) continue;
    keyboard.push([
      {
        text: protocolLabels[proto] || proto,
        callback_data: `expro:${keyId}:${proto}`,
      },
    ]);
  }

  keyboard.push([{ text: '◀️ နောက်သို့', callback_data: 'my_keys' }]);
  return markup(keyboard);
}

// ---- Referral Menu ----

export function referralKeyboard(canClaim: boolean): InlineKeyboardMarkup {
  const keyboard: InlineKeyboard = [
    [{ text: '🔗 Share Link', callback_data: 'my_referral_link' }],
    [{ text: '📊 Referral Stats', callback_data: 'referral_stats' }],
  ];

  if (canClaim) {
    keyboard.push([{ text: '🎁 Free Month ရယူမည်', callback_data: 'claim_free_month' }]);
  }

  keyboard.push([{ text: '🏠 Main Menu', callback_data: 'main_menu' }]);
  return markup(keyboard);
}

// ---- Admin Panel ----

export function adminPanelKeyboard(): InlineKeyboardMarkup {
  return markup([
    [
      { text: '📊 Sales Report', callback_data: 'admin_sales' },
      { text: '📈 Statistics', callback_data: 'admin_stats' },
    ],
    [
      { text: '📋 Pending Orders', callback_data: 'admin_pending' },
      { text: '👥 Users', callback_data: 'admin_users' },
    ],
    [
      { text: '🚫 Ban Management', callback_data: 'admin_bans' },
      { text: '🖥️ Servers', callback_data: 'admin_servers' },
    ],
    [
      { text: '⚙️ Features', callback_data: 'admin_features' },
      { text: '🔒 Protocols', callback_data: 'admin_protocols' },
    ],
    [
      { text: '🔑 Key ထုတ်မည်', callback_data: 'admin_create_key' },
      { text: '📦 Backup', callback_data: 'admin_backup' },
    ],
  ]);
}

// ---- Admin Stats Period ----

export function statsKeyboard(): InlineKeyboardMarkup {
  return markup([
    [
      { text: '📅 ယနေ့', callback_data: 'stats_today' },
      { text: '📅 ဤအပတ်', callback_data: 'stats_week' },
    ],
    [
      { text: '📅 ဤလ', callback_data: 'stats_month' },
      { text: '📅 အားလုံး', callback_data: 'stats_all' },
    ],
    [
      { text: '👑 Top Users', callback_data: 'stats_top_users' },
      { text: '💰 Revenue', callback_data: 'stats_revenue' },
    ],
    [{ text: '◀️ Admin Panel', callback_data: 'admin_back' }],
  ]);
}

// ---- Admin Server Management ----

export function adminServersKeyboard(
  servers: VpnServer[]
): InlineKeyboardMarkup {
  const keyboard: InlineKeyboard = [];

  for (const server of servers) {
    const status = server.enabled ? '🟢' : '🔴';
    keyboard.push([
      {
        text: `${server.flag} ${server.name} ${status}`,
        callback_data: `toggle_server_${server.id}`,
      },
    ]);
  }

  keyboard.push([
    { text: '➕ Server ထည့်မည်', callback_data: 'add_server_start' },
  ]);
  keyboard.push([{ text: '◀️ Admin Panel', callback_data: 'admin_back' }]);
  return markup(keyboard);
}

// ---- Admin Feature Flags ----

export function adminFeaturesKeyboard(
  features: { id: string; name: string; enabled: boolean }[]
): InlineKeyboardMarkup {
  const keyboard: InlineKeyboard = [];

  for (const feature of features) {
    const status = feature.enabled ? '✅' : '❌';
    keyboard.push([
      {
        text: `${status} ${feature.name}`,
        callback_data: `toggle_feature_${feature.id}`,
      },
    ]);
  }

  keyboard.push([{ text: '◀️ Admin Panel', callback_data: 'admin_back' }]);
  return markup(keyboard);
}

// ---- Admin Ban Management ----

export function adminBansKeyboard(): InlineKeyboardMarkup {
  return markup([
    [{ text: '🚫 Ban User', callback_data: 'ban_user_start' }],
    [{ text: '✅ Unban User', callback_data: 'unban_user_start' }],
    [{ text: '📋 Banned List', callback_data: 'ban_list' }],
    [{ text: '◀️ Admin Panel', callback_data: 'admin_back' }],
  ]);
}

// ---- Admin Create Key ----

export function adminCreateKeyTypeKeyboard(): InlineKeyboardMarkup {
  return markup([
    [{ text: '🧪 Test Key (3 days, 3GB)', callback_data: 'akey_type_test' }],
    [{ text: '🔑 Sell Key (Custom)', callback_data: 'akey_type_sell' }],
    [{ text: '◀️ Admin Panel', callback_data: 'admin_back' }],
  ]);
}

export function adminCreateKeyServerKeyboard(
  servers: VpnServer[],
  keyType: string
): InlineKeyboardMarkup {
  const keyboard: InlineKeyboard = [];
  for (const server of servers) {
    if (!server.enabled) continue;
    const statusIcon = server.online ? '🟢' : '🔴';
    keyboard.push([
      {
        text: `${server.flag} ${server.name} ${statusIcon}`,
        callback_data: `akey_srv:${keyType}:${server.id}`,
      },
    ]);
  }
  keyboard.push([{ text: '◀️ နောက်သို့', callback_data: 'admin_create_key' }]);
  return markup(keyboard);
}

export function adminCreateKeyProtocolKeyboard(
  serverId: string,
  keyType: string,
  enabledProtocols: string[]
): InlineKeyboardMarkup {
  const protocolInfo: Record<string, string> = {
    trojan: '⭐ Trojan',
    vless: '⚡ VLESS',
    vmess: '🔒 VMess',
    shadowsocks: '🌐 Shadowsocks',
  };

  const keyboard: InlineKeyboard = [];
  for (const proto of enabledProtocols) {
    keyboard.push([
      {
        text: protocolInfo[proto] || proto,
        callback_data: `akey_proto:${keyType}:${serverId}:${proto}`,
      },
    ]);
  }
  keyboard.push([{ text: '◀️ Server ရွေး', callback_data: `akey_type_${keyType}` }]);
  return markup(keyboard);
}

export function adminCreateKeyDeviceKeyboard(
  serverId: string,
  keyType: string,
  protocol: string
): InlineKeyboardMarkup {
  const keyboard: InlineKeyboard = [];
  for (let d = 1; d <= 5; d++) {
    keyboard.push([
      {
        text: `📱 ${d} Device${d > 1 ? 's' : ''}`,
        callback_data: `akey_dev:${keyType}:${serverId}:${protocol}:${d}`,
      },
    ]);
  }
  keyboard.push([{ text: '◀️ Protocol ရွေး', callback_data: `akey_srv:${keyType}:${serverId}` }]);
  return markup(keyboard);
}

export function adminCreateKeyDurationKeyboard(
  serverId: string,
  keyType: string,
  protocol: string,
  devices: number
): InlineKeyboardMarkup {
  const durations = [
    { days: 3, label: '3 ရက် (Test)' },
    { days: 30, label: '1 လ' },
    { days: 90, label: '3 လ' },
    { days: 150, label: '5 လ' },
    { days: 210, label: '7 လ' },
    { days: 270, label: '9 လ' },
    { days: 365, label: '12 လ' },
  ];

  const keyboard: InlineKeyboard = [];
  for (const dur of durations) {
    keyboard.push([
      {
        text: `📅 ${dur.label}`,
        callback_data: `akey_dur:${keyType}:${serverId}:${protocol}:${devices}:${dur.days}`,
      },
    ]);
  }
  keyboard.push([{ text: '◀️ Device ရွေး', callback_data: `akey_proto:${keyType}:${serverId}:${protocol}` }]);
  return markup(keyboard);
}
