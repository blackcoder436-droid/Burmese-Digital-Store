'use client';

import { useLanguage } from '@/lib/language';
import { useScrollFade } from '@/hooks/useScrollFade';
import { FileText } from 'lucide-react';

export default function TermsPage() {
  const { tr } = useLanguage();
  const containerRef = useScrollFade();
  
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 pt-24" ref={containerRef}>
      <div className="scroll-fade text-center mb-12">
        <div className="w-16 h-16 mx-auto mb-5 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-center">
          <FileText className="w-8 h-8 text-purple-400" />
        </div>
        <h1 className="heading-lg mb-3">
          {tr('Terms of Service', 'ဝန်ဆောင်မှု စည်းမျဥ်းများ')}
        </h1>
        <p className="text-gray-500 text-sm">
          {tr('Last updated: January 2025', 'နောက်ဆုံးပြင်ဆင်ချိန်: ဇန်နဝါရီ ၂၀၂၅')}
        </p>
      </div>
      
      <div className="space-y-6 text-gray-300 leading-relaxed">
        <section className="scroll-fade game-card p-6" data-delay="100">
          <h2 className="heading-sm mb-3">
            {tr('1. Acceptance of Terms', '၁။ စည်းမျဥ်းများ လက်ခံခြင်း')}
          </h2>
          <p>
            {tr(
              'By accessing and using Burmese Digital Store, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.',
              'Burmese Digital Store ကို ဝင်ရောက်အသုံးပြုခြင်းဖြင့် ဤဝန်ဆောင်မှု စည်းမျဥ်းများကို လိုက်နာရန် သဘောတူပါသည်။ ဤစည်းမျဥ်းများကို သဘောမတူပါက ကျွန်ုပ်တို့၏ ဝန်ဆောင်မှုများကို အသုံးမပြုပါနှင့်။'
            )}
          </p>
        </section>

        <section className="scroll-fade game-card p-6" data-delay="150">
          <h2 className="heading-sm mb-3">
            {tr('2. Digital Products', '၂။ ဒစ်ဂျစ်တယ် ထုတ်ကုန်များ')}
          </h2>
          <p>
            {tr(
              'All products sold on our platform are digital goods including software licenses, game keys, and VPN subscriptions. Digital products are delivered electronically after payment verification.',
              'ကျွန်ုပ်တို့၏ ပလက်ဖောင်းတွင် ရောင်းချသော ထုတ်ကုန်အားလုံးသည် ဆော့ဖ်ဝဲ လိုင်စင်များ၊ ဂိမ်းကီးများနှင့် VPN စာရင်းသွင်းမှုများ အပါအဝင် ဒစ်ဂျစ်တယ် ကုန်ပစ္စည်းများဖြစ်ပါသည်။'
            )}
          </p>
        </section>

        <section className="scroll-fade game-card p-6" data-delay="200">
          <h2 className="heading-sm mb-3">
            {tr('3. Payments', '၃။ ငွေပေးချေမှု')}
          </h2>
          <p>
            {tr(
              'We accept payments through approved payment methods. All transactions are verified before product delivery. Payment screenshots must be clear and unaltered.',
              'ကျွန်ုပ်တို့သည် အတည်ပြုထားသော ငွေပေးချေမှုနည်းလမ်းများမှတစ်ဆင့် ငွေပေးချေမှုများကို လက်ခံပါသည်။ ငွေပေးချေမှု ဖန်သားပြင်ဓာတ်ပုံများသည် ရှင်းလင်းပြီး ပြုပြင်ထားခြင်း မရှိရပါ။'
            )}
          </p>
        </section>

        <section className="scroll-fade game-card p-6" data-delay="250">
          <h2 className="heading-sm mb-3">
            {tr('4. Account Responsibility', '၄။ အကောင့် တာဝန်ယူမှု')}
          </h2>
          <p>
            {tr(
              'You are responsible for maintaining the security of your account. Do not share your login credentials with others. We are not liable for unauthorized access due to your negligence.',
              'သင့်အကောင့်၏ လုံခြုံရေးကို ထိန်းသိမ်းရန် သင့်တွင် တာဝန်ရှိပါသည်။ သင့်ဝင်ရောက်ရန် အထောက်အထားများကို အခြားသူများနှင့် မမျှဝေပါနှင့်။'
            )}
          </p>
        </section>

        <section className="scroll-fade game-card p-6" data-delay="300">
          <h2 className="heading-sm mb-3">
            {tr('5. Prohibited Activities', '၅။ တားမြစ်ထားသော လုပ်ဆောင်ချက်များ')}
          </h2>
          <p>
            {tr(
              'Users must not attempt to exploit, hack, or abuse our platform. Fraudulent payment claims, unauthorized reselling of products, and any illegal activities are strictly prohibited.',
              'အသုံးပြုသူများသည် ကျွန်ုပ်တို့၏ ပလက်ဖောင်းကို အမြတ်ထုတ်ရန်၊ ဟက်ခ်ရန် သို့မဟုတ် အလွဲသုံးစားပြုရန် ကြိုးပမ်းခြင်း မပြုရပါ။'
            )}
          </p>
        </section>

        <section className="scroll-fade game-card p-6" data-delay="350">
          <h2 className="heading-sm mb-3">
            {tr('6. Changes to Terms', '၆။ စည်းမျဥ်းများ ပြောင်းလဲခြင်း')}
          </h2>
          <p>
            {tr(
              'We reserve the right to modify these terms at any time. Continued use of the platform after changes constitutes acceptance of the updated terms.',
              'ဤစည်းမျဥ်းများကို အချိန်မရွေး ပြင်ဆင်ရန် ကျွန်ုပ်တို့တွင် အခွင့်အရေးရှိပါသည်။'
            )}
          </p>
        </section>

      </div>
    </div>
  );
}
