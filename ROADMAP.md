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
- Global top-spacing normalization (reduced page-level top padding to prevent navbar/content gap on public + account pages)
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

## � Phase 4 — Shopping Cart & UX Improvements (2026-02-18)

> Product card UX ပြင်ဆင်ခြင်း + Shopping Cart system ထည့်သွင်းခြင်း + SEO/DX improvements

### Cart System
- ✅ `src/lib/cart.tsx` — CartProvider context (localStorage persistence, add/remove/update/clear)
- ✅ `src/app/cart/page.tsx` — Full cart page (item list, quantity edit, coupon, payment, checkout)
- ✅ `src/app/api/orders/cart/route.ts` — Bulk cart checkout API (multiple products, single payment)
- ✅ CartProvider integrated into root layout
- ✅ Navbar cart icon with item count badge

### Product Card UX Fix
- ✅ ProductCard "Buy Now" → "View Details" ပြောင်းပြီး (click → detail page, not instant buy feel)
- ✅ Product detail page: "Add to Cart" + "Buy Now" dual buttons ရှိပြီးသား

### Admin Dashboard Fix
- ✅ Revenue calculation bug fix (was only summing 5 orders → now uses analytics API for accurate totals)

### SEO Improvements
- ✅ `src/app/sitemap.ts` — Dynamic sitemap generation (static pages + all active products)
- ✅ `src/app/robots.ts` — Robots.txt with proper allow/disallow rules
- ✅ `src/app/shop/[id]/layout.tsx` — `generateMetadata()` for dynamic product SEO (OG, Twitter, canonical)

### DX & Config
- ✅ Myanmar font (Noto Sans Myanmar, Padauk) added to Tailwind config + globals.css
- ✅ `reactStrictMode: true` added to next.config.js
- ✅ `/api/health` endpoint (DB status, uptime, latency)
- ✅ Structured logging: all API routes migrated from `console.error` → `createLogger` (15 files, 35 edits)
- ✅ Human-readable order IDs: `orderNumber` field (BD-000001 format, auto-increment)
- ✅ `src/types/index.ts` synced with all models (ICoupon, INotification, ISiteSettings, IActivityLog, IVpnServer, IPagination, FraudFlag, IVerificationChecklist added)

### Remaining TODOs (Future)
- ✅ Accessibility: ARIA attributes for Navbar/dropdowns, keyboard navigation (Escape), skip-to-content link
- ✅ i18n: Extract inline translations to dictionary files (`src/lib/i18n/en.ts`, `my.ts`, `index.ts`)
- ✅ Testing: API route integration tests (`__tests__/api-routes.test.ts`), fraud detection tests (`__tests__/fraud-detection.test.ts`)
- ✅ Account pages: `/account/vpn-keys`, `/account/notifications`, `/account/orders/[id]`
- ✅ User account deletion flow (privacy/GDPR) — `/api/auth/delete-account` + UI in account page
- ✅ Email verification on registration (`emailVerified` field, 24hr expiry, blocks orders if unverified, Google OAuth auto-verified)
- ✅ Registration rate limit: 1 per 3 minutes per IP (`registerLimiter`)
- ✅ Payment countdown timer component (`PaymentCountdown.tsx`) — live seconds countdown on order detail page
- ✅ Cron endpoint for auto-expiring overdue orders (`/api/cron/expire-orders`)
- ✅ Soft-delete pattern for Users/Products (`deletedAt`/`deletedBy` fields + auto-filter middleware)
- ✅ JSON-LD structured data (Product schema, Organization schema, WebSite schema, Breadcrumb)
- ✅ Error reporting service — Telegram-based error reporter (`src/lib/error-reporter.ts`)
- ✅ Zod-based env validation — `src/lib/env.ts` (server + client env schemas)
- ✅ Zod-based API request body validation — `src/lib/validations.ts` (login, register, Google auth, delete account schemas)
- ✅ VPN page: fetch server list from API instead of hardcoded static array
- ✅ `/api/auth/logout` dedicated route
- ✅ CORS headers for future mobile app support (`CORS_ALLOWED_ORIGINS` env var)

---

## 🔑 Phase 5 — Authentication & Integration (2026-02-18)

> Google OAuth, Telegram integration, account management

