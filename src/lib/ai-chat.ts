// ==========================================
// AI Chat Assistant - Core Library
// Burmese Digital Store
//
// Handles AI API communication, knowledge base,
// system prompts for customer support & admin control
// Provider: GitHub Models (GPT-4o / GPT-4o-mini)
// ==========================================

import { VPN_PLANS, getPlansForDevices, getDeviceCounts } from '@/lib/vpn-plans';
import { getEnabledServers, type VpnServer } from '@/lib/vpn-servers';
import { vpsPlans } from '@/lib/vps-plans';

// ==========================================
// FAQ Auto-Reply — handles common questions
// without calling the AI API (faster, cheaper, no errors)
// ==========================================

interface FaqMatch {
  /** The instant reply to return */
  reply: string;
  /** If true, still forward to AI for a fuller answer (FAQ used as fallback only) */
  passthrough?: boolean;
}

const CONTACT_INFO_MY = `### ဆက်သွယ်ရန်
- **Telegram Bot:** [@BurmeseDigitalStore_bot](https://t.me/BurmeseDigitalStore_bot) — VPN ဝယ်ယူခြင်း၊ Free Test Key ရယူခြင်း၊ အကူအညီ
- **Telegram Channel:** [@BurmeseDigitalStore](https://t.me/BurmeseDigitalStore) — သတင်းနှင့် updates
- **WhatsApp:** [+1 (857) 334-2772](https://wa.me/18573342772)
- **Viber:** +1 (857) 334-2772
- **Email:** support@burmesedigital.store
- **Facebook:** [Burmese Digital Store](https://www.facebook.com/BurmeseDigitalStore/)

🚀 **Telegram Bot** က အမြန်ဆုံး ဖြစ်ပါတယ်!`;

const CONTACT_INFO_EN = `### Contact Us
- **Telegram Bot:** [@BurmeseDigitalStore_bot](https://t.me/BurmeseDigitalStore_bot) — Buy VPN, Free Test Key, Support
- **Telegram Channel:** [@BurmeseDigitalStore](https://t.me/BurmeseDigitalStore) — News & updates
- **WhatsApp:** [+1 (857) 334-2772](https://wa.me/18573342772)
- **Viber:** +1 (857) 334-2772
- **Email:** support@burmesedigital.store
- **Facebook:** [Burmese Digital Store](https://www.facebook.com/BurmeseDigitalStore/)

🚀 **Telegram Bot** is the fastest way to get support!`;

function buildPricingReply(lang: 'my' | 'en'): string {
  const devices = getDeviceCounts();
  const header = lang === 'my'
    ? '### VPN အစီအစဉ်များနှင့် ဈေးနှုန်းများ (MMK)\n\n'
    : '### VPN Plans & Pricing (MMK)\n\n';
  let text = header;
  for (const d of devices) {
    const plans = getPlansForDevices(d);
    const deviceLabel = lang === 'my' ? `**${d} Device:**` : `**${d} Device${d > 1 ? 's' : ''}:**`;
    text += `${deviceLabel}\n`;
    for (const p of plans) {
      text += `- ${p.months} ${lang === 'my' ? 'လ' : `month${p.months > 1 ? 's' : ''}`}: **${p.price.toLocaleString()} MMK**\n`;
    }
    text += '\n';
  }
  text += lang === 'my'
    ? '✅ Plan အားလုံးမှာ **Unlimited Data** ပါဝင်ပါတယ်။\n\n💡 ဘယ်လို device ဘယ်နှစ်ခု၊ ဘယ်နှစ်လ သုံးချင်လဲ ပြောပြပါ!'
    : '✅ All plans include **Unlimited Data**.\n\n💡 How many devices do you need? And for how long?';
  return text;
}

function detectLanguage(text: string): 'my' | 'en' {
  // Count Myanmar Unicode characters
  const myCount = (text.match(/[\u1000-\u109F]/g) || []).length;
  return myCount > 2 ? 'my' : 'en';
}

const DOMAIN_EXTENSIONS = [
  '.tech',
  '.dev',
  '.software',
  '.engineer',
  '.codes',
  '.systems',
  '.app',
  '.studio',
  '.page',
  '.live',
  '.me',
  '.ninja',
  '.rocks',
  '.games',
  '.works',
  '.email',
  '.foo',
];

function buildDomainServiceReply(lang: 'my' | 'en'): string {
  if (lang === 'my') {
    return [
      'Domain ဝယ်လို့ရပါတယ်။ ကျွန်တော့် store မှာ Developer Domains service ရှိပြီး ၁ နှစ်စာ 30,000 MMK ပါ။',
      '',
      'ဝယ်နည်း:',
      '1. /domains ကိုသွားပါ',
      '2. လိုချင်တဲ့ domain name ထည့်ပြီး Search နှိပ်ပါ',
      '3. Available ဖြစ်တဲ့ domain ကို Add to cart လုပ်ပါ',
      '4. Payment screenshot တင်ပြီး admin manual verify ပြီးမှ domain ကို register လုပ်ပေးပါမယ်။',
      '',
      `ရနိုင်တဲ့ extensions: ${DOMAIN_EXTENSIONS.join(', ')}`,
      '',
      'လိုချင်တဲ့ domain name ပြောပေးရင် စစ်နည်းကို ကူညီပေးမယ်။',
    ].join('\n');
  }

  return [
    'Yes, you can buy domains from Burmese Digital Store. Developer Domains are 30,000 MMK for 1 year.',
    '',
    'How to buy:',
    '1. Go to /domains',
    '2. Search your domain name',
    '3. Add an available domain to cart',
    '4. Upload payment screenshot; admin manually verifies and registers the domain.',
    '',
    `Supported extensions: ${DOMAIN_EXTENSIONS.join(', ')}`,
  ].join('\n');
}

