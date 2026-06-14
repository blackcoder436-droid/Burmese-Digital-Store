# Burmese Digital Store Roadmap

Updated: 2026-06-13

ဒီ file ကို project ရဲ့ living todo/roadmap အဖြစ်သုံးပါ။ အလုပ်တစ်ခုစလုပ်ရင် `[ ]` ကနေ `[~]` ပြောင်း၊ ပြီးသွားရင် `[x]` ပြောင်းပါ။

Status legend:
- `[ ]` မစသေး
- `[~]` လုပ်နေဆဲ
- `[x]` ပြီးပြီ
- `[!]` blocker/risk ရှိ

---

## Project Overview

**Burmese Digital Store** is a full-stack Next.js 15 e-commerce platform selling digital products (VPN, streaming, gaming credits, software, gift cards) in Myanmar. It features OCR-based payment verification, multi-server 3x-UI VPN provisioning, admin dashboard, Telegram bot integration, AI chat support, and fraud detection.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 App Router, React 18, Tailwind CSS (dark cyberpunk theme) |
| Backend | Next.js API Routes |
| Database | MongoDB + Mongoose |
| Auth | JWT (HttpOnly cookies) |
| OCR | Tesseract.js |
| Rate Limiting | Upstash Redis |
| Storage | Local / S3 / Telegram |
| VPN Control | 3x-UI Panel API |
| Bot | Telegram Bot (order notifications + user-facing VPN bot) |
| AI | GitHub Models API (GPT-4.1) |
| Testing | Vitest + Playwright |
| CI/Quality | Husky + lint-staged + ESLint |

### Project Structure (src/)

```
src/
├── app/                    # Next.js App Router pages + API routes
│   ├── page.tsx            # Home with hero, categories, how-it-works
│   ├── layout.tsx          # Root layout + fonts + PWA + JSON-LD
│   ├── shop/               # Product browsing
│   ├── vpn/                # VPN plans page + order flow
│   ├── account/            # User dashboard: orders, vpn-keys, support, wishlist, subs
│   ├── admin/              # Full admin panel: 13+ sections
│   ├── api/                # 20+ API route groups
│   └── cart/ checkout/ contact/ domains/ login/ register/ migrate/ etc.
├── components/             # Reusable UI (15+ components)
├── lib/                    # Core: auth, mongodb, xui, vpn-sync, ocr, rate-limit, security, etc.
├── models/                 # 20+ Mongoose schemas (User, Order, Product, VpnServer, etc.)
├── types/                  # TypeScript interfaces
├── hooks/                  # Custom hooks
├── modules/                # Feature modules (ai-ops/)
└── middleware.ts           # Route protection + security headers
```

### Key Architecture Decisions

1. **VPN: 3xUI live data is the source of truth** for expiry/devices/data/status. WEB DB stores order/history/index/mapping only.
2. **Expiry policy**: Myanmar local day end (`23:59:59 MMT`) for display/picking. UTC for canonical storage.
3. **Multi-server VPN keys**: single customer token aggregates sub-links from multiple 3xUI panels into one subscription endpoint.
4. **Payment verification**: OCR-based with manual review fallback. Auto-approve for verified payments.
5. **Security-first**: rate limiting, CSP nonces, input validation, SSRF hardening (VPN_SERVER_ALLOWED_HOSTS).

---

## Phase 0 - VPN Stability & Reliability [≈90% complete]

- [x] Manual repair button: linked client drift fix, safe orphan linking
- [x] 3xUI live-source actions: WEB edit/disable/delete mutates live panel, not DB
- [x] Cron VPN drift audit: read-only, report only, no auto-repair
- [x] Multi-server key edit/sync fallback matching
- [x] VPN reconciliation API + report: DB vpn_keys vs panel clients compare
- [x] Reconciliation UI in admin: OK, drift, missing, orphan status
- [x] Bulk repair action: selected records resync expiry/devices/data/status
- [x] Orphan cleanup dry-run API/UI: shows impact before action
- [x] Invalid legacy client email handling: safe rename → UUID/password fallback
- [x] Live Refresh/Reconcile detailed response: per-server OK/drift/missing/orphan/error
- [x] Expiry date policy: MMT day-end settled
- [x] Admin multi-server details modal with panel drift warning badge
- [ ] **3x-UI panel API tests/mock tests**: config link resolve fail, sub link stale, name fallback, duplicate prevention (partially done, needs more coverage)
- [ ] **Nightly automated drift audit cron**: Telegram/email report on schedule
- [ ] **Reconciliation pagination**: handle 500+ keys without timeout
- [ ] **Sub-link health monitoring**: proactive detection of stale/404 sub links across servers