### Google OAuth
- ✅ `src/app/api/auth/google/route.ts` — Google ID token verification + auto create/login
- ✅ Google Sign-In button on Login page (Google Identity Services SDK)
- ✅ Google Sign-Up button on Register page
- ✅ Google auth API tests (`__tests__/google-auth-route.test.ts`) for validation, invalid token, existing/new user flows
- ✅ `GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` env vars required

### Telegram Integration
- ✅ `src/lib/telegram.ts` — Telegram Bot API (sendPaymentScreenshot, sendOrderNotification, getTelegramFileUrl)
- ✅ Payment screenshots stored in Telegram channel (non-blocking, graceful fallback)
- ✅ Order model: `telegramFileId`, `telegramMessageId` fields
- ✅ `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHANNEL_ID` env vars required
- ✅ Telegram order approve/reject inline buttons (Phase 9)
- ✅ Telegram webhook handler for callback queries (Phase 9)
- ✅ Manual DB backup to Telegram from admin settings (Phase 9)

### Account Management
- ✅ `/account/orders/[id]` — Full order detail page (status stepper, keys, VPN display)
- ✅ `/account/vpn-keys` — Active VPN keys listing with expiry status
- ✅ `/account/notifications` — Notifications page with mark-all-read
- ✅ Delete account with GDPR compliance (password verify, pending order check, order anonymization)
- ✅ Session UX improvement — remaining session time + expiry timestamp shown in Navbar/account for clearer re-login expectations

### API Improvements
- ✅ `/api/auth/logout` — Dedicated logout POST route
- ✅ Zod validation schemas (`src/lib/validations.ts`) for auth + order APIs
- ✅ `googleId` field added to User model for Google OAuth tracking

---

## �🚀 Production Deployment Checklist

### 🎯 သင်လုပ်ရမယ့် အဓိကအဆင့် 4 ဆင့်

| # | အဆင့် | အကျဉ်း | Status |
|---|--------|---------|--------|
| 1 | **Email Provider Setup** | Resend API key ယူ → `.env.local` ထည့် → domain verify | ✅ ပြီးပြီ |
| 2 | **JWT_SECRET Generate** | `openssl rand -hex 64` run → strong secret ကို `.env.local` ထဲထည့် | ✅ ပြီးပြီ |
| 3 | **DigitalOcean Droplet Setup** | Ubuntu 24.04 + Node.js 20 + Nginx + PM2 install → project clone & build → start | ✅ ပြီးပြီ |
| 4 | **Cloudflare DNS → Droplet** | A record → droplet IP, SSL Full (strict), Always HTTPS On | ✅ ပြီးပြီ |

> **အခုလုပ်သင့်တာ:** အဆင့် 1 (Email Provider) ကို အရင်လုပ်ပါ — DNS propagation အချိန်ယူတဲ့အတွက် စောစောလုပ်ထားရင် ကျန်တာတွေ parallel လုပ်နိုင်ပါတယ်။

### 1. Environment Variables (သင်လုပ်ရမယ်)
> DigitalOcean / Vercel dashboard ထဲ ဒီ variables တွေ ထည့်ပါ

| Variable | Value | Status |
|----------|-------|--------|
| `MONGODB_URI` | MongoDB Atlas connection string | ✅ ချိတ်ပြီး |
| `JWT_SECRET` | `openssl rand -hex 64` နဲ့ generate လုပ်ပါ (min 64 chars) | ✅ ပြီးပြီ |
| `NEXT_PUBLIC_APP_URL` | `https://burmesedigital.store` | ✅ ပြီးပြီ |
| `SMTP_HOST` | Email provider SMTP host (Mailgun: `smtp.mailgun.org`) | ✅ Resend API သုံး |
| `SMTP_PORT` | `587` | ✅ Resend API သုံး |
| `SMTP_USER` | Email provider username | ✅ Resend API သုံး |
| `SMTP_PASS` | Email provider password / API key | ✅ Resend API သုံး |
| `EMAIL_FROM` | `noreply@burmesedigital.store` | ✅ ပြီးပြီ |
| `EMAIL_FROM_NAME` | `Burmese Digital Store` | ✅ ပြီးပြီ |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL | ✅ ပြီးပြီ |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST Token | ✅ ပြီးပြီ |
| `RATE_LIMIT_FAIL_CLOSED` | `true` (production) | ✅ ပြီးပြီ |
| `ENABLE_ADMIN_SEED` | `false` (production default) | ✅ ပြီးပြီ |
| `ADMIN_SECRET` | one-time bootstrap only | ✅ ပြီးပြီ |
| `VPN_SERVER_ALLOWED_HOSTS` | comma-separated allowlist | ✅ ပြီးပြီ |

