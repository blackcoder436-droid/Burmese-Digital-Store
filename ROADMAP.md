# Burmese Digital Store — Roadmap & Suggestions

## ✅ Done
- Admin user management (list, search, promote/demote, delete)
- Dashboard user stats
- Profile avatar upload (upload, remove, display in account/navbar/admin)
- Password reset (forgot password flow, email verification, secure reset link)
- Security hardening (input sanitization, magic bytes, CSP headers, rate limiting)
- OCR toggle (admin can enable/disable OCR payment verification)
- Order notifications (removed — email-based instead)
- Analytics dashboard (revenue/orders/users charts, daily view, top products, category breakdown)
- Shop search (debounced search, sort, price filter, category counts, pagination)
- Admin Activity Log (track admin actions — orders, products, users, settings, coupons)
- Export Data (CSV export for orders, users, products)
- UI/UX Polish (skeleton loading, SEO meta tags, page metadata)
- SEO/Performance (image avif/webp, priority/lazy loading, page metadata for auth/legal pages)
- Account page mobile UX (3-column compact stats grid)
- Error/404 pages UX improvement (background glows, animations, error digest display)
- Payment QR/Account display (admin manage payment accounts, checkout shows payment info with copy)
- User Profile editing + Phone field (edit name/phone, change password)
- Product images support (upload with sharp resize, display in cards + detail page)
- Coupon/Discount code system (create/manage coupons, validate at checkout, apply to orders)
- Bug fixes (duplicate label fix, admin product input sanitization)
- Login redirect for checkout (unauthenticated users redirected to login then back to product)
- P0 Security: CSP hardened (unsafe-eval removed in production)
- P0 Security: Admin mutation rate limiting (all PATCH/PUT/DELETE routes)
- P0 Security: ObjectId validation on product [id] routes
- P0 Security: OCR verify uses shared upload security (magic bytes, suspicious content scan)
- P0 Security: OCR amount tolerance (2% instead of exact match)
- VPN: Live server health ping badge (online/offline + latency)
- VPN: Status endpoint (GET /api/vpn/status/:orderId — user check provision + traffic)
- VPN: Admin keys management page (list/filter all active keys across servers)
- Payment Policy: Fraud detection engine (duplicate TxID, duplicate screenshot hash, amount-time suspicious, first-time user, high amount)
- Payment Policy: Payment window with auto-expiry (configurable 15-30 min)
- Payment Policy: Admin mandatory verification checklist (5 fields) before approve
- Payment Policy: Reject reason required on rejection
- Payment Policy: Manual review policy (first-time users, high amounts, configurable threshold)
- VPN: Admin server management (add/edit/disable/delete 3xUI servers + protocols from dashboard)
- Payment Policy: Admin orders UI — fraud flag badges, review filter, checklist, reject dialog

---

## 🚀 Production Deployment Checklist

### 🎯 သင်လုပ်ရမယ့် အဓိကအဆင့် 4 ဆင့်

| # | အဆင့် | အကျဉ်း | Status |
|---|--------|---------|--------|
| 1 | **Email Provider Setup** | Mailgun (Student Pack) ဖွင့် → domain verify → Cloudflare DNS records ထည့် → SMTP credentials ယူ | ⬜ လုပ်ရန် |
| 2 | **JWT_SECRET Generate** | `openssl rand -hex 64` run → strong secret ကို `.env.local` ထဲထည့် | ⬜ လုပ်ရန် |
| 3 | **DigitalOcean Droplet Setup** | Ubuntu + Node.js + Nginx + PM2 install → project clone & build → start | ⬜ လုပ်ရန် |
| 4 | **Cloudflare DNS → Droplet** | A record → droplet IP, SSL Full (strict), Always HTTPS On | ⬜ လုပ်ရန် |

> **အခုလုပ်သင့်တာ:** အဆင့် 1 (Email Provider) ကို အရင်လုပ်ပါ — DNS propagation အချိန်ယူတဲ့အတွက် စောစောလုပ်ထားရင် ကျန်တာတွေ parallel လုပ်နိုင်ပါတယ်။

### 1. Environment Variables (သင်လုပ်ရမယ်)
> DigitalOcean / Vercel dashboard ထဲ ဒီ variables တွေ ထည့်ပါ