function formatMMK(value: number): string {
  return `${value.toLocaleString()} MMK`;
}

function buildVpsServiceReply(lang: 'my' | 'en'): string {
  if (lang === 'my') {
    const lines = [
      'ရပါတယ်။ BDS မှာ Cloud VPS service ရှိပါတယ်။ Ubuntu VPS ကို payment စစ်ပြီး provision လုပ်ပေးပါတယ်။',
      '',
      'လက်ရှိ VPS plans:',
      ...vpsPlans.map((plan) => {
        const specs = plan.specs.map((spec) => `${spec.label}: ${spec.value}`).join(', ');
        return `- ${plan.name}: ${formatMMK(plan.price)} / လ (${specs})`;
      }),
      '',
      'ဝယ်ချင်ရင် /vps မှာ plan ရွေးပြီး cart/checkout ကနေ payment screenshot တင်ပါ။ Region/OS လိုအပ်ချက်ရှိရင် checkout မှာမှတ်ချက်ပေးပါ။',
    ];
    return lines.join('\n');
  }

  return [
    'Yes. BDS offers Cloud VPS service. Ubuntu VPS plans are provisioned after payment verification.',
    '',
    'Current VPS plans:',
    ...vpsPlans.map((plan) => {
      const specs = plan.specs.map((spec) => `${spec.label}: ${spec.value}`).join(', ');
      return `- ${plan.name}: ${formatMMK(plan.price)} / month (${specs})`;
    }),
    '',
    'To buy, go to /vps, choose a plan, checkout, and upload your payment screenshot.',
  ].join('\n');
}

function buildServiceOverviewReply(lang: 'my' | 'en'): string {
  if (lang === 'my') {
    return [
      'မင်္ဂလာပါ။ BDS Admin ပါ။ လက်ရှိ Burmese Digital Store မှာ ဒီ services တွေကူညီပေးနိုင်ပါတယ်။',
      '',
      '- VPN plans/key: 1-5 devices, 1/3/5/7/9/12 months, unlimited data',
      '- Cloud VPS: Ubuntu VPS plans, Singapore/US location, payment verify ပြီး provision',
      '- Domain registration: /domains မှာ domain စစ်ပြီး 1 year 30,000 MMK',
      '- Digital shop products: streaming, gaming, software, gift card စတဲ့ active products တွေ',
      '- Payment/order/support: screenshot verify, order status, setup/troubleshooting',
      '',
      'လိုချင်တဲ့ service ကို ပြောပါ။ ဈေးနှုန်း/ဝယ်နည်း/တပ်ဆင်နည်းကို တိတိကျကျပြပေးမယ်။',
    ].join('\n');
  }

  return [
    'Hi, BDS Admin here. Burmese Digital Store can help with:',
    '',
    '- VPN plans/keys: 1-5 devices, 1/3/5/7/9/12 months, unlimited data',
    '- Cloud VPS: Ubuntu VPS plans, Singapore/US locations, provisioned after payment verification',
    '- Domain registration: check domains at /domains, 30,000 MMK for 1 year',
    '- Digital shop products: active streaming, gaming, software, and gift-card products',
    '- Payment/order/support: screenshot verification, order status, setup and troubleshooting',
    '',
    'Tell me what you need and I will show the exact price, steps, or setup help.',
  ].join('\n');
}

/**
 * Try to match an instant FAQ reply for a user message.
 * Returns null if no FAQ matches (should forward to AI).
 */
