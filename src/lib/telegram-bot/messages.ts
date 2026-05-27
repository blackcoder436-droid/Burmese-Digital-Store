// ==========================================
// Burmese Message Templates
// Burmese Digital Store - Integrated Bot
// ==========================================
// All bot messages in Myanmar language (matching vpn-bot messages)

export const MSG = {
  // ---- Dynamic Welcome ----
  welcomeBilingual: (name, lang) => lang === 'en' ? 
    `ðŸŒŸ <b>Burmese Digital Store</b> Welcome!\n\nHello ${name}! ðŸ‘‹\n\nðŸ” Premium VPN Service\nâš¡ Fast Servers\nðŸ›¡ï¸ Full Security\nðŸ’° Cheap Prices\n\nPlease choose an option from the menu below ðŸ‘‡` :
    `ðŸŒŸ <b>Burmese Digital Store</b> á€™á€¾ á€€á€¼á€­á€¯á€†á€­á€¯á€•á€«á€á€šá€º!\n\ná€™á€„á€ºá€¹á€‚á€œá€¬á€•á€« ${name}! ðŸ‘‹\n\nðŸ” Premium VPN Service\nâš¡ á€™á€¼á€”á€ºá€†á€”á€ºá€žá€±á€¬ Server á€™á€»á€¬á€¸\nðŸ›¡ï¸ á€œá€¯á€¶á€á€¼á€¯á€¶á€™á€¾á€¯á€¡á€•á€¼á€Šá€·á€º\nðŸ’° á€…á€»á€±á€¸á€”á€¾á€¯á€”á€ºá€¸á€žá€€á€ºá€žá€¬\n\ná€¡á€±á€¬á€€á€ºá€•á€« menu á€™á€¾ á€›á€½á€±á€¸á€á€»á€šá€ºá€•á€« ðŸ‘‡`,

  helpBilingual: (lang) => lang === 'en' ? 
    `ðŸ“– <b>How to use</b>\n\nðŸ”‘ <b>Buy VPN Key:</b>\n1ï¸âƒ£ Click "ðŸ›’ Buy VPN"\n2ï¸âƒ£ Select Server\n3ï¸âƒ£ Select Protocol\n4ï¸âƒ£ Select Devices\n5ï¸âƒ£ Select Plan\n6ï¸âƒ£ Transfer money & Send Screenshot\n7ï¸âƒ£ Get your Key\n\nðŸŽ <b>Free Test Key:</b>\nâ€¢ Join our channel to get 3GB / 72 hours free test\n\nðŸ“ž <b>Help:</b>\nâ€¢ Contact @BurmeseDigitalStore` :
    `ðŸ“– <b>á€¡á€žá€¯á€¶á€¸á€•á€¼á€¯á€”á€Šá€ºá€¸</b>\n\nðŸ”‘ <b>VPN Key á€á€šá€ºá€”á€Šá€ºá€¸:</b>\n1ï¸âƒ£ "ðŸ›’ VPN á€á€šá€ºá€™á€Šá€º" á€€á€­á€¯á€”á€¾á€­á€•á€ºá€•á€«\n2ï¸âƒ£ Server á€›á€½á€±á€¸á€•á€«\n3ï¸âƒ£ Protocol á€›á€½á€±á€¸á€•á€«\n4ï¸âƒ£ Device á€¡á€›á€±á€¡á€á€½á€€á€º á€›á€½á€±á€¸á€•á€«\n5ï¸âƒ£ Plan á€›á€½á€±á€¸á€•á€«\n6ï¸âƒ£ á€„á€½á€±á€œá€½á€¾á€²á€•á€¼á€®á€¸ Screenshot á€•á€­á€¯á€·á€•á€«\n7ï¸âƒ£ Key á€›á€›á€¾á€­á€•á€«á€™á€Šá€º\n\nðŸŽ <b>Free Test Key:</b>\nâ€¢ Channel join á€•á€¼á€®á€¸á€›á€„á€º 3GB / 72 á€”á€¬á€›á€® free test á€›á€”á€­á€¯á€„á€ºá€•á€«á€á€šá€º\n\nðŸ“ž <b>á€¡á€€á€°á€¡á€Šá€®:</b>\nâ€¢ @BurmeseDigitalStore á€€á€­á€¯ á€†á€€á€ºá€žá€½á€šá€ºá€•á€«`,

  contactBilingual: (lang) => lang === 'en' ?
    `ðŸ“ž <b>Contact Support</b>\n\nðŸ“± Telegram: @BurmeseDigitalStore\nðŸŒ Website: https://burmesedigital.store\nðŸ“§ Email: support@burmesedigital.store\n\nâ° Response Time: 1-12 hours` :
    `ðŸ“ž <b>á€†á€€á€ºá€žá€½á€šá€ºá€›á€”á€º</b>\n\nðŸ“± Telegram: @BurmeseDigitalStore\nðŸŒ Website: https://burmesedigital.store\nðŸ“§ Email: support@burmesedigital.store\n\nâ° á€á€¯á€¶á€·á€•á€¼á€”á€ºá€á€»á€­á€”á€º: 1-12 á€”á€¬á€›á€®á€¡á€á€½á€„á€ºá€¸`,
  // ---- Welcome & Menu ----
  welcome: (name: string) =>
    `ðŸŒŸ <b>Burmese Digital Store</b> á€™á€¾ á€€á€¼á€­á€¯á€†á€­á€¯á€•á€«á€á€šá€º!\n\n` +
    `á€™á€„á€ºá€¹á€‚á€œá€¬á€•á€« ${name}! ðŸ‘‹\n\n` +
    `ðŸ” Premium VPN Service\n` +
    `âš¡ á€™á€¼á€”á€ºá€†á€”á€ºá€žá€±á€¬ Server á€™á€»á€¬á€¸\n` +
    `ðŸ›¡ï¸ á€œá€¯á€¶á€á€¼á€¯á€¶á€™á€¾á€¯á€¡á€•á€¼á€Šá€·á€º\n` +
    `ðŸ’° á€…á€»á€±á€¸á€”á€¾á€¯á€”á€ºá€¸á€žá€€á€ºá€žá€¬\n\n` +
    `á€¡á€±á€¬á€€á€ºá€•á€« menu á€™á€¾ á€›á€½á€±á€¸á€á€»á€šá€ºá€•á€« ðŸ‘‡`,

  help:
    `ðŸ“– <b>á€¡á€žá€¯á€¶á€¸á€•á€¼á€¯á€”á€Šá€ºá€¸</b>\n\n` +
    `ðŸ”‘ <b>VPN Key á€á€šá€ºá€”á€Šá€ºá€¸:</b>\n` +
    `1ï¸âƒ£ "ðŸ›’ VPN Key á€á€šá€ºá€™á€Šá€º" á€€á€­á€¯á€”á€¾á€­á€•á€ºá€•á€«\n` +
    `2ï¸âƒ£ Server á€›á€½á€±á€¸á€•á€«\n` +
    `3ï¸âƒ£ Protocol á€›á€½á€±á€¸á€•á€«\n` +
    `4ï¸âƒ£ Device á€¡á€›á€±á€¡á€á€½á€€á€º á€›á€½á€±á€¸á€•á€«\n` +
    `5ï¸âƒ£ Plan á€›á€½á€±á€¸á€•á€«\n` +
    `6ï¸âƒ£ á€„á€½á€±á€œá€½á€¾á€²á€•á€¼á€®á€¸ Screenshot á€•á€­á€¯á€·á€•á€«\n` +
    `7ï¸âƒ£ Key á€›á€›á€¾á€­á€•á€«á€™á€Šá€º\n\n` +
    `ðŸŽ <b>Free Test Key:</b>\n` +
    `â€¢ Channel join á€•á€¼á€®á€¸á€›á€„á€º 3GB / 72 á€”á€¬á€›á€® free test á€›á€”á€­á€¯á€„á€ºá€•á€«á€á€šá€º\n\n` +
    `ðŸ”„ <b>Protocol á€•á€¼á€±á€¬á€„á€ºá€¸á€á€¼á€„á€ºá€¸:</b>\n` +
    `â€¢ á€œá€€á€ºá€›á€¾á€­ key á€€á€­á€¯ á€á€á€¼á€¬á€¸ protocol á€•á€¼á€±á€¬á€„á€ºá€¸á€”á€­á€¯á€„á€ºá€•á€«á€á€šá€º\n\n` +
    `ðŸ“ž <b>á€¡á€€á€°á€¡á€Šá€®:</b>\n` +
    `â€¢ @BurmeseDigitalStore á€€á€­á€¯ á€†á€€á€ºá€žá€½á€šá€ºá€•á€«`,

  contact:
    `ðŸ“ž <b>á€†á€€á€ºá€žá€½á€šá€ºá€›á€”á€º</b>\n\n` +
    `ðŸ“± Telegram: @BurmeseDigitalStore\n` +
    `ðŸŒ Website: https://burmesedigital.store\n` +
    `ðŸ“§ Email: support@burmesedigital.store\n\n` +
    `â° á€á€¯á€¶á€·á€•á€¼á€”á€ºá€á€»á€­á€”á€º: 1-12 á€”á€¬á€›á€®á€¡á€á€½á€„á€ºá€¸`,

  // ---- Server Selection ----
  selectServer: `ðŸŒ <b>Server á€›á€½á€±á€¸á€á€»á€šá€ºá€•á€«</b>\n\ná€žá€„á€·á€ºá€¡á€á€½á€€á€º á€¡á€žá€„á€·á€ºá€á€±á€¬á€ºá€†á€¯á€¶á€¸ server á€€á€­á€¯ á€›á€½á€±á€¸á€•á€«:`,

  // ---- Protocol Selection ----
  selectProtocol: (serverName: string) =>
    `âš™ï¸ <b>Protocol á€›á€½á€±á€¸á€á€»á€šá€ºá€•á€«</b>\n\n` +
    `Server: ${serverName}\n\n` +
    `â­ Trojan - á€¡á€€á€±á€¬á€„á€ºá€¸á€†á€¯á€¶á€¸ (á€œá€»á€„á€ºá€™á€¼á€”á€ºáŠ á€œá€¯á€¶á€á€¼á€¯á€¶)\n` +
    `VLESS - á€•á€±á€«á€·á€•á€«á€¸á€•á€¼á€®á€¸ á€™á€¼á€”á€ºá€†á€”á€º\n` +
    `VMess - á€šá€¯á€¶á€€á€¼á€Šá€ºá€…á€­á€á€ºá€á€»á€›\n` +
    `Shadowsocks - á€žá€™á€¬á€¸á€á€±á€¬á€º`,

  // ---- Device Selection ----
  selectDevices: (serverName: string, protocol: string) =>
    `ðŸ“± <b>Device á€¡á€›á€±á€¡á€á€½á€€á€º á€›á€½á€±á€¸á€•á€«</b>\n\n` +
    `Server: ${serverName}\n` +
    `Protocol: ${protocol.toUpperCase()}\n\n` +
    `á€á€…á€ºá€•á€¼á€­á€¯á€„á€ºá€”á€€á€ºá€žá€¯á€¶á€¸á€™á€Šá€·á€º device á€¡á€›á€±á€¡á€á€½á€€á€ºá€€á€­á€¯ á€›á€½á€±á€¸á€•á€«:`,

  // ---- Plan Selection ----
  selectPlan: (serverName: string, protocol: string, devices: number) =>
    `ðŸ“‹ <b>Plan á€›á€½á€±á€¸á€á€»á€šá€ºá€•á€«</b>\n\n` +
    `Server: ${serverName}\n` +
    `Protocol: ${protocol.toUpperCase()}\n` +
    `Devices: ${devices}\n\n` +
    `á€€á€¼á€­á€¯á€€á€ºá€”á€¾á€…á€ºá€žá€€á€ºá€›á€¬ plan á€€á€­á€¯ á€›á€½á€±á€¸á€•á€«:`,

  // ---- Payment ----
  paymentInfo: (params: {
    orderNumber: string;
    planName: string;
    serverName: string;
    protocol: string;
    amount: number;
    orderId: string;
  }) =>
    `ðŸ’³ <b>á€„á€½á€±á€•á€±á€¸á€á€»á€±á€›á€”á€º</b>\n\n` +
    `ðŸ“¦ Order: ${params.orderNumber}\n` +
    `ðŸ›’ ${params.planName}\n` +
    `ðŸŒ Server: ${params.serverName}\n` +
    `âš™ï¸ Protocol: ${params.protocol.toUpperCase()}\n` +
    `ðŸ’° <b>á€€á€»á€žá€„á€·á€ºá€„á€½á€±: ${params.amount.toLocaleString()} Ks</b>\n\n` +
    `â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n` +
    `ðŸ“± <b>á€„á€½á€±á€œá€½á€¾á€²á€›á€”á€º á€¡á€€á€±á€¬á€„á€·á€º:</b>\n` +
    `ðŸ‘¤ á€¡á€™á€Šá€º: Myo Ko Aung\n` +
    `ðŸ“ž á€–á€¯á€”á€ºá€¸: <code>09950569539</code>\n\n` +
    `ðŸ’³ KBZPay / WavePay / AYA Pay / UAB Pay\n` +
    `â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n\n` +
    `âœ… á€„á€½á€±á€œá€½á€¾á€²á€•á€¼á€®á€¸á€•á€«á€€ Screenshot á€•á€­á€¯á€·á€•á€±á€¸á€•á€« ðŸ“¸\n` +
    `â° 30 á€™á€­á€”á€…á€ºá€¡á€á€½á€„á€ºá€¸ Screenshot á€•á€­á€¯á€·á€•á€«`,

  waitingScreenshot:
    `ðŸ“¸ <b>á€„á€½á€±á€œá€½á€¾á€²á€•á€¼á€±á€…á€¬ Screenshot á€•á€­á€¯á€·á€•á€±á€¸á€•á€«</b>\n\n` +
    `âš ï¸ á€›á€¾á€„á€ºá€¸á€œá€„á€ºá€¸á€á€²á€· Screenshot á€–á€¼á€…á€ºá€›á€•á€«á€™á€šá€º\n` +
    `ðŸ“‹ á€„á€½á€±á€•á€™á€¬á€ á€•á€«á€›á€•á€«á€™á€šá€º\n` +
    `â° 30 á€™á€­á€”á€…á€ºá€¡á€á€½á€„á€ºá€¸ á€•á€­á€¯á€·á€•á€±á€¸á€•á€«`,

  screenshotReceived:
    `âœ… <b>Screenshot á€›á€›á€¾á€­á€•á€«á€•á€¼á€®!</b>\n\n` +
    `ðŸ” á€…á€…á€ºá€†á€±á€¸á€”á€±á€•á€«á€žá€Šá€º...\n` +
    `â³ á€á€á€…á€±á€¬á€„á€·á€ºá€•á€±á€¸á€•á€«`,

  orderPending:
    `â³ <b>Order á€€á€­á€¯ á€…á€…á€ºá€†á€±á€¸á€”á€±á€•á€«á€žá€Šá€º</b>\n\n` +
    `âœ… Admin á€™á€¾ á€¡á€á€Šá€ºá€•á€¼á€¯á€•á€«á€€ VPN Key á€€á€­á€¯\n` +
    `á€¤ chat á€‘á€²á€žá€­á€¯á€· á€•á€­á€¯á€·á€•á€±á€¸á€•á€«á€™á€Šá€º\n\n` +
    `â° á€•á€¯á€¶á€™á€¾á€”á€º 5 á€™á€­á€”á€…á€º - 1 á€”á€¬á€›á€®á€¡á€á€½á€„á€ºá€¸ á€›á€›á€¾á€­á€•á€«á€™á€Šá€º`,

  // ---- Key Generated ----
  keyGenerated: (params: {
    planName: string;
    serverName: string;
    protocol: string;
    expiryDate: string;
    subLink: string;
    configLink?: string;
  }) =>
    `ðŸŽ‰ <b>VPN Key á€›á€›á€¾á€­á€•á€«á€•á€¼á€®!</b>\n\n` +
    `ðŸ“‹ Plan: ${params.planName}\n` +
    `ðŸŒ Server: ${params.serverName}\n` +
    `âš™ï¸ Protocol: ${params.protocol.toUpperCase()}\n` +
    `ðŸ“… á€žá€€á€ºá€á€™á€ºá€¸: ${params.expiryDate}\n\n` +
    `â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n` +
    `ðŸ”— <b>Subscription Link:</b>\n` +
    `<code>${params.subLink}</code>\n\n` +
    `â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n\n` +
    `ðŸ“± <b>á€¡á€žá€¯á€¶á€¸á€•á€¼á€¯á€”á€Šá€ºá€¸:</b>\n` +
    `â€¢ V2rayNG (Android) - Subscription link copy á€•á€¼á€¯á€œá€¯á€•á€ºá€•á€«\n` +
    `â€¢ Streisand (iOS) - Subscription link copy á€•á€¼á€¯á€œá€¯á€•á€ºá€•á€«\n` +
    `â€¢ V2rayN (Windows) - Subscription link copy á€•á€¼á€¯á€œá€¯á€•á€ºá€•á€«`,

  // ---- My Keys ----
  noKeys: `ðŸ˜” <b>VPN Key á€™á€›á€¾á€­á€•á€«</b>\n\nVPN Key á€á€šá€ºá€šá€°á€›á€”á€º "ðŸ›’ VPN Key á€á€šá€ºá€™á€Šá€º" á€€á€­á€¯á€”á€¾á€­á€•á€ºá€•á€«`,

  // ---- Free Test ----
  freeTestJoinChannel:
    `ðŸŽ <b>Free Test Key á€›á€šá€°á€›á€”á€º</b>\n\n` +
    `ðŸ“¢ á€¡á€›á€„á€ºá€†á€¯á€¶á€¸ Channel á€€á€­á€¯ Join á€œá€¯á€•á€ºá€•á€±á€¸á€•á€«:\n` +
    `@BurmeseDigitalStore\n\n` +
    `Join á€•á€¼á€®á€¸á€•á€«á€€ "âœ… á€…á€…á€ºá€†á€±á€¸á€™á€Šá€º" á€€á€­á€¯á€”á€¾á€­á€•á€ºá€•á€«`,

  freeTestNotJoined:
    `âŒ Channel á€€á€­á€¯ á€™ Join á€›á€žá€±á€¸á€•á€«\n\n` +
    `@BurmeseDigitalStore á€€á€­á€¯ Join á€•á€¼á€®á€¸á€™á€¾ á€‘á€•á€ºá€€á€¼á€­á€¯á€¸á€…á€¬á€¸á€•á€«`,

  freeTestAlreadyUsed:
    `âš ï¸ <b>Free Test Key á€€á€­á€¯ á€á€…á€ºá€€á€¼á€­á€™á€ºá€žá€¬ á€›á€šá€°á€”á€­á€¯á€„á€ºá€•á€«á€žá€Šá€º</b>\n\n` +
    `á€žá€„á€º Free Test Key á€šá€°á€•á€¼á€®á€¸á€•á€«á€•á€¼á€®\n` +
    `VPN á€€á€­á€¯ á€†á€€á€ºá€žá€¯á€¶á€¸á€œá€­á€¯á€•á€«á€€ Key á€á€šá€ºá€šá€°á€•á€±á€¸á€•á€«`,

  freeTestGenerated: (params: {
    serverName: string;
    protocol: string;
    subLink: string;
    configLink: string;
  }) =>
    `ðŸŽ‰ <b>Free Test Key á€›á€›á€¾á€­á€•á€«á€•á€¼á€®!</b>\n\n` +
    `ðŸŒ Server: ${params.serverName}\n` +
    `âš™ï¸ Protocol: ${params.protocol.toUpperCase()}\n` +
    `ðŸ“Š Data: 3 GB\n` +
    `â° á€žá€€á€ºá€á€™á€ºá€¸: 72 á€”á€¬á€›á€®\n` +
    `ðŸ“± Device: 1\n\n` +
    `â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n` +
    `ðŸ”— <b>Subscription Link:</b>\n` +
    `<code>${params.subLink}</code>\n` +
    (params.configLink ? `\nðŸ”‘ <b>Config Link:</b>\n<code>${params.configLink}</code>\n` : '') +
    `â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”`,

  // ---- Referral ----
  referralInfo: (params: {
    referralCode: string;
    totalReferred: number;
    paidReferrals: number;
    bonusDays: number;
    canClaimFreeMonth: boolean;
  }) =>
    `ðŸŽ¯ <b>Referral Program</b>\n\n` +
    `ðŸ”— á€žá€„á€·á€º Referral Link:\n` +
    `<code>https://t.me/BurmeseDigitalStore_bot?start=REF_${params.referralCode}</code>\n\n` +
    `ðŸ“Š <b>á€…á€¬á€›á€„á€ºá€¸:</b>\n` +
    `ðŸ‘¥ á€…á€¯á€…á€¯á€•á€±á€«á€„á€ºá€¸ Refer: ${params.totalReferred}\n` +
    `âœ… á€á€šá€ºá€šá€°á€•á€¼á€®á€¸: ${params.paidReferrals}\n` +
    `ðŸ“… Bonus á€›á€€á€º: ${params.bonusDays}\n\n` +
    `ðŸŽ <b>Reward:</b>\n` +
    `â€¢ Refer á€á€…á€ºá€šá€±á€¬á€€á€ºá€á€šá€ºá€á€­á€¯á€„á€ºá€¸: +5 á€›á€€á€º bonus\n` +
    `â€¢ 3 á€šá€±á€¬á€€á€ºá€á€šá€ºá€›á€„á€º: 1 á€œ free key ðŸŽ‰\n\n` +
    (params.canClaimFreeMonth ? `âœ¨ <b>Free Month Key á€›á€šá€°á€”á€­á€¯á€„á€ºá€•á€«á€•á€¼á€®!</b>` : ''),

  referralRewardEarned: (referrerName: string, bonusDays: number) =>
    `ðŸŽ‰ ${referrerName}! á€žá€„á€º Refer á€•á€±á€¸á€‘á€¬á€¸á€á€²á€· user key á€á€šá€ºá€•á€«á€•á€¼á€®!\n` +
    `ðŸ“… +${bonusDays} á€›á€€á€º bonus á€›á€›á€¾á€­á€•á€«á€•á€¼á€®!`,

  referralDisabled: `âš ï¸ Referral system á€šá€¬á€šá€®á€•á€­á€á€ºá€‘á€¬á€¸á€•á€«á€žá€Šá€º`,

  // ---- Admin ----
  adminPanel:
    `ðŸ”§ <b>Admin Panel</b>\n\n` +
    `á€œá€¯á€•á€ºá€†á€±á€¬á€„á€ºá€á€»á€€á€ºá€€á€­á€¯ á€›á€½á€±á€¸á€•á€«:`,

  // ---- Errors ----
  error: `âŒ á€¡á€™á€¾á€¬á€¸á€á€…á€ºá€á€¯ á€–á€¼á€…á€ºá€•á€±á€«á€ºá€•á€«á€žá€Šá€ºá‹ á€•á€¼á€”á€ºá€œá€Šá€ºá€€á€¼á€­á€¯á€¸á€…á€¬á€¸á€•á€«`,
  banned: `ðŸš« á€žá€„á€·á€º account á€€á€­á€¯ á€•á€­á€á€ºá€‘á€¬á€¸á€•á€«á€žá€Šá€º\n\ná€¡á€€á€¼á€±á€¬á€„á€ºá€¸á€¡á€›á€¬: `,
  rateLimited: `âš ï¸ á€á€á€”á€±á€™á€¾ á€‘á€•á€ºá€€á€¼á€­á€¯á€¸á€…á€¬á€¸á€•á€«`,
  notAvailable: `âš ï¸ á€¤á€œá€¯á€•á€ºá€†á€±á€¬á€„á€ºá€á€»á€€á€ºá€€á€­á€¯ á€šá€¬á€šá€®á€›á€•á€ºá€‘á€¬á€¸á€•á€«á€žá€Šá€º`,

  // ---- Order Statuses ----
  orderApproved: (orderNumber: string) =>
    `âœ… Order ${orderNumber} á€¡á€á€Šá€ºá€•á€¼á€¯á€•á€¼á€®á€¸á€•á€«á€•á€¼á€®!\n\nðŸ”‘ VPN Key á€€á€­á€¯ á€¡á€±á€¬á€€á€ºá€™á€¾á€¬ á€€á€¼á€Šá€·á€ºá€•á€« ðŸ‘‡`,
  orderRejected: (orderNumber: string) =>
    `âŒ Order ${orderNumber} á€€á€­á€¯ á€„á€¼á€„á€ºá€¸á€•á€šá€ºá€•á€«á€•á€¼á€®\n\nðŸ“ž á€•á€¼á€¿á€”á€¬á€›á€¾á€­á€•á€«á€€ @BurmeseDigitalStore á€žá€­á€¯á€· á€†á€€á€ºá€žá€½á€šá€ºá€•á€«`,

  // ---- Admin Notifications ----
  adminNewOrder: (params: {
    orderNumber: string;
    userName: string;
    planName: string;
    serverName: string;
    protocol: string;
    amount: number;
    telegramId: number;
    ocrMatch?: boolean;
  }) =>
    `ðŸ“¦ <b>New Bot Order: ${params.orderNumber}</b>\n\n` +
    `ðŸ‘¤ ${params.userName} (ID: ${params.telegramId})\n` +
    `ðŸ›’ ${params.planName}\n` +
    `ðŸŒ Server: ${params.serverName}\n` +
    `âš™ï¸ Protocol: ${params.protocol.toUpperCase()}\n` +
    `ðŸ’° <b>${params.amount.toLocaleString()} Ks</b>\n` +
    (params.ocrMatch !== undefined
      ? `\nðŸ” OCR: ${params.ocrMatch ? 'âœ… Match' : 'âŒ No match'}\n`
      : '') +
    `\nâ³ Awaiting approval...`,
} as const;

