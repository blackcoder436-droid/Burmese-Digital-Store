// Simple polling bridge for local development
// Fetches updates from Telegram API and forwards to local webhook endpoint
// Usage: node scripts/bot-poll.mjs

const BOT_TOKEN = '8533001019:AAFpWlhtq8KIne4W0jsH5Oivl8A6tHjmo6g';
const LOCAL_WEBHOOK = 'http://localhost:3000/api/telegram/bot/webhook';
const WEBHOOK_SECRET = 'mAPjt90RSU14l7vcbKX6Jw5fhex3HWds';

let offset = 0;

async function poll() {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=30`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.ok || !data.result?.length) return;

    for (const update of data.result) {
      offset = update.update_id + 1;

      // Forward to local webhook
      try {
        const fwd = await fetch(LOCAL_WEBHOOK, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-telegram-bot-api-secret-token': WEBHOOK_SECRET,
          },
          body: JSON.stringify(update),
        });
        const type = update.message?.text || update.callback_query?.data || 'photo';
        console.log(`✅ [${update.update_id}] ${type} → ${fwd.status}`);
      } catch (err) {
        console.error(`❌ Forward failed:`, err.message);
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Poll error:', err.message);
    }
  }
}

async function main() {
  // Delete any existing webhook first
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
  console.log('🤖 Bot polling started... (Ctrl+C to stop)');
  console.log(`📡 Forwarding to ${LOCAL_WEBHOOK}\n`);

  while (true) {
    await poll();
  }
}

main().catch(console.error);