### 2. Email Provider Setup (သင်လုပ်ရမယ်)
- ✅ Resend API account ဖွင့်ပြီး
- ✅ `burmesedigital.store` domain verify ပြီး
- ✅ Cloudflare DNS ထဲ email provider records ထည့်ပြီး
- ✅ RESEND_API_KEY env variable ထည့်ပြီး

### 3. Cloudflare DNS (သင်လုပ်ရမယ်)
- ✅ A record → DigitalOcean droplet IP (VPS IP set)
- ✅ CNAME `www` → `burmesedigital.store`
- ✅ Email DNS records (SPF, DKIM) ← Resend setup ကနေ
- ✅ SSL/TLS → Full (strict) mode ဖွင့်ပြီး
- ✅ Always Use HTTPS → On
- ✅ Auto Minify → JS, CSS, HTML

### 4. DigitalOcean Server Setup (သင်လုပ်ရမယ်)
- ✅ Droplet ဖန်တီးပြီး (Ubuntu 24.04, 1GB RAM + 2GB Swap)
- ✅ Node.js 20 LTS install
- ✅ PM2 install — process manager
- ✅ Nginx install → reverse proxy (port 3000 → 80/443)
- ✅ Cloudflare Full (strict) SSL — origin cert
- ✅ Firewall: UFW enable, allow 22/80/443 only
- ✅ Git clone → `npm ci` → `npm run build` → PM2 start
- ✅ `public/uploads/` directory permissions
- ✅ PM2 startup: `pm2 startup` + `pm2 save`

### 5. Database Backup → Telegram (VPS မှာ setup လုပ်ရန်)
> ည 12:00 (MMT) တိုင်း MongoDB backup ကို Telegram group သို့ auto ပို့ပေးမယ်
- ✅ VPS မှာ `mongodump` install (mongodb-database-tools deb package)
- ✅ `.env.local` မှာ Telegram credentials ထည့်ပြီး
- ✅ Cron job setup ပြီး (`scripts/setup-backup-cron.sh`)
- ✅ Manual test ပြီး — Telegram group ထဲ backup ဖိုင်ရောက်ပြီး
- ✅ Nightly cron: `30 17 * * *` (UTC) = midnight MMT

### 6. File Storage (✅ Telegram Storage)
> `public/uploads/` ကို local filesystem ထဲ သိမ်းထား → Telegram channel သို့ migrate
- ✅ **`TelegramStorage` class** — `src/lib/storage.ts` (`StorageProvider` interface implement)
- ✅ `STORAGE_PROVIDER=telegram` env var နဲ့ switch လုပ်လို့ရပြီး
- ✅ `resolveStorageUrl()` helper for telegram:// URI resolution
- ✅ URL cache (50min TTL) for Telegram file URLs
- ⚬ ယခင်အတွက် DigitalOcean droplet ပေါ် direct filesystem သုံးနိုင် (PM2 restart ဆို file မပျောက်)

### 7. Security (Production Must-Do)
- ✅ `JWT_SECRET` ကို strong random value ပြောင်းပြီး
- ✅ MongoDB Atlas: IP whitelist → DigitalOcean droplet IP only (VPS IP set)
- ✅ MongoDB user: read/write permission only (admin permission မပေးပါနဲ့)
- ✅ `.env.local` production values git ထဲ push မဝင်ကြောင်း confirm ပြီး (`.gitignore` ပါ)
- ✅ Admin account password ကို strong password ပြောင်းပါ
- ✅ `/api/admin/seed` ကို bootstrap ပြီးတာနဲ့ အပြီးပိတ် (`ENABLE_ADMIN_SEED=false`)
- ✅ Production မှာ Upstash Redis rate-limit ချိတ်ပြီး (`RATE_LIMIT_FAIL_CLOSED=true`)
- ✅ `VPN_SERVER_ALLOWED_HOSTS` allowlist production domain/subdomains set ပြီး
- ⬜ Server egress firewall policy: panel domains/ports သာထွက်နိုင်အောင် စဉ်းစားပါ (optional but recommended)