| Variable | Value | Status |
|----------|-------|--------|
| `MONGODB_URI` | MongoDB Atlas connection string | ✅ ချိတ်ပြီး |
| `JWT_SECRET` | `openssl rand -hex 64` နဲ့ generate လုပ်ပါ (min 64 chars) | ⬜ လုပ်ရန် |
| `NEXT_PUBLIC_APP_URL` | `https://burmesedigital.store` | ⬜ လုပ်ရန် |
| `SMTP_HOST` | Email provider SMTP host (Mailgun: `smtp.mailgun.org`) | ⬜ လုပ်ရန် |
| `SMTP_PORT` | `587` | ⬜ လုပ်ရန် |
| `SMTP_USER` | Email provider username | ⬜ လုပ်ရန် |
| `SMTP_PASS` | Email provider password / API key | ⬜ လုပ်ရန် |
| `EMAIL_FROM` | `noreply@burmesedigital.store` | ⬜ လုပ်ရန် |
| `EMAIL_FROM_NAME` | `Burmese Digital Store` | ⬜ လုပ်ရန် |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL | ⬜ လုပ်ရန် |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST Token | ⬜ လုပ်ရန် |
| `RATE_LIMIT_FAIL_CLOSED` | `true` (production) | ⬜ လုပ်ရန် |
| `ENABLE_ADMIN_SEED` | `false` (production default) | ⬜ လုပ်ရန် |
| `ADMIN_SECRET` | one-time bootstrap only | ⬜ လုပ်ရန် |
| `VPN_SERVER_ALLOWED_HOSTS` | comma-separated allowlist | ⬜ လုပ်ရန် |

### 2. Email Provider Setup (သင်လုပ်ရမယ်)
- ⬜ Mailgun / Resend account ဖွင့်ပါ (Student Pack: Mailgun 20K/month free)
- ⬜ `burmesedigital.store` domain ထည့်ပါ
- ⬜ Cloudflare DNS ထဲ email provider ပေးတဲ့ records ထည့်ပါ (SPF, DKIM, CNAME)
- ⬜ Domain verify ပြီးအောင်စောင့်ပါ
- ⬜ SMTP credentials ယူပြီး env variables ထဲ ထည့်ပါ

### 3. Cloudflare DNS (သင်လုပ်ရမယ်)
- ⬜ A record → DigitalOcean droplet IP
- ⬜ CNAME `www` → `burmesedigital.store`
- ⬜ Email DNS records (SPF, DKIM) ← email provider setup ကနေ
- ⬜ SSL/TLS → Full (strict) mode ဖွင့်ပါ
- ⬜ Always Use HTTPS → On
- ⬜ Auto Minify → JS, CSS, HTML

### 4. DigitalOcean Server Setup (သင်လုပ်ရမယ်)
- ⬜ Droplet ဖန်တီး (Ubuntu 22.04, min 2GB RAM for Next.js + sharp)
- ⬜ Node.js 20 LTS install (`curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -`)
- ⬜ PM2 install (`npm i -g pm2`) — process manager
- ⬜ Nginx install → reverse proxy (port 3000 → 80/443)
- ⬜ Let's Encrypt SSL (Cloudflare full strict ဆို skip နိုင်)
- ⬜ Firewall: UFW enable, allow 22/80/443 only
- ⬜ Git clone project → `npm install` → `npm run build` → `pm2 start npm --name "store" -- start`
- ⬜ `public/uploads/` directory permissions: `chmod 755`
- ⬜ PM2 startup: `pm2 startup` + `pm2 save`

### 5. Database Backup → Telegram (VPS မှာ setup လုပ်ရန်)
> ည 12:00 (MMT) တိုင်း MongoDB backup ကို Telegram group သို့ auto ပို့ပေးမယ်
- ⬜ VPS မှာ `mongodump` install:
  ```bash
  wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
  echo "deb [ arch=amd64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
  sudo apt update && sudo apt install -y mongodb-database-tools
  ```
- ⬜ `.env.local` မှာ Telegram credentials ထည့်ပါ:
  ```
  TELEGRAM_BOT_TOKEN=8533001019:AAFpWlhtq8KIne4W0jsH5Oivl8A6tHjmo6g
  TELEGRAM_CHAT_ID=-1003830141416
  ```
- ⬜ Cron job setup:
  ```bash
  cd /var/www/burmese-digital-store
  bash scripts/setup-backup-cron.sh
  ```
- ⬜ Test manually:
  ```bash
  bash scripts/run-backup.sh
  ```
- ⬜ Telegram group ထဲ backup ဖိုင်ရောက်လာကြောင်း confirm ပါ

