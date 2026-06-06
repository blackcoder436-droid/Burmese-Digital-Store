# Burmese Digital Store Roadmap

Updated: 2026-06-06

ဒီ file ကို project ရဲ့ living todo/roadmap အဖြစ်သုံးပါ။ အလုပ်တစ်ခုစလုပ်ရင် `[ ]` ကနေ `[~]` ပြောင်း၊ ပြီးသွားရင် `[x]` ပြောင်းပါ။

Status legend:
- `[ ]` မစသေး
- `[~]` လုပ်နေဆဲ
- `[x]` ပြီးပြီ
- `[!]` blocker/risk ရှိ

## Current Focus

အခုအရင်ဆုံး focus က VPN multi-server reliability ပါ။ Customer key တစ်ခု date ပြောင်းတဲ့အခါ DB, master sub link, 3x-ui panels အားလုံး တစ်သံတည်းဖြစ်ရမယ်။

Latest note:
- Architecture decision: 3xUI live data is the key source for expiry/devices/data/status. WEB DB is for order/history/index/mapping only.
- May-Zin migrated record DB expiry: `2026-09-05T03:59:59.999Z`.
- Linked SG1 active client က expiry မှန်နေပြီး old SG1 disabled orphan row တစ်ခုကျန်နေတယ်။
- Legacy invalid-email rows တွေအတွက် clients API reject ဖြစ်ရင် safe rename + UUID/password legacy update/delete fallback ထည့်ပြီးပြီ။

## Phase 0 - VPN Stability And Repair

- [x] Manual repair button ထည့်ထား: linked client drift ကို DB values နဲ့ပြင်၊ single orphan candidate ကို safe link လုပ်.
- [x] 3xUI live-source actions ထည့်ထား: WEB edit/disable/delete က live 3xUI clients ကိုပဲ mutate လုပ်ပြီး WEB DB key fields ကို source of truth မလုပ်.
- [x] Cron VPN drift audit ကို read-only ထား: API token နဲ့ 3xUI live state ဖတ်ပြီး drift report ပဲထုတ်၊ WEB DB overwrite/panel auto-repair မလုပ်.
- [x] Multi-server key edit/sync fallback matching ကို sanitized/migration/per-server names တွေအတွက်ပြင်ထား။
- [x] SG1 May-Zin case ကို DB + panel read-only audit လုပ်ပြီး current state မှတ်ထား။
- [x] VPN reconciliation API/report ထည့်ရန်: DB `vpn_keys` vs panel clients expiry/status/subId compare.
- [x] Reconciliation result ကို admin UI မှာပြရန်: OK, drift, missing, orphan/unlinked.
- [ ] Bulk repair action ထည့်ရန်: selected records ကို expiry/devices/data/status resync.
- [x] Orphan cleanup dry-run API/UI ထည့်ထား: delete/disable/update မလုပ်ခင် affected clients list + recommendation ပြရန်.
- [x] Invalid legacy client email handling ပိုခိုင်အောင်လုပ်ရန်: update မရသော old email rows အတွက် safe rename/delete fallback.
- [x] Live Refresh/Reconcile response ကို detailed ဖြစ်အောင်လုပ်ထား: OK, drift, missing, orphan, error ကို server-wise ပြ.
- [ ] Expiry date policy သတ်မှတ်ရန်: admin date picker မှ local day end သုံးမလား UTC midnight သုံးမလား တစ်မျိုးတည်းဖြစ်စေရန်.
- [ ] 3x-ui panel API tests/mock tests ထည့်ရန်: config link resolve fail, sub link stale, name fallback, duplicate prevention.
- [ ] Admin multi-server details modal ထဲမှာ panel drift warning badge ထည့်ရန်.

Recommended order:
1. Reconciliation report API.
2. Admin UI drift table.
3. Manual repair button.
4. Orphan cleanup dry-run.
5. Automated nightly drift audit.

## Phase 1 - Admin Operations Dashboard

