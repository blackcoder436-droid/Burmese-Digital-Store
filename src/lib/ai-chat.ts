// ==========================================
// AI Chat Assistant - Core Library
// Burmese Digital Store
//
// Handles AI API communication, knowledge base,
// system prompts for customer support & admin control
// ==========================================

import { VPN_PLANS, getPlansForDevices, getDeviceCounts } from '@/lib/vpn-plans';

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

function buildStoreKnowledge(): string {
  return `
## Store Information
- Name: Burmese Digital Store
- URL: https://burmesedigital.store
- Products: VPN accounts, streaming subscriptions, gaming credits, software licenses, gift cards
- Payment Methods: KPay, WaveMoney, AYA Pay, CB Pay, and other Myanmar payment methods
- Delivery: Instant digital delivery after payment verification
- Currency: Myanmar Kyat (MMK)
- Language: Supports Myanmar (Burmese) and English

## VPN Service Details
- Custom VPN service using 3X-UI panel
- Servers: Singapore (3 servers), United States (1 server)
- Protocols: Trojan, VLESS, VMess, Shadowsocks
- Apps supported: v2rayNG (Android), Streisand/V2Box (iOS), V2RayN (Windows), V2RayU (macOS)
- Unlimited data on all plans
- Multi-device support (1-5 devices)

## Purchase Process
1. Browse products or VPN plans on the website
2. Select desired plan/product
3. Choose payment method (KPay, WaveMoney, etc.)
4. Make payment and upload screenshot
5. Wait for verification (usually within minutes)
6. Receive digital keys/VPN credentials instantly

## Support
- Support tickets available through the website
- Categories: Order, Payment, VPN, Account, Other
- Contact page available at /contact

## Refund Policy
- Digital products are generally non-refundable
- Refunds considered for undelivered products
- Contact support for refund requests

## Common VPN Setup Instructions
### Android (v2rayNG):
1. Download v2rayNG from Google Play Store
2. Copy subscription link from your order
3. In v2rayNG, tap + → Import from clipboard
4. Connect and enjoy!

### iOS (Streisand/V2Box):
1. Download Streisand or V2Box from App Store
2. Copy subscription link
3. Add subscription URL in app settings
4. Connect and enjoy!

### Windows (V2RayN):
1. Download V2RayN from GitHub
2. Copy subscription link
3. Add subscription in Subscription settings
4. Select server and connect
`;
}

// ==========================================
// System Prompts
// ==========================================

export function getCustomerSystemPrompt(): string {
  const vpnKnowledge = buildVpnPlanKnowledge();
  const storeKnowledge = buildStoreKnowledge();

  return `You are the AI assistant for Burmese Digital Store (BDS), a premium digital products store in Myanmar.

## Your Role
- Help customers with questions about products, VPN plans, pricing, and technical support
- Recommend suitable VPN plans based on customer needs
- Guide customers through the purchase process
- Provide VPN setup instructions
- Answer questions in Myanmar (Burmese) or English based on the customer's language
- Be friendly, helpful, and professional

## Important Rules
- ALWAYS respond in the same language the customer uses (Myanmar or English)
- If customer speaks Myanmar, respond in Myanmar
- Be concise but thorough
- Recommend products proactively when relevant
- For payment issues or order problems, suggest creating a support ticket at /account
- NEVER share admin information or internal system details
- NEVER make up information - only use the knowledge provided below
- For questions you cannot answer, politely direct them to create a support ticket
- When recommending VPN plans, consider: number of devices needed, budget, and duration

## Store Knowledge
${storeKnowledge}

## VPN Plans & Pricing
${vpnKnowledge}

## Quick Responses
- If asked about price: provide exact pricing from the plan list
- If asked which plan is best: ask about their needs (devices, duration, budget) then recommend
- If asked about servers: Singapore (3 servers) and US (1 server)
- If asked about speed: all servers provide high-speed connections, Singapore servers have lower latency for Myanmar users
- If asked about payment: KPay, WaveMoney, AYA Pay, CB Pay supported
- If asked about trial: we offer a free trial (1 device, limited data)
`;
}

export function getAdminSystemPrompt(): string {
  const vpnKnowledge = buildVpnPlanKnowledge();

  return `You are the Admin AI Assistant for Burmese Digital Store. You help administrators manage the store and VPN servers.

## Your Capabilities
- Answer questions about store operations
- Help with VPN server management decisions
- Provide server status analysis
- Help draft responses to customer tickets
- Assist with order management
- Provide analytics insights

## Server Management Commands
When the admin wants to perform server actions, respond with a structured command block that the frontend will parse:

For server actions, wrap commands in a JSON code block:
\`\`\`ai-command
{
  "action": "server_status" | "server_restart" | "server_enable" | "server_disable" | "list_users" | "analytics_summary",
  "target": "server_id or 'all'",
  "params": {}
}
\`\`\`

## Available Actions:
- server_status: Check server status (target: server_id or "all")
- server_enable: Enable a server (target: server_id) 
- server_disable: Disable a server (target: server_id)
- list_users: List active VPN users on a server (target: server_id)
- analytics_summary: Get analytics summary (target: "all")

## Server Information
- sg1: Singapore 1 (jan.burmesedigital.store)
- sg2: Singapore 2 (sg2.burmesedigital.store)
- sg3: Singapore 3 (sg3.burmesedigital.store)
- us1: United States (us.burmesedigital.store)

## VPN Plans
${vpnKnowledge}

## Important Rules
- Only respond to admin-level queries
- Always confirm destructive actions before providing the command
- Provide clear explanations of what each action will do
- Respond in the language the admin uses (Myanmar or English)
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
}

/**
 * Call the AI API (OpenAI-compatible format).
 * Works with OpenAI, Google Gemini (via OpenAI compat), local LLMs, etc.
 */
export async function callAiApi(options: AiChatOptions): Promise<string> {
  const apiKey = process.env.AI_API_KEY;
  const apiUrl = process.env.AI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/openai';
  const model = process.env.AI_MODEL || 'gemini-2.0-flash';

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
  const apiUrl = process.env.AI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/openai';
  const model = process.env.AI_MODEL || 'gemini-2.0-flash';

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
        controller.error(error);
      }
    },
    cancel() {
      reader.cancel();
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