### 6. File Storage (⚠️ Production Issue)
> `public/uploads/` ကို local filesystem ထဲ သိမ်းထား → redeploy/restart ရင် ပျောက်နိုင်
- ⬜ **DigitalOcean Spaces** (S3-compatible) သို့ migrate လုပ်ရန် — OR
- ⬜ **Persistent volume** mount လုပ်ရန် (DigitalOcean block storage)
- ⬜ ယခုအတွက် DigitalOcean droplet ပေါ် direct filesystem သုံးနိုင် (PM2 restart ဆို file မပျောက်)

### 7. Security (Production Must-Do)
- ⬜ `JWT_SECRET` ကို strong random value ပြောင်းပါ (fallback secret ပါနေ)
- ⬜ MongoDB Atlas: IP whitelist → DigitalOcean droplet IP only
- ⬜ MongoDB user: read/write permission only (admin permission မပေးပါနဲ့)
- ⬜ `.env.local` production values git ထဲ push မဝင်ကြောင်း confirm ပါ
- ⬜ Admin account password ကို strong password ပြောင်းပါ
- ⬜ `/api/admin/seed` ကို bootstrap ပြီးတာနဲ့ အပြီးပိတ် (`ENABLE_ADMIN_SEED=false`) + `ADMIN_SECRET` rotate
- ⬜ Production မှာ Upstash Redis rate-limit ကို မဖြစ်မနေ ချိတ်ပါ (မချိတ်ရင် fail-closed 503 ပြန်မယ်)
- ⬜ `VPN_SERVER_ALLOWED_HOSTS` allowlist ကို production domain/subdomains နဲ့ပဲ သတ်မှတ်ပါ (SSRF hardening)
- ⬜ Server egress firewall policy: panel domains/ports သာထွက်နိုင်အောင် စဉ်းစားပါ (optional but recommended)

