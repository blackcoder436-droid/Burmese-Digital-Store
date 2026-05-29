# Burmese Digital Store Facebook AI Page Bot Setup

ဒီ project ထဲမှာ Facebook Page Messenger ကို website AI chat နဲ့ချိတ်နိုင်တဲ့ webhook endpoint ပြင်ပြီးပါပြီ။

## တကယ်လုပ်လို့ရလား

ရပါတယ်။ ဒါပေမယ့် Facebook Page မှာ AI ကို တကယ့် Page Admin role ပေးတာမဟုတ်ပါ။ Meta Messenger Platform webhook က customer message ကို သင့် server ဆီပို့ပြီး၊ server က AI reply ကို Meta Send API နဲ့ Page inbox ထဲကနေပြန်ပို့တာပါ။

အရေးကြီးတဲ့ ကန့်သတ်ချက်တွေ:

- Customer က Page ကို message အရင်ပို့မှ reply ပြန်လို့ရပါတယ်။ Cold message/spam လုပ်လို့မရပါ။
- Standard reply window က customer နောက်ဆုံး message ပို့ပြီး 24 နာရီအတွင်း free-form reply ဖြစ်ပါတယ်။
- Real customers အားလုံးအတွက်သုံးမယ်ဆို Meta App Review/permission approval လိုလာနိုင်ပါတယ်။
- Payment slip, order approval, refund, VPN key delivery တို့ကို AI က auto approve မလုပ်သင့်ပါ။ ဒီ setup မှာ slip image ရလာရင် admin manual verify လုပ်ဖို့ပဲ ပြန်ပြောထားပါတယ်။

Official docs:

- Messenger Platform: https://developers.facebook.com/docs/messenger-platform
- Messenger Send API collection by Meta: https://www.postman.com/meta/documentation/22794852-408702ca-c162-4ab3-97ac-56c1d585cc0a
- Meta Webhooks: https://developers.facebook.com/docs/graph-api/webhooks

## ပြင်ပြီးသား endpoint

Callback URL:

```text
https://burmesedigital.store/api/facebook/webhook
```

Local/dev URL:

```text
http://localhost:3000/api/facebook/webhook
```

Dev URL ကို Meta ကတိုက်ရိုက်မမြင်နိုင်လို့ local test လုပ်မယ်ဆို HTTPS tunnel လိုပါတယ်။ Production domain မှာပဲ setup လုပ်တာအလွယ်ဆုံးပါ။

## လိုအပ်တာတွေ

- Burmese Digital Store Facebook Page full control/admin access
- Meta Developer account
- Meta App တစ်ခု
- Messenger product enabled
- Page ID
- Page Access Token
- App Secret
- Verify Token
- Live HTTPS domain: `https://burmesedigital.store`
- ဒီ Next.js app production deploy ဖြစ်နေဖို့
- MongoDB working ဖြစ်နေဖို့
- `AI_API_KEY`, `AI_MODEL`, `AI_API_URL`, `AI_CHAT_ENABLED=true`

## Environment variables

`.env.local` သို့ production server env ထဲမှာထည့်ပါ။

```env
FACEBOOK_MESSENGER_ENABLED=true
FACEBOOK_PAGE_ID=your_page_id
FACEBOOK_PAGE_ACCESS_TOKEN=your_page_access_token
FACEBOOK_VERIFY_TOKEN=generate_a_long_random_string
FACEBOOK_APP_SECRET=your_meta_app_secret
FACEBOOK_GRAPH_API_VERSION=v25.0
FACEBOOK_REQUIRE_SIGNATURE=true
```

Verify token generate:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Meta dashboard setup

1. https://developers.facebook.com/apps မှာ App create လုပ်ပါ။
2. App ထဲမှာ Messenger product ထည့်ပါ။
3. Page ကို app နဲ့ connect လုပ်ပြီး Page Access Token ယူပါ။
4. Webhooks/Callback URL ထဲမှာ ဒီ URL ထည့်ပါ။

```text
https://burmesedigital.store/api/facebook/webhook
```

5. Verify Token နေရာမှာ `.env` ထဲက `FACEBOOK_VERIFY_TOKEN` နဲ့တူအောင်ထည့်ပါ။
6. Webhook fields အနေနဲ့ `messages` ကို subscribe လုပ်ပါ။ Quick replies/postbacks သုံးမယ်ဆို `messaging_postbacks` ကိုပါထည့်ပါ။
7. Page subscription လုပ်ပါ။
8. App development mode မှာ Page admin/tester account နဲ့စမ်းပါ။
9. Real customers အတွက် live သုံးမယ်ဆို `pages_messaging` permission ကို App Review တင်ပါ။

## Bot behavior

- Text message တွေကို existing website AI knowledge base, FAQ, prompt injection protection နဲ့ reply ပြန်ပါတယ်။
- Price/contact/plan မေးခွန်းတွေက AI API မခေါ်ဘဲ instant FAQ reply ပြန်နိုင်ပါတယ်။
- Image/file attachment ရလာရင် payment slip manual verification message ပြန်ပါတယ်။
- Reply length ကြီးသွားရင် Messenger အတွက် short chunks ခွဲပို့ပါတယ်။
- Conversation history ကို `AiChatSession` ထဲမှာ `facebook:{pageId}:{senderId}` session ID နဲ့သိမ်းပါတယ်။

## Test checklist

- Production deploy ပြီး env variables ထည့်ထားပြီးသားဖြစ်ရပါမယ်။
- Meta webhook verify button နှိပ်ရင် success ဖြစ်ရပါမယ်။
- Page ကို personal account တစ်ခုက message ပို့ပါ။
- Server logs မှာ webhook request ရောက်ရပါမယ်။
- Messenger ထဲမှာ AI reply ပြန်ရပါမယ်။
- Payment slip image ပို့စမ်းပြီး auto approve မလုပ်ဘဲ manual verify reply ပဲပြန်တာစစ်ပါ။