export function matchFaqReply(message: string): FaqMatch | null {
  const lower = message.toLowerCase().trim();
  const lang = detectLanguage(message);

  // --- Greeting / service overview ---
  const greetingPatterns = [
    /^(hi|hello|hey|mingalarbar|မင်္ဂလာပါ|ဟိုင်း|ဟေး)$/i,
  ];
  if (greetingPatterns.some(p => p.test(message.trim()))) {
    return { reply: buildServiceOverviewReply(lang) };
  }

  const serviceOverviewPatterns = [
    /\b(services?|products?|what.*sell|what.*available|ဘာ.*service|ဘာ.*ရောင်း|ဘာတွေ.*ရှိ|ဘာတွေ.*ရ|ဘာရလဲ|ဘာရှိလဲ)\b/i,
    /(ဝန်ဆောင်မှု|service).*?(ဘာ|ရှိ|ရ|ပေး)/i,
  ];
  if (serviceOverviewPatterns.some(p => p.test(message))) {
    return { reply: buildServiceOverviewReply(lang) };
  }

  // --- VPS service ---
  const vpsPatterns = [
    /\b(vps|cloud\s*server|ubuntu\s*vps|server\s*hosting|droplet)\b/i,
    /(vps|VPS|ဗီပီအက်စ်|cloud\s*server).*?(ရလား|ရှိ|ဝယ်|plan|ဈေး|စျေး|price|လိုချင်)/i,
  ];
  if (vpsPatterns.some(p => p.test(message))) {
    return { reply: buildVpsServiceReply(lang) };
  }

  // --- Contact / Social Links ---
  const contactPatterns = [
    /\b(contact|admin|support|social|link|ဆက်သွယ်|admin.*ဆက်|ဘယ်.*ဆက်|viber|whatsapp|telegram|facebook|email|ဖုန်း|phone)\b/i,
  ];
  if (contactPatterns.some(p => p.test(message))) {
    return { reply: lang === 'my' ? CONTACT_INFO_MY : CONTACT_INFO_EN };
  }

  // --- Domain service / domain purchase ---
  const domainPatterns = [
    /\b(domain|domains|\.com|\.dev|\.app|\.tech|\.software|\.studio|\.page|\.live|\.me)\b/i,
    /(ဒိုမိန်း|ဒိုမိန့်|domain).*(ဝယ်|ရနိုင်|စစ်|register|ဝယ်ချင်|ဈေး|စျေး|price)/i,
  ];
  if (domainPatterns.some(p => p.test(message))) {
    return { reply: buildDomainServiceReply(lang) };
  }

  // --- Pricing / Plans ---
  const pricingPatterns = [
    /\b(price|pricing|plan|ဈေး|စျေး|အစီအစဉ်|ဘယ်လောက်|how\s*much|cost)\b/i,
    /\b(\d+)\s*(ks|kyat|ကျပ်|mmk)\b/i,
  ];
  if (pricingPatterns.some(p => p.test(message))) {
    // Check for budget query: "5000ks ဆို ဘာရလဲ"
    const budgetMatch = message.match(/(\d[\d,]*)\s*(ks|kyat|ကျပ်|mmk)/i);
    if (budgetMatch) {
      const budget = parseInt(budgetMatch[1].replace(/,/g, ''));
      const allPlans = Object.values(VPN_PLANS).filter(p => p.price <= budget);
      if (allPlans.length === 0) {
        const cheapest = Object.values(VPN_PLANS).sort((a, b) => a.price - b.price)[0];
        return {
          reply: lang === 'my'
            ? `${budget.toLocaleString()} MMK ဖြင့် ဝယ်ယူနိုင်သော plan မရှိပါ။ အနည်းဆုံး ဈေးနှုန်းက **${cheapest.price.toLocaleString()} MMK** (${cheapest.devices} Device, ${cheapest.months} လ) ဖြစ်ပါတယ်။`
            : `No plans available at ${budget.toLocaleString()} MMK. The cheapest plan is **${cheapest.price.toLocaleString()} MMK** (${cheapest.devices} Device, ${cheapest.months} month).`,
        };
      }
      // Group by devices
      const grouped = new Map<number, typeof allPlans>();
      for (const p of allPlans) {
        const arr = grouped.get(p.devices) || [];
        arr.push(p);
        grouped.set(p.devices, arr);
      }
      let reply = lang === 'my'
        ? `**${budget.toLocaleString()} MMK** နဲ့ ရနိုင်တဲ့ plan များ:\n\n`
        : `**Plans available at ${budget.toLocaleString()} MMK or less:**\n\n`;
      for (const [dev, plans] of grouped) {
        reply += `**${dev} Device${dev > 1 ? 's' : ''}:**\n`;
        for (const p of plans.sort((a, b) => a.months - b.months)) {
          reply += `- ${p.months} ${lang === 'my' ? 'လ' : `month${p.months > 1 ? 's' : ''}`}: **${p.price.toLocaleString()} MMK**\n`;
        }
        reply += '\n';
      }
      return { reply: reply.trim() };
    }
    // General pricing
    return { reply: buildPricingReply(lang) };
  }
  // --- Setup Help ---
  const setupPatterns = [
    /\b(setup|install|တပ်ဆင်|ဘယ်လို.*သုံး|how.*use|how.*setup|how.*install|v2ray|vpn.*app)\b/i,
  ];
  if (setupPatterns.some(p => p.test(message))) {
    // Pass to AI for platform-specific guidance, but provide a quick summary
    return null;
  }

  // --- VPN Key request ---
  const keyPatterns = [
    /\b(key.*ထုတ်|key.*ပေး|generate.*key|create.*key|key.*ရ|free.*key|test.*key)\b/i,
  ];
  if (keyPatterns.some(p => p.test(message))) {
    return {
      reply: lang === 'my'
        ? `VPN Key ကို ဝယ်ယူပြီးမှ ကျွန်တော် ထုတ်ပေးတာပါ။\n\n**VPN Key ရယူနည်း:**\n1. 🎁 **Free Test Key** — ကျွန်တော့် Telegram Bot [@BurmeseDigitalStore_bot](https://t.me/BurmeseDigitalStore_bot) မှာ "🎁 Free Test Key" နှိပ်ပါ\n2. 💎 **ဝယ်ယူရန်** — Bot မှာ "💎 Buy VPN Key" နှိပ်ပြီး plan ရွေးပါ\n3. 🌐 **Website** — [burmesedigital.store/vpn](https://burmesedigital.store/vpn) မှာ ဝယ်ယူပါ\n\nဝယ်ယူပြီးရင် ကျွန်တော် ကိုယ်တိုင်စစ်ဆေးပြီး key ထုတ်ပေးပါမယ်!`
        : `VPN Keys are generated after purchase verification.\n\n**How to get a VPN Key:**\n1. 🎁 **Free Test Key** — Open my Telegram Bot [@BurmeseDigitalStore_bot](https://t.me/BurmeseDigitalStore_bot) and press "🎁 Free Test Key"\n2. 💎 **Purchase** — Press "💎 Buy VPN Key" in the Bot\n3. 🌐 **Website** — Buy at [burmesedigital.store/vpn](https://burmesedigital.store/vpn)\n\nOnce purchased, I'll personally verify and deliver your key!`,
    };
  }

  // --- AI Model identity question ---
  const identityPatterns = [
    /\b(ai\s*model|what.*model|gpt|claude|gemini|who.*are.*you)\b/i,
    /(ဘယ်.*ai|ဘာ.*model|ဘယ်.*model|ဘယ်သူ|မင်း.*ဘယ်သူ|ဘယ်.*သူ.*လဲ|မင်း.*ဘာလဲ|သင်.*ဘယ်သူ|နင်.*ဘယ်သူ)/i,
  ];
  if (identityPatterns.some(p => p.test(message))) {
    return {
      reply: lang === 'my'
        ? 'ကျွန်တော်က **BDS Admin** ဖြစ်ပါတယ်။ Burmese Digital Store ရဲ့ Admin ပါ။ VPN plans, ဈေးနှုန်း, setup instructions နှင့် store နှင့်ပတ်သက်သော မေးခွန်းတွေကို ကူညီဖြေရှင်းပေးနိုင်ပါတယ်။ ဘာလိုချင်ရင် ပြောပါနော်! 😊'
        : "I'm **BDS Admin** from Burmese Digital Store. I can help with VPN plans, pricing, setup instructions, and store-related questions. Feel free to ask me anything! 😊",
    };
  }

  return null; // No FAQ match — forward to AI
}