### 8. Domain & SSL
- ✅ Cloudflare → `burmesedigital.store` DNS → DigitalOcean IP
- ✅ Nginx config: `server_name burmesedigital.store www.burmesedigital.store`
- ✅ HTTPS redirect (Cloudflare "Always Use HTTPS")
- ✅ `next.config.js` images hostname `burmesedigital.store` ပါပြီးသား
- ✅ Cloudflare SSL/TLS mode: **Full (strict)**
- ✅ Origin cert (Cloudflare Origin Cert) တပ်ပြီး end-to-end TLS တည်ဆောက်ပြီး

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
- ✅ CI test job ထည့်ပြီး (`vitest run` in GitHub Actions, build depends on test pass)

### S9 — Incident Runbooks (LOW-MEDIUM)
- ✅ `SECURITY.md` (reporting + support policy)
- ✅ `INCIDENT_RESPONSE.md` (roles, triage, comms)
- ✅ `SECRET_ROTATION.md` (JWT/ADMIN_SECRET/Upstash/S3 credentials rotation)

### S10 — Monitoring & Alerts (LOW-MEDIUM)
- ✅ Alert rules: repeated login failures, reset-password spikes, seed endpoint hits, 503 rate-limit spikes
- ✅ Admin actions monitoring: user promote/demote, server URL changes, export usage

### S11 — Windows Dev Reliability (LOW)
- ✅ Project ကို OneDrive sync folder ပြင်ပသို့ရွှေ့ရန် (Next.js `.next/trace` EPERM issue လျော့)

---

## � Next Features (in order)

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

## � Phase 7 — Code Quality & DX Improvements (2026-02-18)

> Bug fixes, performance improvements, developer experience

### Completed
- ✅ `requireAdmin()` double DB query fix — was 2 DB queries per admin request, now 1 (reuses `getAuthUser()` result)
- ✅ S3Storage `S3Client` created once in constructor instead of per-request
- ✅ `TelegramStorage` class — new storage provider for Telegram-based file storage
- ✅ `resolveStorageUrl()` utility for telegram:// URI resolution with 50min URL cache
- ✅ VPN order Zod validation schema (`createVpnOrderSchema` — validates serverId, planId, devices 1-5, months 1/3/5/7/9/12)
- ✅ Password strength requirements (min 8 chars, uppercase + lowercase + number + special char)
- ✅ Accessibility: Navbar ARIA attributes, keyboard Escape handler, skip-to-content link
- ✅ i18n: Dictionary-based translation files (`src/lib/i18n/en.ts`, `my.ts`)
- ✅ `useLanguage()` now exports `t('nav.home')` dictionary lookup + legacy `tr()` for backward compat
- ✅ Soft-delete: `deletedAt`/`deletedBy` fields on User + Product models with auto-filter query middleware
- ✅ JSON-LD: Organization, WebSite, Product, Breadcrumb structured data for SEO
- ✅ Error reporting: Telegram-based lightweight error reporter (`src/lib/error-reporter.ts`) with dedup + rate limit
- ✅ Zod env validation: `src/lib/env.ts` (server + client env schemas, fail-hard in production)
- ✅ CORS headers: `CORS_ALLOWED_ORIGINS` env var based whitelist + OPTIONS preflight handling
- ✅ CI test job: GitHub Actions `vitest run` before build (build depends on test pass)
- ✅ Navbar notifications bell restored + mobile-friendly notifications shortcut (`/account/notifications`)
- ✅ Admin header notification bell enabled (`/admin`) with admin-order routing
- ✅ Account page mobile header/stats readability improved (compact avatar + responsive typography)
- ✅ Product detail mobile UX polish (`/shop/[id]`: spacing/layout overlap fixes, quantity/total responsive block, payment form mobile-friendly controls)
- ✅ Product detail top summary UX refinement (readable back-link, stock+duration chips, `1Year` style normalization)
- ✅ Order email-verification gate is now env-toggle based (`REQUIRE_EMAIL_VERIFICATION_FOR_ORDERS`, currently set to temporary OFF)

