'use client';

import { useLanguage } from '@/lib/language';
import { useScrollFade } from '@/hooks/useScrollFade';
import { Shield } from 'lucide-react';

export default function PrivacyPage() {
  const { tr } = useLanguage();
  const containerRef = useScrollFade();
  
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 pt-24" ref={containerRef}>
      <div className="scroll-fade text-center mb-12">
        <div className="w-16 h-16 mx-auto mb-5 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-center">
          <Shield className="w-8 h-8 text-purple-400" />
        </div>
        <h1 className="heading-lg mb-3">
          {tr('Privacy Policy', 'ကိုယ်ရေးအချက်အလက် မူဝါဒ')}
        </h1>
        <p className="text-gray-500 text-sm">
          {tr('Last updated: January 2025', 'နောက်ဆုံးပြင်ဆင်ချိန်: ဇန်နဝါရီ ၂၀၂၅')}
        </p>
      </div>
      
      <div className="space-y-6 text-gray-300 leading-relaxed">
        <section className="scroll-fade game-card p-6" data-delay="100">
          <h2 className="heading-sm mb-3">
            {tr('Information We Collect', 'ကျွန်ုပ်တို့ စုဆောင်းသော အချက်အလက်များ')}
          </h2>
          <p>
            {tr(
              'We collect information you provide during registration including your name, email address, and phone number. We also collect order history and payment verification data.',
              'မှတ်ပုံတင်ချိန်တွင် သင်ပေးသော အချက်အလက်များဖြစ်သည့် အမည်၊ အီးမေးလ်လိပ်စာနှင့် ဖုန်းနံပါတ်တို့ကို ကျွန်ုပ်တို့ စုဆောင်းပါသည်။'
            )}
          </p>
        </section>

        <section className="scroll-fade game-card p-6" data-delay="150">
          <h2 className="heading-sm mb-3">
            {tr('How We Use Your Data', 'သင့်ဒေတာကို ကျွန်ုပ်တို့ အသုံးပြုပုံ')}
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>{tr('Process and deliver your orders', 'သင့်အော်ဒါများကို လုပ်ဆောင်ပြီး ပို့ဆောင်ရန်')}</li>
            <li>{tr('Verify payment transactions', 'ငွေပေးချေမှု အရောင်းအဝယ်များကို အတည်ပြုရန်')}</li>
            <li>{tr('Send order status notifications via email', 'အီးမေးလ်မှတဆင့် အော်ဒါအခြေအနေ အကြောင်းကြားရန်')}</li>
            <li>{tr('Improve our services and user experience', 'ကျွန်ုပ်တို့၏ ဝန်ဆောင်မှုများနှင့် အသုံးပြုသူ အတွေ့အကြုံကို တိုးတက်စေရန်')}</li>
          </ul>
        </section>

        <section className="scroll-fade game-card p-6" data-delay="200">
          <h2 className="heading-sm mb-3">
            {tr('Data Security', 'ဒေတာ လုံခြုံရေး')}
          </h2>
          <p>
            {tr(
              'We implement industry-standard security measures to protect your data. Passwords are encrypted using bcrypt hashing. Authentication tokens are signed with secure keys.',
              'သင့်ဒေတာကို ကာကွယ်ရန် စက်မှုလုပ်ငန်း စံနှုန်း လုံခြုံရေး အစီအမံများကို ကျွန်ုပ်တို့ အကောင်အထည်ဖော်ပါသည်။'
            )}
          </p>
        </section>

        <section className="scroll-fade game-card p-6" data-delay="250">
          <h2 className="heading-sm mb-3">
            {tr('Data Retention', 'ဒေတာ ထိန်းသိမ်းမှု')}
          </h2>
          <p>
            {tr(
              'We retain your account data as long as your account is active. Order records are kept for service and support purposes. You may request account deletion by contacting us.',
              'သင့်အကောင့် အသက်ဝင်နေသရွေ့ သင့်အကောင့်ဒေတာကို ကျွန်ုပ်တို့ ထိန်းသိမ်းထားပါမည်။'
            )}
          </p>
        </section>

        <section className="scroll-fade game-card p-6" data-delay="300">
          <h2 className="heading-sm mb-3">
            {tr('Cookies', 'ကွတ်ကီးများ')}
          </h2>
          <p>
            {tr(
              'We use essential cookies for authentication and session management. No third-party tracking cookies are used.',
              'အထောက်အထားစိစစ်ခြင်းနှင့် စက်ရှင်စီမံခန့်ခွဲမှုအတွက် မရှိမဖြစ်လိုအပ်သော ကွတ်ကီးများကို ကျွန်ုပ်တို့ အသုံးပြုပါသည်။'
            )}
          </p>
        </section>

        <section className="scroll-fade game-card p-6" data-delay="350">
          <h2 className="heading-sm mb-3">
            {tr('Contact', 'ဆက်သွယ်ရန်')}
          </h2>
          <p>
            {tr(
              'For privacy-related inquiries, please visit our Contact page or email us directly.',
              'ကိုယ်ရေးအချက်အလက်ဆိုင်ရာ မေးမြန်းချက်များအတွက် ကျွန်ုပ်တို့၏ ဆက်သွယ်ရန် စာမျက်နှာသို့ ဝင်ရောက်ပါ။'
            )}
          </p>
        </section>

      </div>
    </div>
  );
}
