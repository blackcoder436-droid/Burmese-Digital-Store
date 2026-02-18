# AI Agent Setup Guide (VS Code Tunnel + Copilot Pro + Telegram)

> **VPS:** Ubuntu 24.04.3 LTS | Singapore-Server2
> **Date:** 2026-02-17
> **Method:** VS Code Tunnel + Custom Extension (vscode.lm API) + Telegram Bot
> **Models:** GPT-5, Claude 4 Sonnet, Gemini 2.5 Pro, Grok 3, GPT-4o, DeepSeek R1... (Copilot Pro models အားလုံး)

---

## Server Info

| Item | Value |
|---|---|
| OS | Ubuntu 24.04.3 LTS (GNU/Linux 6.8.0-94-generic x86_64) |
| CPU | 2 Cores |
| RAM | 7.76 GB |
| Storage | 153.94 GB |
| IP | 152.42.207.191 |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                   VPS (Singapore-Server2)                  │
│                   Ubuntu 24.04.3 LTS                      │
│                                                           │
│  ┌──────────────┐  ┌──────────────────────────────────┐  │
│  │ VPN Service   │  │ VS Code Server (code tunnel)     │  │
│  │ (XUI/Xray)    │  │  ├─ Copilot Extension (built-in)│  │
│  │ Port: 443     │  │  ├─ Custom Extension             │  │
│  └──────┬───────┘  │  │   ├─ vscode.lm API            │  │
│         │           │  │   ├─ HTTP Bridge (:18801)     │  │
│         │           │  │   └─ Telegram Bot connector   │  │
│   VPN Traffic       │  └──────────┬───────────────────┘  │
│                     │             │                        │
│                     │    ┌────────┴────────┐              │
│                     │    │ Copilot Pro     │              │
│                     │    │ Internal Routing│              │
│                     │    ├────────────────┤              │
│                     │    │ GPT-5          │              │
│                     │    │ Claude 4 Sonnet│              │
│                     │    │ Gemini 2.5 Pro │              │
│                     │    │ Grok 3         │              │
│                     │    │ GPT-4o / 4.1   │              │
│                     │    │ DeepSeek R1    │              │
│                     │    │ ...အားလုံး     │              │
│                     │    └────────────────┘              │
│  ┌──────────────┐  │                                     │
│  │ Telegram Bot  │  │  (telegram-ai.service)             │
│  │ Port: N/A     ├──┤  GitHub Models API (16 models)     │
│  │ (long-poll)   │  │  standalone backup                 │
│  └──────────────┘  │                                     │
└─────────────────────┴─────────────────────────────────────┘

📱 Telegram App ──→ Telegram Bot ──→ Custom Extension ──→ Copilot Models
🌐 Browser     ──→ vscode.dev   ──→ VS Code Tunnel    ──→ Copilot Models
💻 VS Code     ──→ Direct       ──→ Copilot Extension ──→ Copilot Models
```

---

## ရနိုင်တဲ့ Models (Copilot Pro)

### Copilot Internal Models (VS Code Tunnel / Custom Extension ကနေ)

| Model | Type | Notes |
|---|---|---|
| GPT-5 | OpenAI | Latest flagship |
| GPT-4o | OpenAI | Fast + smart |
| GPT-4.1 | OpenAI | Better reasoning |
| o4-mini | OpenAI | Reasoning model |
| Claude 4 Sonnet | Anthropic | Best for coding |
| Claude 3.7 Sonnet | Anthropic | Coding + thinking |
| Gemini 2.5 Pro | Google | 1M context window |
| Grok 3 | xAI | Latest Grok |

### GitHub Models API (Telegram Bot standalone backup)

| Model | Model ID |
|---|---|
| GPT-4o | `gpt-4o` |
| GPT-4o Mini | `gpt-4o-mini` |
| GPT-4.1 | `gpt-4.1` |
| GPT-4.1 Mini | `gpt-4.1-mini` |
| GPT-4.1 Nano | `gpt-4.1-nano` |
| o4 Mini | `o4-mini` |
| o3 Mini | `o3-mini` |
| Llama 3.1 405B | `meta-llama-3.1-405b-instruct` |
| Llama 3.1 70B | `meta-llama-3.1-70b-instruct` |
| Llama 3.1 8B | `meta-llama-3.1-8b-instruct` |
| Mistral Large | `mistral-large` |
| Mistral Small | `mistral-small` |
| Phi-4 | `phi-4` |
| Phi-4 Mini | `phi-4-mini` |
| DeepSeek R1 | `deepseek-r1` |
| Command R+ | `cohere-command-r-plus` |

---

## ✅ အဆင့် 1: Prerequisites

### 1.1 GitHub Account + Copilot Pro Subscription

- Copilot Pro active ဖြစ်ရမယ် (https://github.com/settings/copilot)
- GitHub Models marketplace agree ထားရမယ် (https://github.com/marketplace/models)

### 1.2 GitHub PAT Token

1. https://github.com/settings/tokens → **Generate new token (Classic)**
2. Scopes: ✅ `read:org`
3. Token copy ယူ → `ghp_xxxxxxxxxxxx`

> ⚠️ Token ကို ဘယ်နေရာမှ share မလုပ်ပါနဲ့

### 1.3 Telegram Bot Token

1. Telegram မှာ **@BotFather** ကို ရှာ
2. `/newbot` → Bot name + username ပေး
3. Token copy ယူ → `7123456789:AAHxxxxx...`

### 1.4 Telegram User ID

1. **@userinfobot** ကို message ပို့
2. ID copy ယူ → `975144139` (ဂဏန်း)

---

## ✅ အဆင့် 2: VPS ပေါ်မှာ VS Code CLI Install

```bash
ssh root@152.42.207.191