### Remaining TODOs
- ✅ API route integration tests (`__tests__/api-routes.test.ts`)
- ✅ Fraud detection unit tests (`__tests__/fraud-detection.test.ts`)
- ✅ Component/UI tests (React Testing Library) — 6 test files, 47 tests (ProductCard, OrderStatus, PaymentCountdown, Footer, NotificationBell, Navbar)
- ✅ `expireOverdueOrders()` cron endpoint implemented (`/api/cron/expire-orders`, secret-protected)
- ✅ Migrate existing components from `tr()` to `t()` dictionary-based translations (all components migrated, 0 remaining `tr()` calls)
- ✅ Product review/rating system — Review model, API endpoint, ReviewSection component, star ratings on ProductCard
- ✅ Real-time notifications (SSE) — EventSource stream endpoint, `useNotificationStream` hook, auto-reconnect with backoff, `NotificationBell` upgraded from polling to SSE
- ✅ Admin rate limit dashboard — `/admin/rate-limits` page with real-time monitoring, limiter cards, IP tracking table

---

## 🚀 Phase 8 — Performance, Ops & Testing (2026-02-19)

> VPN expiry reminders, admin bulk actions, Web Vitals, DB indexing, E2E tests, Cloudflare R2 CDN

### VPN Expiry Reminders
- ✅ `/api/cron/vpn-expiry-reminders` — cron endpoint (7d, 3d, 1d before expiry)
- ✅ In-app notification + email + Telegram for each reminder
- ✅ `vpnExpiryReminders` field on Order to prevent duplicate sends
- ✅ `sendVpnExpiryReminderEmail()` styled email template with urgency colors
- ✅ `vpn_expiry_reminder` notification type added

### Admin Bulk Actions
- ✅ `POST /api/admin/orders/bulk` — bulk approve/reject orders (max 50)
- ✅ Bulk approve: auto-delivers product keys + provisions VPN keys
- ✅ Bulk reject: shared reject reason + VPN key revocation + quarantine cleanup
- ✅ Admin orders page: checkbox selection + select all + bulk action bar
- ✅ Bulk reject dialog with reason input

### Performance Monitoring (Web Vitals)
- ✅ `src/lib/web-vitals.ts` — batched Web Vitals reporting (sendBeacon)
- ✅ `src/components/WebVitalsReporter.tsx` — client component with `web-vitals` library
- ✅ `POST /api/analytics/vitals` — collect vitals batches (50 cap, MongoDB storage, 90d TTL)
- ✅ `GET /api/analytics/vitals` — aggregated metrics (p50/p75/p95, daily trend, slow pages)
- ✅ `/admin/performance` — admin dashboard with metric cards, percentile bars, slow pages table
- ✅ Integrated into root layout (auto-tracks LCP, FID, CLS, FCP, TTFB, INP)

### Database Indexing Audit
- ✅ Order: `{ orderType, vpnProvisionStatus }` — VPN keys admin page
- ✅ Order: `{ 'vpnPlan.serverId' }` — VPN keys server filter
- ✅ Order: `{ orderType, status, vpnProvisionStatus, 'vpnKey.expiryTime' }` — expiry cron
- ✅ Order: `{ status, paymentExpiresAt }` — expire overdue orders
- ✅ Order: `{ createdAt: -1 }` — analytics aggregations
- ✅ Order: `{ user, totalAmount, createdAt }` — fraud detection
- ✅ User: text index on `{ name, email }` — admin user search
- ✅ User: `{ createdAt: -1 }` — analytics user growth
- ✅ Product: `{ active, price }` — shop price range filter
- ✅ Product: `{ createdAt: -1 }` — sort by newest

### E2E Tests (Playwright)
- ✅ `playwright.config.ts` — Chromium + Mobile Chrome projects
- ✅ `e2e/home.spec.ts` — home page rendering, navbar, footer, navigation links
- ✅ `e2e/auth.spec.ts` — login/register/forgot-password forms, validation, Google button
- ✅ `e2e/shop.spec.ts` — shop page, search, VPN page, cart empty state
- ✅ `e2e/navigation.spec.ts` — static pages, SEO (meta/OG/JSON-LD/robots/sitemap), 404, protected routes, API health, accessibility
- ✅ `npm run test:e2e` / `npm run test:e2e:ui` scripts