---

## Phase 1 - Admin Operations Dashboard [≈40% complete]

- [x] Basic admin dashboard with orders, users, products, servers pages
- [x] VPN keys management UI (multi-server view)
- [x] Order approval/rejection workflow with OCR preview
- [x] Admin activity logging (20+ action types)
- [ ] **Server health dashboard**: latency, login/API status, enabled protocols, inbound port mismatch
- [ ] **Server issue alert system**: Telegram/admin notification when panel down or drift found
- [ ] **VPN server CRUD validation**: domain allowlist, panel path validation, sub port ranges, protocol port constraints
- [ ] **Rotate/replace server workflow** with checklist UI: backup → restore → DNS → health check → test key
- [ ] **Backup restore drill tracking**: last backup time, last restore test time, backup file size
- [ ] **Admin activity log enrichment**: high-risk actions (VPN repair, deletion, server changes) get extra detail
- [ ] **Admin bulk actions**: disable expired, sync selected, export selected, notify customers
- [ ] **Rate-limit monitor page**: blocked IPs, route hit counts, fail-closed status
- [ ] **Admin notification center UI**: in-app bell with order alerts, system messages, drift warnings
- [ ] **Audit trail export**: CSV/JSON export of activity logs with filters

---

## Phase 2 - Customer VPN Experience [≈30% complete]

- [x] VPN order flow: server selection, protocol choice, payment upload
- [x] Multi-server subscription: single token aggregates all server configs
- [x] VPN status API: live traffic stats from 3xUI, expiry countdown
- [x] `/account/vpn-keys` page: basic list of provisioned keys
- [ ] **VPN key page polish**: expiry countdown (live), traffic used/data limit graph, server status indicators (online/offline/latency)
- [ ] **QR code per config + master sub link**: scan-to-import
- [ ] **One-tap import buttons**: v2rayN, Clash Meta, NekoBox, Sing-box hints
- [ ] **Renewal/extend flow**: extend existing key date, auto-sync to panels
- [ ] **VPN expiry reminders**: 7d/3d/1d/expired notifications (Telegram + in-app)
- [ ] **Free trial anti-abuse**: phone/device/IP/payment fingerprint + rate limits
- [ ] **Customer-facing key status checker**: public page by token or sub link
- [ ] **Migration page safety**: old key revoke confirmation, duplicate/orphan detection
- [ ] **Protocol change on existing key**: e.g. trojan → vless without re-ordering
- [ ] **Server change on existing key**: migrate to different server with data preserved

---

## Phase 3 - Store, Orders & Payments [≈50% complete]

- [x] Product CRUD with categories, stock, details, images
- [x] Order creation with payment screenshot upload + OCR
- [x] Order approve/reject flow with Telegram notification
- [x] Fraud detection: duplicate txid, screenshot hash, first-time user, amount threshold
- [x] Coupon system: percentage/fixed, usage caps, per-user limits, categories
- [x] Payment gateway config model + API
- [x] Cart system with MongoDB persistence
- [x] Order history in account dashboard
- [ ] **Order approve flow unification**: checklist (OCR/fraud/amount/time), preview, approve/reject — all in one panel
- [ ] **Payment method config UI**: active/inactive toggle, QR upload, account copy, per-method limits
- [ ] **Fraud review queue**: dedicated admin page with flagged orders, severity sort, quick actions
- [ ] **Product stock management**: low-stock alert, back-in-stock notification for customers
- [ ] **Digital product delivery audit**: delivered key history, who approved, retry delivery button
- [ ] **Cart abandoned analytics**: cart created but not paid → recovery campaign (email/Telegram)
- [ ] **Coupon campaign tools**: usage cap per campaign, first-order-only, expiry date, per-category
- [ ] **Invoice/receipt PDF**: downloadable from customer + admin UI
- [ ] **Refund/partial refund workflow**: order status → refund, stock restore, notification
- [ ] **Auto-reject stale payments**: cron for orders stuck in `verifying` beyond payment window
- [ ] **Bulk order export**: CSV/JSON by date range, status, payment method