# VS Code CLI download
curl -Lk 'https://code.visualstudio.com/sha/download?build=stable&os=cli-alpine-x64' -o /tmp/vscode-cli.tar.gz

# Extract
tar -xzf /tmp/vscode-cli.tar.gz -C /usr/local/bin/

# Verify
code --version
```

---

## ✅ အဆင့် 3: VS Code Tunnel Start

```bash
# GitHub account login + tunnel start
code tunnel --accept-server-license-terms

# ပထမဆုံးအကြိမ်:
# 1. Device code ပေးမယ် → https://github.com/login/device ဝင်ပြီး code ထည့်
# 2. Tunnel name ပေး (e.g. "singapore-vps")
# 3. "Connected" ပြရင် အဆင်ပြေပြီ
```

### Tunnel ကို systemd service အနေနဲ့ auto-start:

```bash
cat > /etc/systemd/system/code-tunnel.service << 'EOF'
[Unit]
Description=VS Code Tunnel
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/code tunnel --accept-server-license-terms
Restart=always
RestartSec=5
Environment=HOME=/root

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now code-tunnel
```

### Browser ကနေ ဝင်:

- https://vscode.dev/tunnel/singapore-vps
- GitHub login → VS Code full UI + Copilot Agent Mode ✅

---

## ✅ အဆင့် 4: Custom VS Code Extension (Copilot LM Bridge)

ဒီ extension က `vscode.lm` API သုံးပြီး Copilot Pro models ကို HTTP endpoint အနေနဲ့ expose လုပ်ပေးတယ်။ Telegram bot ကနေ ဒီ endpoint ကို call ပြီး GPT-5, Claude, Gemini စတာတွေ သုံးလို့ ရတယ်။

### 4.1 Extension Project ဖန်တီး

```bash
mkdir -p /root/copilot-bridge-ext
cd /root/copilot-bridge-ext

# package.json
cat > package.json << 'PKGJSON'
{
  "name": "copilot-telegram-bridge",
  "displayName": "Copilot Telegram Bridge",
  "description": "Bridge Copilot LM API to Telegram Bot via HTTP",
  "version": "1.0.0",
  "engines": { "vscode": "^1.90.0" },
  "categories": ["Other"],
  "activationEvents": ["onStartupFinished"],
  "main": "./extension.js",
  "contributes": {
    "commands": [
      {
        "command": "copilotBridge.start",
        "title": "Copilot Bridge: Start Server"
      },
      {
        "command": "copilotBridge.stop",
        "title": "Copilot Bridge: Stop Server"
      },
      {
        "command": "copilotBridge.listModels",
        "title": "Copilot Bridge: List Available Models"
      }
    ]
  },
  "extensionDependencies": ["github.copilot-chat"]
}
PKGJSON
```

### 4.2 Extension Code (extension.js)

```javascript
const vscode = require("vscode");
const http = require("http");

let server = null;
let currentModel = null;
const PORT = 18801;

// Telegram config
const TG_TOKEN = "YOUR_TELEGRAM_BOT_TOKEN";
const OWNER_ID = 975144139;

