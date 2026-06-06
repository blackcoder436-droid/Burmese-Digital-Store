# Add 3x‑UI panel API tests and mocks

## အကျဉ်းချုပ်
3x‑UI panel နှင့် ဆက်သွယ်မှုများအတွက် tests နှင့် API mocks များထည့်၍ panel failures, stale sub links, name fallbacks, duplicate prevention စတာများကို မှန်ကန်စေသည်။

## Test Cases
- config link resolve fail
- sub link stale (panel vs DB mismatch)
- name fallback when panel name missing
- duplicate subId prevention
- per-server error handling and partial success

## Implement
- Add unit tests mocking panel responses
- Add integration tests hitting a local mock server
- CI pipeline သို့ test step ထည့်

## Acceptance
- Tests cover listed cases
- CI fails on regressions

## Labels
area/vpn, type/test, priority/medium