### 8. Domain & SSL
- ⬜ Cloudflare → `burmesedigital.store` DNS → DigitalOcean IP
- ⬜ Nginx config: `server_name burmesedigital.store www.burmesedigital.store`
- ⬜ HTTPS redirect (Cloudflare "Always Use HTTPS" / Nginx redirect)
- ⬜ `next.config.js` images hostname ✅ `burmesedigital.store` ပါပြီးသား
- ⬜ Cloudflare SSL/TLS mode: **Full (strict)** (Flexible မသုံးပါ)
- ⬜ Origin cert (Let's Encrypt သို့ Cloudflare Origin Cert) တပ်ပြီး end-to-end TLS တည်ဆောက်ပါ

---

## 🔐 Security Hardening Phase 3 — Production Readiness (Next)

> production တင်ပြီးနောက်ပိုင်းမှာ attack surface လျော့ဖို့ + ops လုပ်ငန်းစဉ်တည်ငြိမ်ဖို့

### S5 — CSP Nonce Migration (HIGH)
- ✅ `Content-Security-Policy` ကို nonce-based scripts သို့ migrate လုပ်ပြီး
- ✅ Production မှာ `script-src 'unsafe-inline'` ကိုဖြုတ်ပြီး nonce + strict-dynamic သုံးထားပြီး

### S6 — Log Redaction + Retention (MEDIUM)
- ✅ Logger layer မှာ `authorization/cookie/token/password/resetToken` pattern တွေ redaction ထည့်ပြီး
- ✅ Production log retention policy (90 days default) + `LOG_RETENTION_DAYS` env configurable

### S7 — Uploads Malware Scanning / Quarantine (MEDIUM)
- ✅ Payment screenshot upload ကို quarantine folder (`/quarantine/`) ထဲထားပြီး admin approve/reject ပေါ်မူတည်ပြီး release/delete လုပ်ပြီး
- ✅ Admin-only screenshot preview API (`/api/admin/screenshot`) for quarantined files

### S8 — CI Security Gates (MEDIUM)
- ✅ CI မှာ `npm audit --omit=dev --audit-level=high` enforce ထားပြီး (high/critical ဖြစ်ရင် fail)
- ✅ Secret scanning (Gitleaks) + dependency review workflow ထည့်ပြီး

### S9 — Incident Runbooks (LOW-MEDIUM)
- ✅ `SECURITY.md` (reporting + support policy)
- ✅ `INCIDENT_RESPONSE.md` (roles, triage, comms)
- ✅ `SECRET_ROTATION.md` (JWT/ADMIN_SECRET/Upstash/S3 credentials rotation)

### S10 — Monitoring & Alerts (LOW-MEDIUM)
- ✅ Alert rules: repeated login failures, reset-password spikes, seed endpoint hits, 503 rate-limit spikes
- ✅ Admin actions monitoring: user promote/demote, server URL changes, export usage

### S11 — Windows Dev Reliability (LOW)
- ⬜ Project ကို OneDrive sync folder ပြင်ပသို့ရွှေ့ရန် (Next.js `.next/trace` EPERM issue လျော့)

---

## 🚧 Next Features (in order)

1. ~~**Profile Avatar Upload**~~ ✅
   - ~~Allow users to upload/change their profile picture~~
   - ~~Show avatar in account page, admin user list, etc.~~
2. ~~**Password Reset**~~ ✅
   - ~~Forgot password flow (email verification, reset link)~~
3. ~~**Order Notifications**~~ ✅
   - ~~Notify users when order status changes (real-time or email)~~
   - ~~OCR admin toggle (on/off) with settings page~~
   - ~~Notification bell with unread count badge~~
   - ~~Admin gets notified on new orders, users on status changes~~
4. ~~**Analytics Dashboard**~~ ✅
   - ~~Revenue chart, top products, user growth~~
   - ~~Daily data view with date picker & navigation~~
   - ~~Order status/payment method/category pie charts~~
   - ~~Range selector (7D/30D/90D/1Y)~~
5. ~~**Shop Search**~~ ✅
   - ~~Debounced search with regex partial matching~~
   - ~~Category filter with product counts~~
   - ~~Sort options (Newest, Price, Name)~~
   - ~~Price range filter (min/max)~~
   - ~~Active filter chips with clear all~~
   - ~~Numbered page pagination~~
6. ~~**Admin Activity Log**~~ ✅\n   - ~~Track admin actions (order approve, user delete, etc.)~~\n7. ~~**Export Data**~~ ✅\n   - ~~Export users/orders/products to CSV~~

---

## 📋 Quick Production Deploy Commands (Reference)

```bash
# DigitalOcean Droplet ပေါ်မှာ
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx
sudo npm i -g pm2

# Project clone & build
git clone <your-repo-url> /var/www/store
cd /var/www/store
npm install
# .env.local ဖိုင် ဖန်တီးပြီး production values ထည့်ပါ
nano .env.local
npm run build

# Start with PM2
pm2 start npm --name "burmese-store" -- start
pm2 startup
pm2 save

# Nginx reverse proxy
sudo nano /etc/nginx/sites-available/burmesedigital.store
```

```nginx
# /etc/nginx/sites-available/burmesedigital.store
server {
    listen 80;
    server_name burmesedigital.store www.burmesedigital.store;

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Nginx enable & restart
sudo ln -s /etc/nginx/sites-available/burmesedigital.store /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Firewall
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

---

## Notes & Suggestions
- MongoDB ✅ ချိတ်ပြီး, DigitalOcean ✅ အဆင်ပြေပြီ
- Email provider (Mailgun/Resend) setup ကို ဦးစားပေးလုပ်ပါ
- JWT_SECRET ကို production မှာ strong random value သုံးပါ
- File uploads production မှာ persistent storage (DO Spaces / block storage) စဉ်းစားပါ
- For analytics, consider chart libraries (e.g. recharts, chart.js)
- For notifications, consider both in-app (toast, bell icon) and email

---

## � Security Hardening Phase 2 — Auth & Token (2026-02-16)

> Admin role audit မှ တွေ့ရှိသော အားနည်းချက်များ ဖြေရှင်းရန်

### S1 — Token Invalidation (MEDIUM)
- ✅ User model မှာ `tokenVersion: number` field ထည့်ရန်
- ✅ `requireAdmin()` မှာ DB tokenVersion စစ်ရန် (JWT version != DB version → reject)
- ✅ Role change (promote/demote) ပြီးတိုင်း tokenVersion++ increment လုပ်ရန်
- ✅ Password change ပြီးတိုင်း tokenVersion++ increment + new JWT issue လုပ်ရန်
- ✅ JWT payload ထဲ `tokenVersion` ထည့်ရန်

### S2 — Rate Limiting Gaps (LOW)
- ✅ `/api/auth/me` GET/PUT/PATCH endpoints မှာ `apiLimiter` / `authLimiter` ထည့်ရန်

### S3 — Seed Endpoint Hardening (LOW)
- ✅ `ALLOW_ADMIN_SEED_IN_PRODUCTION` bypass ကို ဖယ်ရှားရန်

### S4 — Cookie Hardening (INFO)
- ✅ Cookie name ကို `__Host-auth-token` ပြောင်းရန် (subdomain hijack ကာကွယ်)
- ✅ `sameSite: 'strict'` ပြောင်းရန်

### Execution Order
1. ✅ S1 (tokenVersion — critical fix)
2. ✅ S2 (rate limit gaps)
3. ✅ S3 (seed endpoint)
4. ✅ S4 (cookie hardening)

---

## �🛠️ Code Audit Action Items (2026-02-15)

> ဒီ section က code review လုပ်ပြီးနောက် ထည့်ထားတဲ့ **လုပ်ရန် checklist** ဖြစ်ပါတယ်။
> အစဉ်: **P0 (အရေးပေါ်) → P1 (အရေးကြီး) → P2 (quality improvement)**

### P0 — Fix First (Security + Data Integrity)
- ✅ CSP ကို tighten လုပ်ရန် (`unsafe-eval` removed in production, dev only)
- ✅ Admin mutation APIs (`PATCH/PUT/DELETE`) မှာ rate limit ထည့်ရန်
- ✅ `admin/products/[id]` route တွေမှာ ObjectId validation ထည့်ရန်
- ✅ `/api/ocr/verify` မှာ shared upload security util သုံးရန် (magic bytes + suspicious content scan)
- ✅ OCR amount compare logic ကို tolerance support နဲ့ပြင်ရန် (2% tolerance)

### P1 — Important Next
- ✅ JWT verification stack ကို unify လုပ်ပြီး (`jose` only — `jsonwebtoken` removed, HS256 pinned, shared secret encoding)
- ✅ Rate limit storage ကို Upstash Redis support ထည့်ပြီး (auto fallback to in-memory)
- ✅ OCR language ကို env-based configurable လုပ်ပြီး (`OCR_LANGUAGE` env var)
- ✅ Admin product create/update input sanitization + stricter validation ထည့်ရန်

### P2 — Quality, DX, Reliability
- ✅ API route tests — Vitest (45 tests: security, auth/JWT, OCR, logger)
- ✅ CI workflow — `.github/workflows/ci.yml` (lint → test → build)
- ✅ Structured logging — `src/lib/logger.ts` (JSON, levels, child loggers)
- ✅ Upload storage abstraction — `src/lib/storage.ts` (local + S3/DO Spaces)
- ✅ Backup & restore runbook — `BACKUP.md` (mongodump, uploads sync, DR checklist)

### Suggested Execution Order (One by One)
1. ✅ P0-1 CSP hardening
2. ✅ P0-2 Admin rate limiting
3. ✅ P0-3 Product `[id]` validation
4. ✅ P0-4 OCR verify upload validation unification
5. ✅ P0-5 OCR amount tolerance
6. ✅ P1 items (JWT unify / Upstash Redis / OCR env)
7. ✅ P2 items (tests / CI / logging / storage / backup)

---

## 🔌 3xUI VPN Auto Provision (Next Major Feature)

> Payment approve ပြီးချိန်မှာ 3xUI panel မှ VPN key auto-generate လုပ်ရန်
> Reference: `C:\Users\Asus\OneDrive\Desktop\Project\2026\vpn bot\xui_api.py` + `config.py`

### 📡 Server Data (from vpn bot config.py)

| Server ID | Name | Panel URL | Panel Path | Domain | Sub Port | Protocol |
|---|---|---|---|---|---|---|
| `sg1` | 🇸🇬 Singapore 1 | `https://jan.burmesedigital.store:8080` | `/mka` | `jan.burmesedigital.store` | 2096 | trojan (port 22716) |
| `sg2` | 🇸🇬 Singapore 2 | `https://sg2.burmesedigital.store:8080` | `/mka` | `sg2.burmesedigital.store` | 2096 | trojan |
| `sg3` | 🇸🇬 Singapore 3 | `https://sg3.burmesedigital.store:8080` | `/mka` | `sg3.burmesedigital.store` | 2096 | trojan |
| `us1` | 🇺🇸 US 1 | `https://us.burmesedigital.store:8080` | `/mka` | `us.burmesedigital.store` | 8080 | trojan |

### 💰 VPN Plans & Pricing (from vpn bot config.py)

| Devices | 1 Month | 3 Months | 5 Months | 7 Months | 9 Months | 12 Months |
|---|---|---|---|---|---|---|
| 1 Device | 3,000 Ks | 8,000 Ks | 13,000 Ks | 18,000 Ks | 23,000 Ks | 30,000 Ks |
| 2 Devices | 4,000 Ks | 10,000 Ks | 17,000 Ks | 24,000 Ks | 30,000 Ks | 40,000 Ks |
| 3 Devices | 5,000 Ks | 13,000 Ks | 21,000 Ks | 29,000 Ks | 37,000 Ks | 50,000 Ks |
| 4 Devices | 6,000 Ks | 16,000 Ks | 25,000 Ks | 35,000 Ks | 45,000 Ks | 60,000 Ks |
| 5 Devices | 7,000 Ks | 18,000 Ks | 30,000 Ks | 40,000 Ks | 52,000 Ks | 70,000 Ks |
| 🎁 Free Test | 0 Ks — 3GB / 72 hours / 1 device | | | | | |

> Data: Unlimited (data_limit: 0) for paid plans. Free test: 3GB cap.

### 🔑 3xUI API Endpoints (from xui_api.py)

```
Auth:     POST {panel_url}{panel_path}/login          → body: { username, password } → cookie session
Inbounds: GET  {panel_url}{panel_path}/panel/api/inbounds/list
Add:      POST {panel_url}{panel_path}/panel/api/inbounds/addClient    → { id: inboundId, settings: JSON }
Delete:   POST {panel_url}{panel_path}/panel/api/inbounds/{inboundId}/delClient/{clientUUID}
Stats:    GET  {panel_url}{panel_path}/panel/api/inbounds/getClientTraffics/{clientEmail}
Reset:    POST {panel_url}{panel_path}/panel/api/inbounds/{inboundId}/resetClientTraffic/{clientEmail}
```

**Client settings (trojan protocol):**
```json
{
  "password": "<uuid>",
  "email": "<clientName>",
  "limitIp": <devices>,
  "totalGB": <bytes_or_0>,
  "expiryTime": <unix_ms>,
  "enable": true,
  "tgId": "",
  "subId": "<random_16char>",
  "reset": 0
}
```

**Subscription link:** `https://{domain}:{sub_port}/sub/{subId}`
**Config link (trojan):** `trojan://{uuid}@{domain}:{trojan_port}?security=none&type=tcp#{remark}`

### A) Environment Variables & Config

| Variable | Value | Notes |
|---|---|---|
| `XUI_USERNAME` | (same as vpn bot .env) | 3xUI panel admin |
| `XUI_PASSWORD` | (same as vpn bot .env) | 3xUI panel admin |
| `XUI_TIMEOUT_MS` | `30000` | request timeout |
| `XUI_RETRY_COUNT` | `3` | retry on 500/502/503/504 |

- ✅ `.env.local` ထဲ `XUI_USERNAME`, `XUI_PASSWORD` ထည့်ပြီး
- ✅ Server config ကို DB-backed (`VpnServer` model) + admin CRUD via `/admin/servers` page
- ✅ Plans + pricing ကို `src/lib/vpn-plans.ts` static config file အဖြစ်ထားပြီး (free test plan ပါ)

### B) Backend Implementation

- ✅ `src/lib/xui.ts` — 3xUI service class (TypeScript port of vpn bot's `xui_api.py`)
  - `login()` — cookie-based session auth (POST `/login`)
  - `getInbounds()` — list all inbounds
  - `getInboundByProtocol(protocol)` — find inbound by protocol (default: trojan)
  - `createClient(params)` — add client to inbound (trojan/vless/vmess support)
  - `deleteClient(inboundId, clientUUID)` — remove client
  - `getClientStats(email)` — traffic stats
  - `generateSubLink(domain, subPort, subId)` — subscription URL
  - `generateConfigLink(protocol, uuid, domain, port)` — connection URI
  - Retry strategy: 3 retries, backoff factor 1, retry on 500/502/503/504
  - SSL: undici Agent with rejectUnauthorized: false for self-signed certs
- ✅ `GET /api/vpn/servers` — public route, return server list (id, name, flag, online status)
- ✅ `GET /api/vpn/plans` — public route, return plans & pricing
- ✅ `POST /api/vpn/orders` — authenticated, VPN order creation with payment screenshot
- ✅ `PUT /api/admin/orders` — admin retry provision + revoke key actions
- ✅ `POST /api/vpn/free-test` — authenticated, free test key (1 per user lifetime)
- ✅ `GET /api/vpn/status/:orderId` — user, check provision status of their order (+ live traffic stats)

### C) Database / Model Changes

- ✅ `VpnKey` embedded in Order: `serverId`, `protocol`, `clientEmail`, `clientUUID`, `subId`, `subLink`, `configLink`, `expiryTime`, `devices`, `dataLimitGB`, `provisionStatus` (pending/active/revoked/failed)
- ✅ Order model: add `vpnPlan` field (`{ serverId, planId, devices, months }`), `orderType` field
- ✅ User model: `freeVpnTestUsedAt` field for tracking free test usage

### D) Order Flow Integration

- ✅ VPN product checkout → user selects server + plan (devices × months)
- ✅ Admin approve order → auto-trigger VPN provision via 3xUI
- ✅ Provision success → save VPN key data to order, status → `completed`
- ✅ Provision fail → status → `provision_failed`, admin can manual retry
- ✅ Order reject/refund → auto-trigger VPN key revoke
- ✅ Idempotency guard — prevents double-provision on concurrent requests

### E) Frontend — VPN Page & User UX

- ✅ `/vpn` page — server list cards + plan pricing table + checkout flow
- ✅ Server status badge (online/offline — ping 3xUI panel health via `/api/vpn/health`, 60s cache)
- ✅ Plan selector UI: devices (1-5) × duration (1/3/5/7/9/12 months) matrix
- ✅ Free test key button (1 per user, 3GB/72hrs) via `/api/vpn/free-test`
- ✅ User `/account/orders` — VPN key copy button, sub link, expiry countdown
- ✅ QR code for config link (mobile scan to import) in VpnKeyDisplay

### F) Admin UX

- ✅ Admin order detail: server + plan + provision status badge
- ✅ Manual provision retry / revoke buttons
- ✅ VPN keys management page (list all active keys across servers — `/admin/vpn-keys`)
- ✅ Activity log: `vpn_provisioned`, `vpn_revoked`, `vpn_provision_failed`
- ✅ Admin can view VPN key details (configLink, subLink) and copy them

### G) Security & Reliability

- ✅ XUI credentials server-side only (never expose to client)
- ✅ Idempotency: check if order already provisioned before creating duplicate
- ✅ Retry with exponential backoff (1s, 2s, 4s) on panel API failures
- ✅ Rate limit on provision endpoint (apiLimiter on all routes)
- ✅ Free test key: 1 per user lifetime (tracked in User model `freeVpnTestUsedAt`)

### H) Testing

- ✅ Unit tests for `xui.ts` (17 tests — provision, revoke, stats, config links, retry, data limits, subscription)
- ⬜ Integration test with staging panel (create + verify + delete)
- ⬜ E2E: order → approve → provision → user sees key

### Execution Plan
1. ✅ **A** — env vars + static config files (servers, plans)
2. ✅ **B** — `xui.ts` service + API routes
3. ✅ **C** — database model changes
4. ✅ **D** — order flow integration (approve → provision)
5. ✅ **E** — VPN page + user key display
6. ✅ **F** — admin VPN management UI
7. ✅ **G** — security (idempotency, revoke, rate limit, free test limit)
8. ✅ **H** — VPN unit tests (17 tests, all passing)

---

## 🧾 Manual Payment Verification Policy (No Merchant Account)

> Stripe/merchant မသုံးသေးချိန်အတွက် local pay accounts + admin verification flow ကို standardize လုပ်ရန်

### A) Core Flow & Defaults
- ✅ OCR ON with auto-verify + fraud detection guard rails (strict flags block auto-complete, admin fallback)
- ✅ Status flow: existing `pending -> verifying -> completed/rejected` + fraud detection layer
- ✅ Key delivery ကို `completed` ဖြစ်မှပဲခွင့်ပြုရန် (fraud flags block auto-complete)

### B) Payment Window Rules
- ✅ Payment window configurable (default 30 min, `paymentWindowMinutes` in SiteSettings)
- ✅ Auto-expire: `expireOverdueOrders()` runs on admin fetch, rejects overdue orders
- ✅ Expired order filter in admin queue (status + time-based filtering)

### C) Duplicate & Fraud Detection Rules
- ✅ TxID uniqueness: `isDuplicateTransactionId()` checks across non-rejected orders (sparse index)
- ✅ Screenshot hash: SHA-256 `computeScreenshotHash()` + `isDuplicateScreenshot()` detection
- ✅ Amount-time: `isSuspiciousAmountTime()` — same amount within configurable window (default 5 min)
- ✅ High amount: `isHighAmount()` with configurable `highAmountThreshold` in SiteSettings

### D) Admin Verification Checklist (Mandatory)
- ✅ Reject reason required (`rejectReason` field, API enforces on reject)
- ✅ 5-field checklist: amount, time, account, TxID, payer (saved with `completedAt`/`completedBy`)
- ✅ All checkboxes must be checked before Approve button works (frontend validation + backend saves)

### E) Manual Review Policy
- ✅ First-time users: `isFirstTimeUser()` → flag + `requiresManualReview` (configurable via `requireManualReviewForNewUsers`)
- ✅ High amount: flags orders above `highAmountThreshold` (default 50,000 MMK)
- ✅ Threshold configurable via SiteSettings (`highAmountThreshold`, `requireManualReviewForNewUsers`)

### F) Admin UI / Ops
- ✅ "Review Required" toggle filter in admin orders page
- ✅ Fraud flag badges in table rows (AlertTriangle + ShieldAlert icons) + detailed flags in modal
- ✅ Verification checklist UI + reject reason dialog + action history saved to order

### Suggested Execution Order
1. ✅ A (OCR ON + fraud detection approach)
2. ✅ B (payment window + auto-expiry)
3. ✅ C (fraud detection engine — `src/lib/fraud-detection.ts`)
4. ✅ D (admin verification checklist)
5. ✅ E + F (manual review policy + admin UX with fraud badges)

---

## 📱 Future Plan: Web → React Native (Expo) Expansion

> အခု web app ကို stable အောင်အရင်တည်ဆောက်ပြီး၊ နောက်ပိုင်း Android/iOS app အဖြစ် React Native + Expo နဲ့ချဲ့ရန် long-term plan

### A) Architecture Readiness (Web-first, Mobile-ready)
- ⬜ Business logic ကို API-first pattern နဲ့ထားရန် (UI နှင့် logic ခွဲ)
- ⬜ Shared types/schema ကို reusable module အဖြစ်ခွဲရန်
- ⬜ API response format ကို consistent (`success/data/error`) ဖြင့် standardize လုပ်ရန်
- ⬜ Web-only dependencies (DOM/localStorage direct calls) ကို abstraction ခွဲရန်

### B) Mobile App Scope (Phase 1 MVP)
- ⬜ Expo project scaffold လုပ်ရန် (`apps/mobile` or separate repo)
- ⬜ Core screens: Login/Register, Shop, Product Detail, Checkout, Orders, Account
- ⬜ Contact screen (Telegram/WhatsApp/Viber/Facebook links)
- ⬜ Push notification baseline (order status updates)

### C) Auth & Session Strategy
- ⬜ Mobile auth အတွက် token-based flow define လုပ်ရန် (cookie-only မထား)
- ⬜ Refresh token rotation policy သတ်မှတ်ရန်
- ⬜ Secure storage သုံးရန် (Expo SecureStore)
- ⬜ Logout/all-device revoke behavior သတ်မှတ်ရန်

### D) API & Backend Changes for Mobile
- ⬜ CORS/mobile client access policy စစ်ရန်
- ⬜ Versioned API path သတ်မှတ်ရန် (`/api/v1/...`)
- ⬜ Rate limit rule တွေကို mobile/web ခွဲနိုင်အောင်ပြင်ရန်
- ⬜ Image upload flow (avatar/payment) ကို mobile compatible စစ်ဆေးရန်

### E) UI/UX System Alignment
- ⬜ Design tokens (colors/spacing/typography) ကို cross-platform mapping လုပ်ရန်
- ⬜ Navigation mapping (App Router → React Navigation) documentation ရေးရန်
- ⬜ Myanmar font rendering/performance on Android/iOS စမ်းရန်
- ⬜ Dark/Light mode behavior ကို mobile မှာတူညီစေရန်

### F) DevOps & Release
- ⬜ Environment split: web/staging/prod + mobile/staging/prod
- ⬜ Expo EAS build pipeline setup (Android + iOS)
- ⬜ Crash/Error monitoring (Sentry for mobile) ထည့်ရန်
- ⬜ Store readiness checklist (Play Store/App Store metadata, privacy, screenshots)

### G) Rollout Strategy
- ⬜ Internal alpha (admin + small users)
- ⬜ Closed beta (50-100 users)
- ⬜ Feedback-based fixes + performance tuning
- ⬜ Public launch with phased rollout

### Recommended Sequence
1. ⬜ A + C (backend/mobile-ready foundation)
2. ⬜ D (API adjustments)
3. ⬜ B + E (Expo app MVP + UI alignment)
4. ⬜ F (build/release pipeline)
5. ⬜ G (beta → public rollout)

---

## How to use this file
- Check off (✅) each feature as it's completed
- ⬜ → ✅ ပြောင်းပြီး deploy progress track လုပ်ပါ
- Add new ideas below as needed
- Use as a living roadmap for the project
