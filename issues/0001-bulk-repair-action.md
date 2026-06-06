# Bulk repair action — VPN key reconcile and resync

## အကျဉ်းချုပ်
Admin UI မှတစ်ဆင့် select လုပ်ထားသော VPN keys များကို 3x-UI panel မှာရှိသမျှ live state အရ expiry / devices / data / status များကို resync ပြုလုပ်ပေးနိုင်ရန် Bulk Repair action ကို implement လုပ်ရန်။

## လိုအပ်ချက်များ
- Admin ကို multiple records bulk-select လုပ်စိတ်ချရသော UI
- Dry-run mode: မပြောင်းခင်ကိုယ်တိုင်ပြသ၍ conflict တွေ/changes အားပြရန်
- Confirm modal နှင့် permission checks
- Per-record, per-server sync logic (retry, fallback)
- Audit log / who performed repairs
- Tests: unit + integration covering edge cases

## API နမူနာ
`POST /admin/vpn/bulk-repair` {
  "keys": ["subId-1", "subId-2", ...],
  "dryRun": true
}

## Acceptance Criteria
- Admin သည် bulk-select → Dry-run ပြပြီး result တွေကို ကြည့်ရတတ်ရမည်
- Confirm မလုပ်မီ ဘာတွေပြောင်းမလဲ ပြသရမည်
- Confirm ပြီးပါက per-key resync လုပ်ပြီး audit log ထည့်ရမည်
- Failures အတွက် retry/backoff ပါရမည်

## Labels
- area/vpn, priority/high, type/feature

## Estimate
2-3 days