- [ ] Server health dashboard ကိုပိုခိုင်အောင်လုပ်ရန်: latency, login/API status, enabled protocols, inbound port mismatch.
- [ ] Server issue alert ထည့်ရန်: Telegram/admin notification when panel down or drift found.
- [ ] VPN server CRUD မှာ validation ပိုတင်းရန်: domain allowlist, panel path, sub port, protocol ports.
- [ ] Rotate/replace server workflow ကို checklist UI နဲ့ပြရန်: backup, restore, DNS, health check, test key.
- [ ] Backup restore drill မှတ်တမ်းထားရန်: last backup time, last restore test time, backup file size.
- [ ] Admin activity logs ကို high-risk actions အတွက်ပိုပြီး detail မှတ်ရန်: VPN repair, deletion, server changes.
- [ ] Admin bulk actions ထည့်ရန်: disable expired, sync selected, export selected, notify customers.
- [ ] Rate-limit monitor page ထည့်ရန်: blocked IPs, route hit counts, fail-closed status.

## Phase 2 - Customer VPN Experience

- [ ] `/account/vpn-keys` ကိုပိုကောင်းအောင်လုပ်ရန်: server status, expiry countdown, traffic used, data limit.
- [ ] QR code per config and master sub link ထည့်ရန်.
- [ ] One-tap import buttons ထည့်ရန်: v2rayN, Clash, NekoBox compatible hints.
- [ ] Renewal/extend flow ထည့်ရန်: existing key ကို date extend လုပ်ပြီး panels sync.
- [ ] VPN expiry reminders ထည့်/စစ်ရန်: 7 days, 3 days, 1 day, expired.
- [ ] Free test anti-abuse ပိုခိုင်အောင်လုပ်ရန်: user/device/IP/payment fingerprint checks.
- [ ] Customer-facing key status checker ထည့်ရန်: token/sub link ဖြင့် status check.
- [ ] Migration page ကို safety ပိုတင်းရန်: old key revoke confirmation, duplicate/orphan detection.

## Phase 3 - Store, Orders, And Payments

- [ ] Order approve flow ကိုပိုမြန်အောင်လုပ်ရန်: checklist, OCR, fraud flags, payment proof preview တစ်နေရာတည်း.
- [ ] Payment method config UI ကိုစစ်ပြီး active/inactive, QR/account copy, limits ထည့်ရန်.
- [ ] Fraud review queue ကိုလုပ်ရန်: duplicate txid/screenshot, suspicious amount, first-time user.
- [ ] Product stock management ကိုပိုခိုင်အောင်လုပ်ရန်: low-stock alert, back-in-stock notification.
- [ ] Digital product delivery audit ထည့်ရန်: delivered key history, who approved, retry delivery.
- [ ] Cart abandoned analytics ထည့်ရန်: cart created but not paid, recovery campaign.
- [ ] Coupon campaign tools ထည့်ရန်: usage cap, first-order only, expiry, per-category.
- [ ] Invoice/receipt PDF ကို customer/admin UI မှ download လုပ်နိုင်အောင်စစ်ရန်.
- [ ] Refund/partial refund workflow ထည့်ရန်.

## Phase 4 - AI Ops, Facebook, And Social Tools

- [ ] AI support assistant knowledge base ကို clean source files နဲ့ပြန်စီရန်.
- [ ] AI chat handoff flow ထည့်ရန်: bot cannot answer -> admin queue.
- [ ] Facebook Messenger bot replies ကို production-safe ဖြစ်အောင်လုပ်ရန်: rate limits, logging, fallback answers.
- [ ] Social post scheduler ကို finish/polish လုပ်ရန်: draft, approve, schedule, publish status.
- [ ] Product/order knowledge sync ထည့်ရန်: AI က current products/prices/promos သိအောင်.
- [ ] Admin AI Ops dashboard မှာ unresolved customer questions list ထည့်ရန်.
- [ ] Auto FAQ generator ထည့်ရန်: repeated support questions -> FAQ suggestions.

## Phase 5 - Security, Quality, And Maintainability

