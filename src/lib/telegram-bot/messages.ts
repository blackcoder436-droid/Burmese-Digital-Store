// ==========================================
// Burmese Message Templates
// Burmese Digital Store - Integrated Bot
// ==========================================
// All bot messages in Myanmar language (matching vpn-bot messages)

export const MSG = {
  // ---- Welcome & Menu ----
  welcome: (name: string) =>
    `🌟 <b>Burmese Digital Store</b> မှ ကြိုဆိုပါတယ်!\n\n` +
    `မင်္ဂလာပါ ${name}! 👋\n\n` +
    `🔐 Premium VPN Service\n` +
    `⚡ မြန်ဆန်သော Server များ\n` +
    `🛡️ လုံခြုံမှုအပြည့်\n` +
    `💰 စျေးနှုန်းသက်သာ\n\n` +
    `အောက်ပါ menu မှ ရွေးချယ်ပါ 👇`,

  help:
    `📖 <b>အသုံးပြုနည်း</b>\n\n` +
    `🔑 <b>VPN Key ဝယ်နည်း:</b>\n` +
    `1️⃣ "🛒 VPN Key ဝယ်မည်" ကိုနှိပ်ပါ\n` +
    `2️⃣ Server ရွေးပါ\n` +
    `3️⃣ Protocol ရွေးပါ\n` +
    `4️⃣ Device အရေအတွက် ရွေးပါ\n` +
    `5️⃣ Plan ရွေးပါ\n` +
    `6️⃣ ငွေလွှဲပြီး Screenshot ပို့ပါ\n` +
    `7️⃣ Key ရရှိပါမည်\n\n` +
    `🎁 <b>Free Test Key:</b>\n` +
    `• Channel join ပြီးရင် 3GB / 72 နာရီ free test ရနိုင်ပါတယ်\n\n` +
    `🔄 <b>Protocol ပြောင်းခြင်း:</b>\n` +
    `• လက်ရှိ key ကို တခြား protocol ပြောင်းနိုင်ပါတယ်\n\n` +
    `📞 <b>အကူအညီ:</b>\n` +
    `• @BurmeseDigitalStore ကို ဆက်သွယ်ပါ`,

  contact:
    `📞 <b>ဆက်သွယ်ရန်</b>\n\n` +
    `📱 Telegram: @BurmeseDigitalStore\n` +
    `🌐 Website: https://burmesedigital.store\n` +
    `📧 Email: support@burmesedigital.store\n\n` +
    `⏰ တုံ့ပြန်ချိန်: 1-12 နာရီအတွင်း`,

  // ---- Server Selection ----
  selectServer: `🌐 <b>Server ရွေးချယ်ပါ</b>\n\nသင့်အတွက် အသင့်တော်ဆုံး server ကို ရွေးပါ:`,

  // ---- Protocol Selection ----
  selectProtocol: (serverName: string) =>
    `⚙️ <b>Protocol ရွေးချယ်ပါ</b>\n\n` +
    `Server: ${serverName}\n\n` +
    `⭐ Trojan - အကောင်းဆုံး (လျင်မြန်၊ လုံခြုံ)\n` +
    `VLESS - ပေါ့ပါးပြီး မြန်ဆန်\n` +
    `VMess - ယုံကြည်စိတ်ချရ\n` +
    `Shadowsocks - သမားတော်`,

  // ---- Device Selection ----
  selectDevices: (serverName: string, protocol: string) =>
    `📱 <b>Device အရေအတွက် ရွေးပါ</b>\n\n` +
    `Server: ${serverName}\n` +
    `Protocol: ${protocol.toUpperCase()}\n\n` +
    `တစ်ပြိုင်နက်သုံးမည့် device အရေအတွက်ကို ရွေးပါ:`,

  // ---- Plan Selection ----
  selectPlan: (serverName: string, protocol: string, devices: number) =>
    `📋 <b>Plan ရွေးချယ်ပါ</b>\n\n` +
    `Server: ${serverName}\n` +
    `Protocol: ${protocol.toUpperCase()}\n` +
    `Devices: ${devices}\n\n` +
    `ကြိုက်နှစ်သက်ရာ plan ကို ရွေးပါ:`,

  // ---- Payment ----
  paymentInfo: (params: {
    orderNumber: string;
    planName: string;
    serverName: string;
    protocol: string;
    amount: number;
    orderId: string;
  }) =>
    `💳 <b>ငွေပေးချေရန်</b>\n\n` +
    `📦 Order: ${params.orderNumber}\n` +
    `🛒 ${params.planName}\n` +
    `🌐 Server: ${params.serverName}\n` +
    `⚙️ Protocol: ${params.protocol.toUpperCase()}\n` +
    `💰 <b>ကျသင့်ငွေ: ${params.amount.toLocaleString()} Ks</b>\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `📱 <b>ငွေလွှဲရန် အကောင့်:</b>\n` +
    `👤 အမည်: Myo Ko Aung\n` +
    `📞 ဖုန်း: <code>09950569539</code>\n\n` +
    `💳 KBZPay / WavePay / AYA Pay / UAB Pay\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `✅ ငွေလွှဲပြီးပါက Screenshot ပို့ပေးပါ 📸\n` +
    `⏰ 30 မိနစ်အတွင်း Screenshot ပို့ပါ`,

  waitingScreenshot:
    `📸 <b>ငွေလွှဲပြေစာ Screenshot ပို့ပေးပါ</b>\n\n` +
    `⚠️ ရှင်းလင်းတဲ့ Screenshot ဖြစ်ရပါမယ်\n` +
    `📋 ငွေပမာဏ ပါရပါမယ်\n` +
    `⏰ 30 မိနစ်အတွင်း ပို့ပေးပါ`,

  screenshotReceived:
    `✅ <b>Screenshot ရရှိပါပြီ!</b>\n\n` +
    `🔍 စစ်ဆေးနေပါသည်...\n` +
    `⏳ ခဏစောင့်ပေးပါ`,

  orderPending:
    `⏳ <b>Order ကို စစ်ဆေးနေပါသည်</b>\n\n` +
    `✅ Admin မှ အတည်ပြုပါက VPN Key ကို\n` +
    `ဤ chat ထဲသို့ ပို့ပေးပါမည်\n\n` +
    `⏰ ပုံမှန် 5 မိနစ် - 1 နာရီအတွင်း ရရှိပါမည်`,

  // ---- Key Generated ----
  keyGenerated: (params: {
    planName: string;
    serverName: string;
    protocol: string;
    expiryDate: string;
    subLink: string;
    configLink: string;
  }) =>
    `🎉 <b>VPN Key ရရှိပါပြီ!</b>\n\n` +
    `📋 Plan: ${params.planName}\n` +
    `🌐 Server: ${params.serverName}\n` +
    `⚙️ Protocol: ${params.protocol.toUpperCase()}\n` +
    `📅 သက်တမ်း: ${params.expiryDate}\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `🔗 <b>Subscription Link:</b>\n` +
    `<code>${params.subLink}</code>\n\n` +
    `🔑 <b>Config Link:</b>\n` +
    `<code>${params.configLink}</code>\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `📱 <b>အသုံးပြုနည်း:</b>\n` +
    `• V2rayNG (Android) - Subscription link copy ပြုလုပ်ပါ\n` +
    `• Streisand (iOS) - Subscription link copy ပြုလုပ်ပါ\n` +
    `• V2rayN (Windows) - Subscription link copy ပြုလုပ်ပါ`,

  // ---- My Keys ----
  noKeys: `😔 <b>VPN Key မရှိပါ</b>\n\nVPN Key ဝယ်ယူရန် "🛒 VPN Key ဝယ်မည်" ကိုနှိပ်ပါ`,

  // ---- Free Test ----
  freeTestJoinChannel:
    `🎁 <b>Free Test Key ရယူရန်</b>\n\n` +
    `📢 အရင်ဆုံး Channel ကို Join လုပ်ပေးပါ:\n` +
    `@BurmeseDigitalStore\n\n` +
    `Join ပြီးပါက "✅ စစ်ဆေးမည်" ကိုနှိပ်ပါ`,

  freeTestNotJoined:
    `❌ Channel ကို မ Join ရသေးပါ\n\n` +
    `@BurmeseDigitalStore ကို Join ပြီးမှ ထပ်ကြိုးစားပါ`,

  freeTestAlreadyUsed:
    `⚠️ <b>Free Test Key ကို တစ်ကြိမ်သာ ရယူနိုင်ပါသည်</b>\n\n` +
    `သင် Free Test Key ယူပြီးပါပြီ\n` +
    `VPN ကို ဆက်သုံးလိုပါက Key ဝယ်ယူပေးပါ`,

  freeTestGenerated: (params: {
    serverName: string;
    protocol: string;
    subLink: string;
    configLink: string;
  }) =>
    `🎉 <b>Free Test Key ရရှိပါပြီ!</b>\n\n` +
    `🌐 Server: ${params.serverName}\n` +
    `⚙️ Protocol: ${params.protocol.toUpperCase()}\n` +
    `📊 Data: 3 GB\n` +
    `⏰ သက်တမ်း: 72 နာရီ\n` +
    `📱 Device: 1\n\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `🔗 <b>Subscription Link:</b>\n` +
    `<code>${params.subLink}</code>\n\n` +
    `🔑 <b>Config Link:</b>\n` +
    `<code>${params.configLink}</code>\n` +
    `━━━━━━━━━━━━━━━━━━`,

  // ---- Exchange Key ----
  exchangeDisabled: `⚠️ Protocol ပြောင်းခြင်း ယာယီပိတ်ထားပါသည်`,
  exchangeNoKeys: `😔 ပြောင်းလဲနိုင်သော active key မရှိပါ`,
  exchangeSelectProtocol: (currentProtocol: string) =>
    `🔄 <b>Protocol ပြောင်းမည်</b>\n\n` +
    `လက်ရှိ: ${currentProtocol.toUpperCase()}\n\n` +
    `ပြောင်းလိုသော protocol ကို ရွေးပါ:`,
  exchangeSuccess: (protocol: string) =>
    `✅ Protocol ကို ${protocol.toUpperCase()} သို့ အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ!\n\n` +
    `Key အသစ်ကို အောက်မှာ ကြည့်ပါ 👇`,
  exchangeFailed: `❌ Protocol ပြောင်းလဲရာတွင် အမှားဖြစ်ပါသည်။ ပြန်လည်ကြိုးစားပါ`,

  // ---- Referral ----
  referralInfo: (params: {
    referralCode: string;
    totalReferred: number;
    paidReferrals: number;
    bonusDays: number;
    canClaimFreeMonth: boolean;
  }) =>
    `🎯 <b>Referral Program</b>\n\n` +
    `🔗 သင့် Referral Link:\n` +
    `<code>https://t.me/BurmeseDigitalStore_bot?start=REF_${params.referralCode}</code>\n\n` +
    `📊 <b>စာရင်း:</b>\n` +
    `👥 စုစုပေါင်း Refer: ${params.totalReferred}\n` +
    `✅ ဝယ်ယူပြီး: ${params.paidReferrals}\n` +
    `📅 Bonus ရက်: ${params.bonusDays}\n\n` +
    `🎁 <b>Reward:</b>\n` +
    `• Refer တစ်ယောက်ဝယ်တိုင်း: +5 ရက် bonus\n` +
    `• 3 ယောက်ဝယ်ရင်: 1 လ free key 🎉\n\n` +
    (params.canClaimFreeMonth ? `✨ <b>Free Month Key ရယူနိုင်ပါပြီ!</b>` : ''),

  referralRewardEarned: (referrerName: string, bonusDays: number) =>
    `🎉 ${referrerName}! သင် Refer ပေးထားတဲ့ user key ဝယ်ပါပြီ!\n` +
    `📅 +${bonusDays} ရက် bonus ရရှိပါပြီ!`,

  referralDisabled: `⚠️ Referral system ယာယီပိတ်ထားပါသည်`,

  // ---- Admin ----
  adminPanel:
    `🔧 <b>Admin Panel</b>\n\n` +
    `လုပ်ဆောင်ချက်ကို ရွေးပါ:`,

  // ---- Errors ----
  error: `❌ အမှားတစ်ခု ဖြစ်ပေါ်ပါသည်။ ပြန်လည်ကြိုးစားပါ`,
  banned: `🚫 သင့် account ကို ပိတ်ထားပါသည်\n\nအကြောင်းအရာ: `,
  rateLimited: `⚠️ ခဏနေမှ ထပ်ကြိုးစားပါ`,
  notAvailable: `⚠️ ဤလုပ်ဆောင်ချက်ကို ယာယီရပ်ထားပါသည်`,

  // ---- Order Statuses ----
  orderApproved: (orderNumber: string) =>
    `✅ Order ${orderNumber} အတည်ပြုပြီးပါပြီ!\n\n🔑 VPN Key ကို အောက်မှာ ကြည့်ပါ 👇`,
  orderRejected: (orderNumber: string) =>
    `❌ Order ${orderNumber} ကို ငြင်းပယ်ပါပြီ\n\n📞 ပြဿနာရှိပါက @BurmeseDigitalStore သို့ ဆက်သွယ်ပါ`,

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
    `📦 <b>New Bot Order: ${params.orderNumber}</b>\n\n` +
    `👤 ${params.userName} (ID: ${params.telegramId})\n` +
    `🛒 ${params.planName}\n` +
    `🌐 Server: ${params.serverName}\n` +
    `⚙️ Protocol: ${params.protocol.toUpperCase()}\n` +
    `💰 <b>${params.amount.toLocaleString()} Ks</b>\n` +
    (params.ocrMatch !== undefined
      ? `\n🔍 OCR: ${params.ocrMatch ? '✅ Match' : '❌ No match'}\n`
      : '') +
    `\n⏳ Awaiting approval...`,
} as const;
