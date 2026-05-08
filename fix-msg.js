const fs = require('fs');

const path = 'src/lib/telegram-bot/messages.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  `export const MSG = {`,
  `export const MSG = {
  // ---- Dynamic Welcome ----
  welcomeBilingual: (name, lang) => lang === 'en' ? 
    \`🌟 <b>Burmese Digital Store</b> Welcome!\\n\\nHello \${name}! 👋\\n\\n🔐 Premium VPN Service\\n⚡ Fast Servers\\n🛡️ Full Security\\n💰 Cheap Prices\\n\\nPlease choose an option from the menu below 👇\` :
    \`🌟 <b>Burmese Digital Store</b> မှ ကြိုဆိုပါတယ်!\\n\\nမင်္ဂလာပါ \${name}! 👋\\n\\n🔐 Premium VPN Service\\n⚡ မြန်ဆန်သော Server များ\\n🛡️ လုံခြုံမှုအပြည့်\\n💰 စျေးနှုန်းသက်သာ\\n\\nအောက်ပါ menu မှ ရွေးချယ်ပါ 👇\`,

  helpBilingual: (lang) => lang === 'en' ? 
    \`📖 <b>How to use</b>\\n\\n🔑 <b>Buy VPN Key:</b>\\n1️⃣ Click "🛒 Buy VPN"\\n2️⃣ Select Server\\n3️⃣ Select Protocol\\n4️⃣ Select Devices\\n5️⃣ Select Plan\\n6️⃣ Transfer money & Send Screenshot\\n7️⃣ Get your Key\\n\\n🎁 <b>Free Test Key:</b>\\n• Join our channel to get 3GB / 72 hours free test\\n\\n🔄 <b>Exchange Protocol:</b>\\n• Change current key to another protocol\\n\\n📞 <b>Help:</b>\\n• Contact @BurmeseDigitalStore\` :
    \`📖 <b>အသုံးပြုနည်း</b>\\n\\n🔑 <b>VPN Key ဝယ်နည်း:</b>\\n1️⃣ "🛒 VPN ဝယ်မည်" ကိုနှိပ်ပါ\\n2️⃣ Server ရွေးပါ\\n3️⃣ Protocol ရွေးပါ\\n4️⃣ Device အရေအတွက် ရွေးပါ\\n5️⃣ Plan ရွေးပါ\\n6️⃣ ငွေလွှဲပြီး Screenshot ပို့ပါ\\n7️⃣ Key ရရှိပါမည်\\n\\n🎁 <b>Free Test Key:</b>\\n• Channel join ပြီးရင် 3GB / 72 နာရီ free test ရနိုင်ပါတယ်\\n\\n🔄 <b>Protocol ပြောင်းခြင်း:</b>\\n• လက်ရှိ key ကို တခြား protocol ပြောင်းနိုင်ပါတယ်\\n\\n📞 <b>အကူအညီ:</b>\\n• @BurmeseDigitalStore ကို ဆက်သွယ်ပါ\`,

  contactBilingual: (lang) => lang === 'en' ?
    \`📞 <b>Contact Support</b>\\n\\n📱 Telegram: @BurmeseDigitalStore\\n🌐 Website: https://burmesedigital.store\\n📧 Email: support@burmesedigital.store\\n\\n⏰ Response Time: 1-12 hours\` :
    \`📞 <b>ဆက်သွယ်ရန်</b>\\n\\n📱 Telegram: @BurmeseDigitalStore\\n🌐 Website: https://burmesedigital.store\\n📧 Email: support@burmesedigital.store\\n\\n⏰ တုံ့ပြန်ချိန်: 1-12 နာရီအတွင်း\`,`
);

fs.writeFileSync(path, code);
console.log('Done modifying messages.ts');