---

## Phase 4 - AI Ops, Facebook & Social Tools [≈25% complete]

- [x] AI chat widget (customer-facing) with GitHub Models API
- [x] AI chat session management in MongoDB
- [x] Basic AI ops module (`src/modules/ai-ops/`)
- [ ] **AI support knowledge base**: clean source files → structured KB for accurate answers
- [ ] **AI chat handoff flow**: bot cannot answer → admin queue with conversation history
- [ ] **Facebook Messenger bot**: production-safe replies with rate limits, logging, fallback
- [ ] **Social post scheduler**: draft → approve → schedule → publish status tracking
- [ ] **Product/order knowledge sync**: AI knows current products, prices, promos
- [ ] **Admin AI Ops dashboard**: unresolved customer questions list, answer quality metrics
- [ ] **Auto FAQ generator**: repeated support questions → FAQ suggestions
- [ ] **Telegram bot polish**: inline keyboards, order status queries, key regeneration
- [ ] **Multi-language AI responses**: detect user language, respond in Myanmar/English

---

## Phase 5 - Security, Quality & Maintainability [≈40% complete]

- [x] Rate limiting on all API endpoints (Upstash Redis + in-memory fallback)
- [x] JWT in HttpOnly cookies, bcrypt (12 rounds) for passwords
- [x] Input validation (Zod schemas for env, sanitization utilities)
- [x] CSP with nonces via middleware
- [x] SSRF hardening with VPN_SERVER_ALLOWED_HOSTS
- [x] Screenshot validation: type, size, path traversal protection
- [x] QR code + PDF generation utilities
- [x] ESLint + Husky + lint-staged pre-commit checks
- [x] Basic test suite (Vitest) + E2E (Playwright)
- [x] Error reporting setup with Telegram channel
- [ ] **Server apt lock/hold policy**: prevent unattended upgrades, deployment window
- [ ] **Test coverage expansion**: VPN sync, orders, auth, payment, product import — target 60%+ coverage
- [ ] **E2E tests expansion**: checkout flow, admin approve, VPN key create/sync
- [ ] **Backup retention policy**: document + auto-cleanup old backups
- [ ] **Server egress firewall policy**: document + audit rules
- [ ] **Secrets rotation**: auto-rotate 3xUI API keys, JWT secret, Telegram tokens
- [ ] **Dependency audit**: automated `npm audit` + critical fix pipeline
- [ ] **Load testing**: VPN sub endpoint, order creation, product listing under concurrent users
- [ ] **TypeScript strictness**: reduce `any` usage, fully type API responses

---

## Phase 6 - Feature Expansion

- [ ] **Referral/affiliate system**: invite code, reward coupon, referral dashboard
- [ ] **Loyalty points**: repeat customers → points → discount
- [ ] **Support ticket system**: order/VPN issue tracking per customer
- [ ] **Product reviews/ratings**: verified buyer only, helpful votes
- [ ] **Subscription/bundle products**: VPN + streaming bundle pricing
- [ ] **Notification center**: unified in-app notifications (order, VPN, stock, support, promo)
- [ ] **Admin command palette**: Ctrl+K search for users/orders/keys
- [ ] **Mobile app (Expo/React Native)**: after web/admin reliability is stable
- [ ] **PWA polish**: install prompt UX, offline shell, cached product catalog
- [ ] **Customer self-service repair**: regenerate sub link, refresh QR, check status without admin
- [ ] **VPS marketplace**: VPS plans, provisioning, SSH key management
- [ ] **Domain registration**: domain search, WHOIS lookup, DNS management
- [ ] **WhatsApp integration**: order notifications + customer support channel
- [ ] **Payment gateway expansion**: Stripe, PayPal, crypto (USDT)

---

## Immediate 14-Day Sprint Plan

### Week 1: VPN Reliability & Admin Tools (Days 1-7)