- [ ] Server apt lock/hold policy ထည့်ရန်: unattended `apt` upgrades မလုပ်စေရန်, package holds/deploy window သတ်မှတ်ရန်.
- [ ] Test coverage တိုးရန်: VPN sync, orders, auth, payment, product import.
- [ ] E2E tests တိုးရန်: checkout, admin approve, VPN key create/sync.
- [ ] Error reporting/monitoring setup ထည့်ရန်: production crash, API failure, panel failure alerts.
- [ ] Backup retention policy document/update လုပ်ရန်.
- [ ] Server egress firewall policy document/update လုပ်ရန်.

## Phase 6 - Better Functions To Add

- [ ] Referral/affiliate system: invite code, reward coupon, referral dashboard.
- [ ] Loyalty points: repeat customers အတွက် points/discount.
- [ ] Support ticket chat: order/VPN issue ကို ticket နဲ့ track.
- [ ] Product reviews/ratings: verified buyer only.
- [ ] Subscription/bundle products: VPN + digital products bundle pricing.
- [ ] Notification center: order, VPN, stock, support, promo notifications.
- [ ] Admin command palette: search users/orders/keys quickly.
- [ ] Mobile app plan: Expo/React Native foundation after web/admin reliability is stable.
- [ ] PWA polish: install prompt, offline shell, cached product browsing.
- [ ] Customer self-service repair: regenerate sub link, refresh QR, check status.

## Immediate 7-Day Plan

Day 1:
- [x] VPN reconciliation API/report စလုပ်.
- [x] SG1 missing/stale link samples ကို reconciliation/orphan report ထဲမြင်နိုင်အောင်လုပ်.

Day 2:
- [x] Admin multi-server details page မှာ drift table ထည့်.
- [x] Manual sync/repair button ထည့်.

Day 3:
- [x] Orphan cleanup dry-run API/UI ထည့်.
- [x] Invalid-email legacy client strategy ဆုံးဖြတ်: safe rename first, then UUID/password legacy update/delete fallback.

Day 4:
- [ ] Tests: multi-server sync fallback + duplicate prevention.
- [ ] `npm run test`, `npx tsc --noEmit`, build check.

Day 5:
- [ ] Customer VPN key page polish: expiry countdown, QR, traffic, server list.

Day 6:
- [ ] Admin server health/alert improvements.

Day 7:
- [ ] Deployment checklist + rollback plan.
- [ ] Roadmap update: finished items check off, next sprint choose.

## Decisions Needed

- [ ] Orphan/duplicate VPN clients ကို auto delete လုပ်မလား, admin approve after dry-run လုပ်မလား.
- [x] Expiry date display/update သတ်မှတ်ပြီး: Myanmar local day end (`23:59:59 MMT`) ဖြင့် ပြသ/သတ်မှတ်မည်။ Server-side canonical storage ကို UTC ဖြင့် သိမ်းဆည်းပြီး UI (date picker/display) တွင် MMT အရ ပြသ/ပြောင်းလဲ၍ သိမ်းမည်။
- [ ] Next sprint priority: VPN reliability first, or customer UX first.
- [ ] Payment gateway priority: local manual payments polish, Stripe, crypto, or bank transfer.
- [ ] Mobile app ကိုဘယ်အချိန်စမလဲ: web/admin stable ပြီးမှစတာ recommend.

## Parking Lot

ဒီ ideas တွေကကောင်းပေမယ့် အခုချက်ချင်းမလုပ်သေးသင့်တဲ့ backlog:

- [ ] Full mobile app.
- [ ] Advanced AI sales agent with auto checkout.
- [ ] Multi-language marketing landing pages.
- [ ] Advanced analytics warehouse.
- [ ] Auto server provisioning from cloud providers.
- [ ] Public status page for VPN servers.

## Working Rule

အလုပ်စဉ်တိုင်း:
1. Roadmap item ကို `[~]` ပြောင်း.
2. Small branch/task တစ်ခုအနေနဲ့လုပ်.
3. Test/typecheck/build စစ်.
4. Result ကို roadmap ထဲ `[x]` ပြောင်းပြီး note ထည့်.
5. Deploy မတိုင်ခင် rollback plan ရှိရမယ်.