async function getModels() {
  const models = await vscode.lm.selectChatModels();
  return models.map(m => ({
    id: m.id,
    family: m.family,
    vendor: m.vendor,
    name: m.name,
    maxInputTokens: m.maxInputTokens,
  }));
}

async function chat(modelFamily, messages, systemPrompt) {
  const selector = modelFamily ? { family: modelFamily } : {};
  const models = await vscode.lm.selectChatModels(selector);

  if (models.length === 0) {
    throw new Error("Model not found: " + (modelFamily || "default"));
  }

  const model = models[0];
  const chatMessages = [];

  if (systemPrompt) {
    chatMessages.push(vscode.LanguageModelChatMessage.User(
      "[System]: " + systemPrompt
    ));
  }

  for (const msg of messages) {
    if (msg.role === "user") {
      chatMessages.push(vscode.LanguageModelChatMessage.User(msg.content));
    } else if (msg.role === "assistant") {
      chatMessages.push(vscode.LanguageModelChatMessage.Assistant(msg.content));
    }
  }

  const response = await model.sendRequest(chatMessages);
  let result = "";
  for await (const chunk of response.text) {
    result += chunk;
  }

  return { content: result, model: model.name || model.id };
}

function startServer(context) {
  if (server) return;

  server = http.createServer(async (req, res) => {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (req.method === "GET" && req.url === "/models") {
      try {
        const models = await getModels();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(models));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    if (req.method === "POST" && req.url === "/chat") {
      let body = "";
      req.on("data", c => body += c);
      req.on("end", async () => {
        try {
          const { model, messages, systemPrompt } = JSON.parse(body);
          const result = await chat(model, messages, systemPrompt);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200);
      res.end("ok");
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(PORT, "127.0.0.1", () => {
    vscode.window.showInformationMessage(
      "Copilot Bridge running on port " + PORT
    );
  });
}

function activate(context) {
  // Auto-start server
  startServer(context);

  context.subscriptions.push(
    vscode.commands.registerCommand("copilotBridge.start", () => startServer(context)),
    vscode.commands.registerCommand("copilotBridge.stop", () => {
      if (server) { server.close(); server = null; }
      vscode.window.showInformationMessage("Copilot Bridge stopped");
    }),
    vscode.commands.registerCommand("copilotBridge.listModels", async () => {
      const models = await getModels();
      const items = models.map(m => m.family + " (" + m.vendor + ") - " + m.id);
      vscode.window.showQuickPick(items, { title: "Available Copilot Models" });
    })
  );
}

function deactivate() {
  if (server) { server.close(); server = null; }
}

module.exports = { activate, deactivate };
```

### 4.3 Extension Install

```bash
cd /root/copilot-bridge-ext

# Extension install to VS Code Server
code tunnel install-extension /root/copilot-bridge-ext --force

# Extension activate ဖြစ်ရင်:
# "Copilot Bridge running on port 18801" notification ထွက်မယ်
```

---

## ✅ အဆင့် 5: Telegram Bot (Copilot Bridge Client)

### Existing Telegram Bot Update

VPS မှာ ရှိပြီးသား Telegram bot ကို Copilot Bridge endpoint နဲ့ ချိတ်ဆက်:

```bash
# Telegram bot location
# /root/ai-chat/telegram-bot.js      — GitHub Models API (standalone backup)
# /etc/systemd/system/telegram-ai.service

# Bot Commands:
# /model          — Available models ကြည့်
# /model gpt-5    — Model ပြောင်း
# /clear          — History ရှင်း
# /status         — Current settings
# /bridge on/off  — Copilot Bridge mode on/off
# message ပို့     — AI chat
```

### Bot ကို Copilot Bridge နဲ့ ချိတ်ဆက်ဖို့ Logic:

```javascript
// Telegram bot ထဲမှာ ဒီ logic ထည့်:
// 1. Bridge mode ON → http://127.0.0.1:18801/chat ကို call
// 2. Bridge mode OFF → GitHub Models API (backup) ကို call

async function callCopilotBridge(model, messages, systemPrompt) {
  // Call the VS Code extension HTTP bridge
  const payload = JSON.stringify({ model, messages, systemPrompt });
  // POST to http://127.0.0.1:18801/chat
  // Response: { content: "...", model: "gpt-5" }
}
```

---

## ✅ အဆင့် 6: Verify & Test

### 6.1 VS Code Tunnel Status

```bash
systemctl status code-tunnel
# Active (running) ဖြစ်ရမယ်
```

### 6.2 Browser Access

```
https://vscode.dev/tunnel/singapore-vps
# VS Code UI + Copilot Agent Mode ✅
```

### 6.3 Extension Bridge Health

```bash
curl http://127.0.0.1:18801/health
# "ok"

curl http://127.0.0.1:18801/models
# [{id: "...", family: "gpt-5", vendor: "copilot"}, ...]
```

### 6.4 Telegram Test

```
@Blackcoder_AI_bot ကို message ပို့
/model gpt-5
Hello, what can you do?
# → GPT-5 response ✅
```

---

## VPS Services Summary

| Service | Port | systemd unit | Purpose |
|---|---|---|---|
| VPN (XUI/Xray) | 443 | `x-ui`, `xray` | VPN service |
| VS Code Tunnel | N/A | `code-tunnel` | Remote VS Code + Copilot |
| Copilot Bridge | 18801 (loopback) | via VS Code extension | LM API HTTP bridge |
| AI Chat Server | 18800 (loopback) | `ai-chat` | Browser chat UI (SSH tunnel) |
| Telegram Bot | N/A (long-poll) | `telegram-ai` | Telegram AI chat |

---

## Useful Commands

```bash
# ===== VS Code Tunnel =====
systemctl status code-tunnel        # status
systemctl restart code-tunnel       # restart
journalctl -u code-tunnel -f        # live logs

# ===== Telegram Bot =====
systemctl status telegram-ai        # status
systemctl restart telegram-ai       # restart
journalctl -u telegram-ai -f        # live logs

# ===== AI Chat (Browser) =====
systemctl status ai-chat            # status
systemctl restart ai-chat           # restart
# Access: ssh -N -L 18800:127.0.0.1:18800 root@152.42.207.191
#         http://localhost:18800

# ===== VPN =====
systemctl status x-ui
systemctl status xray

# ===== All Services =====
systemctl list-units --type=service | grep -E 'code-tunnel|telegram-ai|ai-chat|x-ui|xray'
```

---

## Security Notes

1. **PAT Token** ကို environment variable / systemd service ထဲမှာသာ ထားပါ
2. **Telegram Bot Token** ကို code ထဲ hardcode မလုပ်ပါနဲ့ — env variable သုံးပါ
3. VS Code Tunnel ကို **GitHub login** နဲ့ protect ထားပြီးသား
4. Copilot Bridge port 18801 ကို **loopback** bind ထားပါ (public expose မလုပ်ပါနဲ့)
5. Telegram bot ကို **OWNER_ID** restrict ထားပါ (မင်းတစ်ယောက်ထဲ သုံးလို့ရ)
6. **Token ပေါက်ကြားရင်** → ချက်ချင်းဖျက်ပြီး အသစ်ထုတ်
7. Regular token rotation (90 days) လုပ်ပါ

---

## Troubleshooting

### VS Code Tunnel မတက်ရင်

```bash
journalctl -u code-tunnel -n 50 --no-pager
# GitHub login expire ဖြစ်ရင် → code tunnel --accept-server-license-terms (re-login)
```

### Extension Bridge respond မလုပ်ရင်

```bash
curl http://127.0.0.1:18801/health
# Connection refused → Extension activate မဖြစ်သေး
# → Browser ကနေ VS Code ဖွင့်ပြီး extension activate ဖြစ်အောင် စောင့်
```

### Telegram Bot Error

```bash
journalctl -u telegram-ai -n 20 --no-pager
systemctl restart telegram-ai
```

### Model not found

```bash
# Available models စစ်
curl http://127.0.0.1:18801/models | python3 -m json.tool
```

---

## Quick Reference

```bash
# ===== Full Setup =====

# 1. VS Code CLI install
curl -Lk 'https://code.visualstudio.com/sha/download?build=stable&os=cli-alpine-x64' -o /tmp/vscode-cli.tar.gz
tar -xzf /tmp/vscode-cli.tar.gz -C /usr/local/bin/

# 2. Tunnel start (login required first time)
code tunnel --accept-server-license-terms

# 3. systemd service for auto-start
systemctl enable --now code-tunnel

# 4. Browser access
# https://vscode.dev/tunnel/singapore-vps

# 5. Custom extension install (after creating files)
code tunnel install-extension /root/copilot-bridge-ext --force

# 6. Telegram bot
systemctl status telegram-ai

# 7. Browser chat (SSH tunnel needed)
ssh -N -L 18800:127.0.0.1:18800 root@152.42.207.191
# http://localhost:18800
```