| Day | Focus | Tasks |
|-----|-------|-------|
| **1** | Reconciliation & Monitoring | ✓ Nightly drift audit cron ✓ Sub-link health check ✓ Reconciliation pagination |
| **2** | Server Health Dashboard | ✓ Latency/status panel ✓ Enabled protocol view ✓ Port mismatch detection ✓ Drift alerts |
| **3** | VPN Key UI Polish | ✓ Expiry countdown (live) ✓ Traffic usage graph ✓ Server status indicators ✓ QR code generation |
| **4** | 3xUI Tests | ✓ Config link resolve fail ✓ Sub link stale ✓ Name fallback ✓ Duplicate prevention ✓ Panel mock tests |
| **5** | Customer VPN Experience | ✓ Renewal/extend flow ✓ Free trial anti-abuse ✓ Key status checker (public) |
| **6** | Admin Bulk Actions | ✓ Disable expired ✓ Sync selected ✓ Export selected ✓ Notify customers |
| **7** | Admin Notification Center | ✓ In-app bell ✓ Drift warnings ✓ Order alerts ✓ System messages |

### Week 2: Store & Payment Ops (Days 8-14)

| Day | Focus | Tasks |
|-----|-------|-------|
| **8** | Order Approve Flow | ✓ Unified approve panel (checklist + OCR + fraud + preview) ✓ Payment method config UI |
| **9** | Fraud Review Queue | ✓ Admin fraud page ✓ Severity sort ✓ Quick actions ✓ Duplicate detection dashboard |
| **10** | Stock & Delivery | ✓ Low-stock alerts ✓ Back-in-stock notification ✓ Delivery audit log ✓ Retry delivery |
| **11** | Cart & Coupon Tools | ✓ Cart abandoned analytics ✓ Recovery campaign ✓ Coupon campaign management ✓ Usage reports |
| **12** | PDF & Refunds | ✓ Invoice/receipt PDF generation ✓ Refund workflow ✓ Auto-reject stale payments ✓ Bulk export |
| **13** | AI & Telegram Polish | ✓ AI knowledge base cleanup ✓ Chat handoff to admin ✓ Telegram bot inline keyboards ✓ FAQ generator |
| **14** | Security & Testing | ✓ Test coverage expansion ✓ E2E checkout VPN test ✓ Backup retention policy ✓ Secrets rotation |

---

## Decisions Made

| Decision | Resolution |
|----------|-----------|
| Orphan/duplicate VPN clients auto-delete? | **No** — admin approve after dry-run report |
| Expiry date display policy | **Myanmar local day end** (`23:59:59 MMT`) for UI, UTC for storage |
| VPN source of truth | **3xUI live panel data**, WEB DB is index/mapping only |
| Payment auto-approve | **Yes** — OCR match confidence > 60% + amount verification, configurable delay |
| AI model | **GitHub Models (GPT-4.1)** — cheaper than OpenAI direct, good Myanmar language support |

## Decisions Pending

| Question | Options | Status |
|----------|---------|--------|
| Next sprint priority | VPN reliability vs Customer UX | Pending |
| Payment gateway priority | Local manual payments polish → Stripe → Crypto → Bank | Pending |
| Mobile app timing | After web/admin stable | Tentative |
| AI chat enabled by default? | Toggle in env, currently off by default | Needs product decision |
| Telegram bot: single vs split | Currently two bots (notification + VPN sales). Merge or keep separate? | Needs review |

## Parking Lot (Backlog — Good Ideas, Not Now)

- [ ] Full mobile app (Expo/React Native)
- [ ] Advanced AI sales agent with auto-checkout
- [ ] Multi-language marketing landing pages (JP, KR, TH)
- [ ] Advanced analytics warehouse (product performance, user cohorts, LTV)
- [ ] Auto server provisioning from cloud providers (Vultr, DigitalOcean, Hetzner)
- [ ] Public VPN server status page (uptime, load, maintenance)
- [ ] White-label/reseller platform
- [ ] Cryptocurrency payment gateway (USDT TRC-20, Bitcoin)
- [ ] One-click WooCommerce/Magento migration tool

---

## Working Rules

1. **Roadmap-first**: update `[ ]` → `[~]` → `[x]` before/after every task
2. **Branch per item**: small, focused branches per roadmap item
3. **Quality gate**: `npm run test` + `npx tsc --noEmit` + `npm run build` must pass
4. **Deploy check**: rollback plan must exist before deployment
5. **Changelog**: every completed item gets a one-line summary in commit message
6. **No auto-delete of VPN clients**: always admin-approve after dry-run
7. **No hardcoded secrets**: `.env.local` for all sensitive values, validated via `src/lib/env.ts`
8. **Fail-closed rate limiting**: default in production — disable only with explicit env flag