### Image CDN (Cloudflare R2)
- ✅ `R2Storage` class in `src/lib/storage.ts` (S3-compatible API)
- ✅ `STORAGE_PROVIDER=r2` env var switch
- ✅ Env vars: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`
- ✅ 1-year immutable cache headers for images
- ✅ `next.config.js` updated for `cdn.burmesedigital.store` + `*.r2.dev` remote patterns

### Production Deployment Setup
- ✅ PM2 cron jobs for expire-orders (every 5 min) + VPN expiry reminders (daily 9 AM)
- ✅ `scripts/cron-runner.sh` — Universal cron endpoint runner with CRON_SECRET auth
- ✅ `ecosystem.config.js` updated with cron job definitions
- ✅ `DEPLOY.md` — Complete production deployment guide (R2 CDN, cron setup, DB index verification, checklist)
- ✅ MongoDB index verification script (38 indexes across 8 models)

---
## 📱 Phase 9 — Telegram Ops & Admin UX (2026-02-19)

> Telegram ကနေ order approve/reject, manual DB backup, admin nav/dashboard UX improvements, CBPay→UAB Pay rename

### Telegram Order Approval (Inline Buttons)
- ✅ `sendOrderWithApproveButtons()` — order notification with ✅ Approve / ❌ Reject inline keyboard buttons
- ✅ `editTelegramMessage()` — update message after action (removes inline keyboard to prevent double-clicks)
- ✅ `answerCallbackQuery()` — dismiss Telegram loading spinner with alert text
- ✅ All 3 order routes (`/api/orders`, `/api/orders/cart`, `/api/vpn/orders`) send approve buttons on order creation
- ✅ Non-blocking: approve button failure doesn't affect order creation

### Telegram Webhook Handler
- ✅ `POST /api/telegram/webhook` — callback query handler for approve/reject buttons
- ✅ Approve flow: Product orders → deliver keys from stock. VPN orders → provision via 3xUI. Release quarantined screenshot. Create user notification. Log activity.
- ✅ Reject flow: Set status to rejected with reason. Create user notification. Log activity. Edit Telegram message.
- ✅ Security: `TELEGRAM_WEBHOOK_SECRET` header verification (`x-telegram-bot-api-secret-token`)
- ✅ Rate limiting: `webhookLimiter` (60 req/min) to prevent brute-force on public endpoint
- ✅ Idempotency: checks `order.status` before processing (skips already completed/rejected)
- ✅ Always returns 200 to Telegram to prevent retries
- ✅ Structured logging with `createLogger`

### Telegram Webhook Setup API
- ✅ `GET /api/admin/telegram-webhook` — check webhook status (URL, errors, pending updates)
- ✅ `POST /api/admin/telegram-webhook` — register webhook with `TELEGRAM_WEBHOOK_SECRET`, only `callback_query` events
- ✅ `DELETE /api/admin/telegram-webhook` — remove webhook
- ✅ Admin-only (requireAdmin), rate-limited

### Manual DB Backup to Telegram
- ✅ `POST /api/admin/backup` — export all MongoDB collections as JSON, send to Telegram channel
- ✅ `sendDocumentToTelegram()` — Telegram Bot sendDocument with FormData/Blob
- ✅ Sensitive field redaction (password, resetToken, tokenVersion) for user collections
- ✅ 50MB Telegram file size limit check
- ✅ Admin settings page: "Database Backup" card with button + result stats (collections, docs, size, duration)
- ✅ Activity log: `database_backup` action type added to `ActivityLog` model
- ✅ Admin-only (requireAdmin), rate-limited

### Admin Settings — Webhook UI
- ✅ "Telegram Webhook" card in admin settings page (blue theme)
- ✅ Auto-loads webhook status on page mount (Active green / Not registered amber)
- ✅ One-click "Register Webhook" / "Update Webhook" button
- ✅ "Remove Webhook" button (red trash icon, shows only when active)
- ✅ Displays last error message, pending update count

### Admin Nav Responsive Redesign
- ✅ Desktop (lg+): all 13 nav items shown inline with labels (7 primary + separator + 6 secondary)
- ✅ Mobile/Tablet (< lg): hamburger menu → slide-out drawer from left with grouped sections ("Main" + "Tools")
- ✅ Large touch targets, backdrop overlay, body scroll lock, outside-click close, route-change auto-close

### Admin Dashboard Resilience
- ✅ `safeFetch()` wrapper — individual fetch failures return null instead of crashing entire dashboard
- ✅ Error state UI with retry button on fetch failure
- ✅ Optional chaining throughout data access

### CBPay → UAB Pay Rename
- ✅ Internal value: `cbpay` → `uabpay`, display: "CB Pay" → "UAB Pay"
- ✅ 17 files updated: types, models, API routes, UI pages, i18n dictionaries, README

### Env & Config Updates
- ✅ `TELEGRAM_WEBHOOK_SECRET` added to `.env.local` + `.env.example`
- ✅ `TELEGRAM_WEBHOOK_SECRET` + `TELEGRAM_CHAT_ID` added to Zod env validation (`src/lib/env.ts`)
- ✅ `webhookLimiter` (60 req/min) added to `rateLimit.ts` + `RATE_LIMIT_CONFIGS`

---
## �📋 Quick Production Deploy Commands (Reference)

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
- Email provider: Resend API ✅ ချိတ်ပြီး
- JWT_SECRET ✅ strong random value သုံးပြီး
- File uploads production မှာ persistent storage (DO Spaces / block storage) စဉ်းစားပါ
- Analytics ✅ recharts သုံးပြီး
- Notifications ✅ in-app (bell icon) + email

---

## 📝 Deployment Log (2026-02-17)

### VPS Server Info
- **Provider:** DigitalOcean
- **IP:** `<VPS_IP>` (see DigitalOcean dashboard)
- **OS:** Ubuntu 24.04.4 LTS
- **RAM:** 1GB + 2GB Swap
- **Domain:** `burmesedigital.store`
- **SSL:** Cloudflare Full (strict) + Origin Cert
- **Node.js:** v20 LTS
- **Process Manager:** PM2 (cluster mode)
- **Reverse Proxy:** Nginx
- **App Path:** `/var/www/burmese-digital-store`

### External Services
| Service | Usage | Plan |
|---------|-------|------|
| MongoDB Atlas | Database | GitHub Student Pack (M0 free) |
| Upstash Redis | Rate limiting | Free tier (10K req/day) |
| Resend | Email (password reset, notifications) | Free/API |
| Cloudflare | DNS + SSL + CDN | Free |
| Telegram Bot | DB backup delivery | Free |

### Cron Jobs
| Schedule | Task | Script |
|----------|------|--------|
| `30 17 * * *` (UTC) = Midnight MMT | MongoDB → Telegram backup | `/var/www/burmese-digital-store/scripts/run-backup.sh` |

### Redeploy Commands (VPS)
```bash
cd /var/www/burmese-digital-store
git pull origin main
npm ci
npm run build
pm2 restart burmese-digital-store
```

### Key Files on VPS
| File | Purpose |
|------|---------|
| `/var/www/burmese-digital-store/.env.local` | Production environment variables (NEVER commit) |
| `/var/log/mongo-backup.log` | Backup script log |
| `/etc/nginx/sites-available/burmesedigital.store` | Nginx reverse proxy config |
| `/var/www/burmese-digital-store/ecosystem.config.js` | PM2 config |

### Issues Encountered & Fixed
1. **Build OOM Kill** — 1GB RAM insufficient for Next.js build → Fixed with 2GB swap (`/swapfile`)
2. **Next.js 15 params type** — `{ params: { id: string } }` → `{ params: Promise<{ id: string }> }` + `await params`
3. **Backup .env.local sourcing** — `source .env.local` fails on values with spaces → Fixed with `sed`-based extraction
4. **CSP nonce not applied** — Middleware set nonce on response only → Fixed: forward via request headers for Next.js auto-apply
5. **503 on all APIs** — `RATE_LIMIT_FAIL_CLOSED` not set + no Upstash Redis → Fixed: added Upstash + `RATE_LIMIT_FAIL_CLOSED=true`
6. **MongoDB connection refused** — Atlas IP whitelist missing VPS IP → Added VPS IP to whitelist
7. **mongodump repo not found** — Ubuntu 24.04 (noble) has no MongoDB 7.0 apt repo → Fixed: direct .deb package install

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
- ✅ Integration test with staging panel (create + verify + delete)
- ✅ E2E: order → approve → provision → user sees key

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
> ⏸️ Deferred for later (2026-02-19): current focus remains web/admin features.

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