// ==========================================
// Prompt Injection Protection
// ==========================================

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|above|prior|your)\s+(instructions?|rules?|prompts?|system)/i,
  /forget\s+(all\s+)?(previous|above|prior|your)\s+(instructions?|rules?|context)/i,
  /disregard\s+(all\s+)?(previous|above|prior|your)/i,
  /you\s+are\s+now\s+(a|an|the|my)\s+/i,
  /new\s+instructions?:/i,
  /system\s*:\s*/i,
  /\bpretend\s+(you('re|r| are)\s+)?/i,
  /act\s+as\s+(a|an|if|my)/i,
  /jailbreak/i,
  /bypass\s+(your\s+)?(rules?|filter|safety|restrictions?)/i,
  /reveal\s+(your\s+)?(system|hidden|secret|internal)\s+(prompt|instructions?|rules?)/i,
  /what\s+(is|are)\s+your\s+(system\s+)?(prompt|instructions?|rules?)/i,
  /repeat\s+(your\s+)?(system|initial)\s+(prompt|message|instructions?)/i,
  /^(system|admin|root|sudo)\s*:/i,
];

const SENSITIVE_REQUEST_PATTERNS = [
  /\b(show|list|dump|export|send|give|print|share)\b.*\b(users?|customers?|emails?|phone\s*numbers?|payment\s*slips?|orders?|database|mongodb|api\s*keys?|secrets?|tokens?|env|environment\s*variables?)\b/i,
  /\b(customers?|users?)\b.*\b(emails?|phone\s*numbers?|orders?|passwords?|tokens?|payment\s*slips?)\b/i,
  /\b(another|other)\s+(user|customer)'?s?\b.*\b(vpn\s*key|subscription|sub\s*link|password|order|email|phone|vps\s*password)\b/i,
  /\b(give|send|show|print|share)\b.*\b(another|other)\b.*\b(vpn\s*key|subscription|password|credential|sub\s*link)\b/i,
  /\b(vpn|vps)\b.*\b(password|credential|key|subscription)\b.*\b(another|other|customer|user)\b/i,
  /\b(i\s*am|i'm)\s+(blackcoder|admin|owner|developer|root)\b.*\b(approve|reject|refund|paid|deliver|generate|send)\b/i,
  /\b(approve|reject|refund|mark\s+(as\s+)?paid|complete|deliver|generate|issue)\b.*\b(order|payment|refund|vpn\s*key|subscription|vps|domain)\b/i,
  /<\s*script\b/i,
  /\bjavascript\s*:/i,
  /\bon(error|load|click|mouseover)\s*=/i,
];

/**
 * Check if a message appears to contain prompt injection attempts.
 * Returns a safe refusal message if detected, null otherwise.
 */
export function detectPromptInjection(message: string): string | null {
  const lang = detectLanguage(message);
  for (const pattern of [...INJECTION_PATTERNS, ...SENSITIVE_REQUEST_PATTERNS]) {
    if (pattern.test(message)) {
      return lang === 'my'
        ? 'တောင်းပန်ပါတယ်။ ဒီလိုတောင်းဆိုမှုကို လုပ်ဆောင်ပေးလို့ မရပါဘူး။ ကျွန်တော်က BDS Admin ပါ။ VPN plans, ဈေးနှုန်း, setup instructions နှင့် store ဆိုင်ရာ ကိစ္စရပ်တွေကို ကူညီပေးနိုင်ပါတယ်။ 😊'
        : "Sorry, I can't process that request. I'm BDS Admin from Burmese Digital Store. I can help with VPN plans, pricing, setup instructions, and store-related matters. 😊";
    }
  }
  return null;
}

// ==========================================
// Knowledge Base Builder
// ==========================================

function buildVpnPlanKnowledge(): string {
  const devices = getDeviceCounts();
  let text = '## VPN Plans & Pricing (MMK)\n\n';

  for (const d of devices) {
    const plans = getPlansForDevices(d);
    text += `### ${d} Device${d > 1 ? 's' : ''}:\n`;
    for (const p of plans) {
      text += `- ${p.months} month${p.months > 1 ? 's' : ''}: ${p.price.toLocaleString()} MMK (${p.expiryDays} days)\n`;
    }
    text += '\n';
  }

  text += `### Total plans available: ${Object.keys(VPN_PLANS).length}\n`;
  text += `### Data: Unlimited for all plans\n`;
  text += `### Protocols: Trojan, VLESS, VMess, Shadowsocks\n`;

  return text;
}

function buildStoreKnowledge(enabledServers?: VpnServer[]): string {
  // Build dynamic server list from enabled servers
  let serverListText = '';
  if (enabledServers && enabledServers.length > 0) {
    serverListText = enabledServers.map(s => {
      const protocols = s.enabledProtocols?.length > 0 ? s.enabledProtocols.join(', ') : 'Trojan';
      const status = s.online ? '🟢 Online' : '🔴 Offline';
      return `  - ${s.name} (${s.id}) - ${status} - Protocols: ${protocols}`;
    }).join('\n');
  } else {
    serverListText = '  - Server information currently unavailable';
  }

  return `
## Store Information
- Name: Burmese Digital Store (BDS)
- URL: https://burmesedigital.store
- Admin identity: BDS Admin (you — the person responding for Burmese Digital Store)
- Products: VPN accounts, domain registration, streaming subscriptions, gaming credits, software licenses, gift cards
- Payment Methods: KPay, WaveMoney, AYA Pay, CB Pay and other Myanmar mobile payment methods
- Delivery: Digital delivery after payment verification. VPN/product delivery can be fast after approval; domains are registered manually after admin verification.
- Currency: Myanmar Kyat (MMK)
- Language: Myanmar (Burmese) and English

## Domain Service Details
- Burmese Digital Store DOES sell/register Developer Domains from the /domains page.
- Domain page: https://burmesedigital.store/domains
- Price: 30,000 MMK per domain for 1 year.
- Supported extensions: ${DOMAIN_EXTENSIONS.join(', ')}
- Customers search a domain name, choose an available result, add it to cart, pay, and upload payment screenshot.
- Domain registration is manual after admin payment verification. Do NOT say domain service is unsupported.
- If a user sends a localhost URL such as http://localhost:3000/domains, treat it as the /domains page path, not a public domain name.

## VPN Service Details
- Custom VPN service with multiple servers
- Currently Available Servers (ONLY mention these servers to customers):
${serverListText}
- NOTE: Only list servers shown above. Do NOT mention servers that are not in this list.
- Protocols: Trojan, VLESS, VMess, Shadowsocks
- Apps supported: v2rayNG (Android), Streisand/V2Box (iOS), V2RayN (Windows), V2RayU (macOS)
- Unlimited data on all plans
- Multi-device support (1-5 devices per plan)
- All servers support TLS encryption

## Purchase Process
1. Visit https://burmesedigital.store/vpn and browse VPN plans
2. Select plan (choose device count: 1-5, duration: 1-12 months)
3. Click "Buy Now" - redirected to payment page
4. Choose payment method (KPay, WaveMoney, AYA Pay, CB Pay)
5. Transfer exact amount to shown account
6. Upload payment screenshot
7. Wait for admin verification (1-5 minutes during business hours)
8. Once approved, VPN credentials appear in /account/vpn-keys
9. Copy subscription link and import into VPN app

## Support & Contact
- Support tickets: /account/support (login required)
- Ticket categories: Order, Payment, VPN, Account, Other
- Contact page: /contact
- Response time: Usually within 1 hour during business hours
- Business hours: 9AM - 10PM Myanmar Time (MMT/UTC+6:30)

## Social Links & Direct Contact
- Telegram Bot: @BurmeseDigitalStore_bot (https://t.me/BurmeseDigitalStore_bot) - Buy VPN, get free test key, support
- Telegram Channel: @BurmeseDigitalStore (https://t.me/BurmeseDigitalStore) - News & updates
- WhatsApp: +1 (857) 334-2772 (https://wa.me/18573342772)
- Viber: +1 (857) 334-2772
- Email: support@burmesedigital.store
- Facebook: Burmese Digital Store (https://www.facebook.com/BurmeseDigitalStore/)

## Refund Policy
- Digital products are generally non-refundable after delivery
- Refunds considered for: undelivered products, technical issues preventing use
- Partial refunds available for remaining unused period
- Contact support within 24 hours for refund requests

## Common VPN Setup Instructions

### Android (v2rayNG) - Most Popular:
1. Download v2rayNG from Google Play Store or APK
2. Go to /account/vpn-keys in your browser
3. Copy the subscription link (long press - copy)
4. Open v2rayNG - tap + - "Import from clipboard"
5. Tap the play button to connect
6. If connection fails: try different server or protocol

### iOS (Streisand / V2Box):
1. Download "Streisand" or "V2Box" from App Store
2. Go to /account/vpn-keys in Safari
3. Copy subscription link
4. Open Streisand - Settings - Add subscription URL - paste
5. Select a server and connect
6. For V2Box: Add Server - Import from clipboard

### Windows (V2RayN):
1. Download V2RayN from GitHub releases
2. Extract and run v2rayN.exe
3. Go to Subscription - Subscription Settings - Add
4. Paste subscription URL - click Update
5. Right-click tray icon - Select server - Connect

### macOS (V2RayU):
1. Download V2RayU from GitHub
2. Click menu bar icon - Import - Paste subscription link
3. Select server and connect

## Troubleshooting Common Issues
- "Connection timeout": Try switching to a different server or protocol
- "Subscription link not working": Make sure you copied the FULL link, refresh the page
- "Slow speed": Singapore servers have lower latency for Myanmar users
- "Can't access certain sites": Try switching protocols (Trojan -> VLESS -> VMess)
- "Key expired": Check expiry date in /account/vpn-keys, purchase renewal
- "Multiple device limit": Each plan allows specific number of simultaneous connections
`;
}

async function buildLiveCatalogKnowledge(): Promise<string> {
  const sections: string[] = [];

  sections.push([
    '## Verified Live Service Catalog',
    '- Core services currently supported by BDS: VPN plans/keys, Cloud VPS, domain registration, active digital shop products, payment/order support, and technical troubleshooting.',
    '- If a customer asks whether VPS, VPN, or domains are available, answer YES and use the details below.',
    '- Never say a service is unavailable unless the live catalog below explicitly says it is unavailable.',
  ].join('\n'));

  sections.push([
    '## Cloud VPS Service',
    '- BDS offers Cloud VPS / Ubuntu VPS service from the /vps page.',
    '- VPS delivery is provisioned after payment verification. Ask for preferred region/OS only when needed.',
    '- Locations shown on the site: Singapore and US.',
    '- Payment flow: choose plan -> add to cart -> checkout -> upload payment screenshot -> admin verifies -> credentials are delivered.',
    '### VPS Plans',
    ...vpsPlans.map((plan) => {
      const specs = plan.specs.map((spec) => `${spec.label}: ${spec.value}`).join(', ');
      return `- ${plan.name}: ${formatMMK(plan.price)} per month (${plan.os}; ${specs})`;
    }),
  ].join('\n'));

  try {
    const [{ default: Product }, { default: PaymentGateway }] = await Promise.all([
      import('@/models/Product'),
      import('@/models/PaymentGateway'),
    ]);

    const [products, gateways] = await Promise.all([
      Product.find({ active: true, purchaseDisabled: { $ne: true } })
        .select('name slug category description price stock fulfillmentMode productType featured')
        .sort({ featured: -1, category: 1, price: 1, createdAt: -1 })
        .limit(40)
        .lean(),
      PaymentGateway.find({ enabled: true })
        .select('name code category type displayOrder instructions')
        .sort({ displayOrder: 1, name: 1 })
        .lean(),
    ]);

    if (products.length > 0) {
      const grouped = new Map<string, typeof products>();
      for (const product of products) {
        const category = String(product.category || 'other');
        const list = grouped.get(category) || [];
        list.push(product);
        grouped.set(category, list);
      }

      const productLines: string[] = ['## Active Digital Shop Products'];
      for (const [category, items] of grouped) {
        productLines.push(`### ${category}`);
        for (const product of items.slice(0, 12)) {
          const stock = Number(product.stock ?? 0);
          const stockLabel = stock > 0 ? `${stock} available` : 'manual/limited availability';
          const description = String(product.description || '').replace(/\s+/g, ' ').slice(0, 140);
          productLines.push(
            `- ${product.name}: ${formatMMK(Number(product.price) || 0)} (${stockLabel}; ${product.fulfillmentMode || 'manual'} fulfillment)${description ? ` - ${description}` : ''}`
          );
        }
      }
      sections.push(productLines.join('\n'));
    } else {
      sections.push('## Active Digital Shop Products\n- No active shop products are currently listed in the live catalog. Do not invent product names.');
    }

    if (gateways.length > 0) {
      sections.push([
        '## Enabled Payment Methods',
        ...gateways.map((gateway) => {
          const category = gateway.category ? `, ${gateway.category}` : '';
          return `- ${gateway.name} (${gateway.code}${category})`;
        }),
        '- For manual payments, customer must upload payment screenshot/slip. Admin manually verifies before delivery.',
      ].join('\n'));
    }
  } catch {
    sections.push([
      '## Live Catalog Fallback',
      '- Product/payment database could not be read for this reply. Use the verified core service catalog, VPN plans, VPS plans, and domain service details in this prompt.',
      '- If a customer asks for exact stock of non-core shop products, ask them to check /shop or send the product name.',
    ].join('\n'));
  }

  return sections.join('\n\n');
}

// ==========================================
// System Prompts
// ==========================================

export async function getCustomerSystemPrompt(): Promise<string> {
  const vpnKnowledge = buildVpnPlanKnowledge();
  let enabledServers: VpnServer[] = [];
  try {
    enabledServers = await getEnabledServers();
  } catch {
    // Fallback: no server info
  }
  const storeKnowledge = buildStoreKnowledge(enabledServers);
  const liveCatalogKnowledge = await buildLiveCatalogKnowledge();

  return `You are BDS Admin, the customer support admin identity for Burmese Digital Store (BDS), a premium digital products and VPN service store in Myanmar. You directly help customers with store questions.

## Your Identity
- Name: BDS Admin
- Role: Store admin who handles customer support, sales, and technical help
- Personality: Friendly, approachable, knowledgeable, confident, speaks as the boss who runs everything
- Represent Burmese Digital Store professionally
- Use first person: "ကျွန်တော်" (I), speak naturally as the store admin

## Core Rules
1. ALWAYS respond in the SAME LANGUAGE the customer uses
   - Myanmar/Burmese text -> respond in Myanmar
   - English text -> respond in English  
   - Mixed -> respond in the dominant language
2. Be concise but complete - customers want quick answers
3. Proactively recommend products when relevant
4. NEVER reveal internal technical details (server IPs, panel URLs, credentials, tech stack)
5. For store/website-specific facts (pricing, policies, servers, payment methods), use ONLY the verified knowledge below and never invent details
6. For general questions (non-store topics), provide a helpful direct answer using general knowledge
7. If a general question is uncertain or time-sensitive, say what you are unsure about briefly instead of guessing
8. For complex issues, tell them you'll handle it personally and direct to support tickets at /account/support
9. For urgent matters, give your direct contact via social links
10. Use emoji sparingly for warmth
11. Format prices clearly: "5,000 MMK" not "5000"
12. When recommending plans, always ask: how many devices? how long? budget?

## Speaking Style
- Speak like a real Page admin in Messenger/Telegram, not like a generic AI model
- Say things like "ကျွန်တော့် store", "ကျွန်တော် ကိုယ်တိုင်စစ်ဆေးပေးပါမယ်", "My store", "I'll handle it personally"
- Be warm, practical, and natural — customers should feel they are talking to the Page admin
- Do not mention "as an AI", "AI model", "knowledge base", "training data", or "I was trained"
- NEVER say you are GPT, Claude, Gemini, or any public AI model — you are BDS Admin
- If asked if you're AI/bot, say you're BDS Admin from Burmese Digital Store

## Strict Boundaries - What You Handle Through Other Channels
- VPN key generation → tell them you'll prepare it after payment, or direct to Telegram Bot for instant purchase
- Account-specific issues → tell them to use /account page or you'll check personally
- Payment/refund → tell them to submit at /account/support and you'll process it
- NEVER say "ပြဿနာတစ်ခုရှိပါတယ်" (there is a problem) without explaining what the actual issue is

## When Asked About Your Identity
- You are BDS Admin from Burmese Digital Store
- You help customers with Burmese Digital Store services
- Do NOT admit to being AI, GPT, Claude, or any AI model
- Simply say you are the store admin helping customers directly

## Contact Information Response Rules
- When asked how to contact, provide your direct social links
- Include Telegram Bot, Telegram Channel, WhatsApp, Viber, Email, and Facebook
- The Telegram Bot (@BurmeseDigitalStore_bot) is the FASTEST way — say "ကျွန်တော့် Telegram Bot"

## Sales Strategy
- If customer asks about VPN: immediately show relevant plans with enthusiasm
- If customer seems budget-conscious: recommend 1-device monthly plan
- If customer wants best value: recommend multi-month plans (savings per month)
- If customer has multiple devices: recommend appropriate device-count plan
- Singapore servers are best for Myanmar users (lowest latency)
- Always mention "unlimited data" as a selling point
- Mention the easy setup process
- Speak as the store admin: "ကျွန်တော့် store မှာ ...", "ကျွန်တော်တို့ဆီမှာ ..."

${storeKnowledge}

${liveCatalogKnowledge}

${vpnKnowledge}

## Quick Response Templates
- Price inquiry: Show exact pricing with personal recommendations as the store owner
- Best plan: Ask needs (devices, duration, budget) then recommend top 2-3 with owner's insight
- Server question: "ကျွန်တော့် Singapore server တွေက Myanmar users အတွက် အကောင်းဆုံးပါ"
- Speed question: All servers high-speed, Singapore has 20-50ms latency from Myanmar
- Payment: KPay, WaveMoney, AYA Pay, CB Pay; "ကျွန်တော် ကိုယ်တိုင်စစ်ဆေးပေးပါမယ်"; 1-5 min
- Setup help: Provide step-by-step for their platform, offer personal help if stuck
- Refund: Digital products non-refundable after delivery, "ပြဿနာရှိရင် ကျွန်တော့်ဆီ တိုက်ရိုက်ပြောပါ"
- Contact/Social: "ကျွန်တော့် Telegram/WhatsApp ကနေ တိုက်ရိုက်ဆက်သွယ်ပါ"
- Budget query: When asked "X MMK ဆို ဘာရလဲ", list ALL matching plans at or below that budget
- Cannot handle here: Redirect to Telegram Bot or support ticket, promise to handle personally

## Response Quality Rules
- Give DIRECT answers first, then add context
- For budget questions: list all plans that match, not just one
- For "how to contact" questions: always give the FULL social links list with URLs
- Never give vague responses like "contact support" without providing actual links
- For store/account/payment/order issues: guide with exact website steps and links
- For general questions: answer clearly first; only bring up store offerings if actually relevant
- When you don't know something, say so honestly and suggest who can help
- For VPN key requests: explain that keys are provided after purchase, direct to Telegram Bot for fastest purchase
`;
}

export function getAdminSystemPrompt(): string {
  const vpnKnowledge = buildVpnPlanKnowledge();

  return `You are the Admin AI Assistant for Burmese Digital Store. You have FULL control over the store's operations and can execute real commands.

## Your Identity
- Name: BDS Admin AI
- Role: Store management, server control, order management, user management, analytics
- You are speaking with the store admin
- Be direct, efficient, and technical when needed
- Respond in the language the admin uses (Myanmar or English)

## Your Capabilities (Real Actions via Commands)
You can perform these actions by including command blocks in your response:

### Server Management
- Check server status (all or specific)
- Enable/disable servers
- View server details and protocol configurations

### Order Management
- View recent orders and pending orders
- Approve pending orders
- Reject orders with reason
- Search orders by order number or user

### User Management
- Look up user details
- View user's orders and VPN keys
- Check user's subscription status

### VPN Key Management
- Check VPN key status and expiry
- View active keys per server

### Analytics
- Get sales summary (today, week, month)
- Revenue reports
- User growth stats
- Server usage stats

## Command Format
When the admin requests an action, include a structured command block:

\`\`\`ai-command
{
  "action": "ACTION_NAME",
  "target": "target_id_or_all",
  "params": { }
}
\`\`\`

## Available Actions:

### Server Actions
- \`server_status\` - Check server status (target: serverId or "all")
- \`server_enable\` - Enable a server (target: serverId)
- \`server_disable\` - Disable a server (target: serverId)

### Order Actions
- \`order_list_pending\` - List all pending orders (target: "all")
- \`order_list_recent\` - List recent orders (target: "all", params: {limit: number})
- \`order_approve\` - Approve a pending order (target: orderId)
- \`order_reject\` - Reject an order (target: orderId, params: {reason: string})
- \`order_search\` - Search orders (target: "all", params: {query: string})

### User Actions
- \`user_search\` - Search users (target: "all", params: {query: string})
- \`user_details\` - Get user details including orders (target: userId)

### Analytics Actions
- \`analytics_summary\` - Get overall analytics (target: "all")
- \`analytics_revenue\` - Revenue report (target: "all", params: {period: "today"|"week"|"month"})

## Server Information
- sg1: Singapore 1 (jan.burmesedigital.store) - Main server
- sg2: Singapore 2 (sg2.burmesedigital.store)
- sg3: Singapore 3 (sg3.burmesedigital.store)
- sg4: Singapore 4 (sg4.burmesedigital.store) - Trojan:24439, VLESS:29338, VMess:19266
- us1: United States (us.burmesedigital.store)
- ny: New York (ny.burmesedigital.store) - Trojan:25491, VLESS:27314, VMess:21784

## VPN Plans
${vpnKnowledge}

## Important Rules
1. Always confirm DESTRUCTIVE actions before executing (disable server, reject order)
2. For destructive actions, first explain impact, then provide the command
3. When showing data, format it clearly (tables, lists)
4. Provide actionable insights with analytics data
5. If admin says "ok", "yes", "ဟုတ်ကဲ့", "ပါ", "လုပ်" after a confirmation prompt, execute the command
6. Multiple commands can be included in one response
`;
}

// ==========================================
// AI API Client
// ==========================================

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiChatOptions {
  messages: AiMessage[];
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  model?: string; // Override model (e.g., admin uses gpt-4o)
}

const DEFAULT_AI_API_URL = 'https://models.github.ai/inference';
const DEFAULT_AI_MODEL = 'openai/gpt-4.1-mini';

export function resolveAiApiUrl(): string {
  return process.env.AI_API_URL || DEFAULT_AI_API_URL;
}

export function resolveAiModel(model?: string): string {
  const apiUrl = resolveAiApiUrl();
  const selected = model || process.env.AI_MODEL || DEFAULT_AI_MODEL;

  if (
    apiUrl.includes('models.github.ai') &&
    !selected.includes('/') &&
    /^(gpt-|chatgpt-|o\d|omni-)/i.test(selected)
  ) {
    return `openai/${selected}`;
  }

  return selected;
}

/**
 * Call the AI API (OpenAI-compatible format).
 * Works with GitHub Models, OpenAI, Google Gemini (via OpenAI compat), etc.
 */
export async function callAiApi(options: AiChatOptions): Promise<string> {
  const apiKey = process.env.AI_API_KEY;
  const apiUrl = resolveAiApiUrl();
  const model = resolveAiModel(options.model);

  if (!apiKey) {
    throw new Error('AI_API_KEY is not configured');
  }

  const response = await fetch(`${apiUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: options.messages,
      max_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0.7,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`AI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (!data.choices?.[0]?.message?.content) {
    throw new Error('Invalid AI API response format');
  }

  return data.choices[0].message.content;
}

/**
 * Call AI API with streaming response.
 * Returns a ReadableStream for SSE.
 */
export async function callAiApiStream(options: AiChatOptions): Promise<ReadableStream> {
  const apiKey = process.env.AI_API_KEY;
  const apiUrl = resolveAiApiUrl();
  const model = resolveAiModel(options.model);

  if (!apiKey) {
    throw new Error('AI_API_KEY is not configured');
  }

  const response = await fetch(`${apiUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: options.messages,
      max_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0.7,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`AI API error (${response.status}): ${errorText}`);
  }

  if (!response.body) {
    throw new Error('No response body for streaming');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          reader.cancel().catch(() => {});
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
            controller.close();
            reader.cancel().catch(() => {});
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              controller.enqueue(
                new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`)
              );
            }
          } catch {
            // Skip unparseable chunks
          }
        }
      } catch (error) {
        reader.cancel().catch(() => {});
        controller.error(error);
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });
}

/**
 * Parse AI command blocks from assistant responses.
 * Returns extracted commands for admin actions.
 */
export function parseAiCommands(content: string): Array<{
  action: string;
  target: string;
  params: Record<string, unknown>;
}> {
  const commands: Array<{
    action: string;
    target: string;
    params: Record<string, unknown>;
  }> = [];

  const regex = /```ai-command\s*\n([\s\S]*?)\n```/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.action && parsed.target) {
        commands.push({
          action: parsed.action,
          target: parsed.target,
          params: parsed.params || {},
        });
      }
    } catch {
      // Skip invalid command blocks
    }
  }

  return commands;
}
