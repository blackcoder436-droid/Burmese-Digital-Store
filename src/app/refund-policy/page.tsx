'use client';

import { useLanguage } from '@/lib/language';
import { useScrollFade } from '@/hooks/useScrollFade';
import { RotateCcw } from 'lucide-react';

export default function RefundPolicyPage() {
  const { tr } = useLanguage();
  const containerRef = useScrollFade();
  
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 pt-24" ref={containerRef}>
      <div className="scroll-fade text-center mb-12">
        <div className="w-16 h-16 mx-auto mb-5 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-center">
          <RotateCcw className="w-8 h-8 text-purple-400" />
        </div>
        <h1 className="heading-lg mb-3">
          {tr('Refund Policy', 'ငွေပြန်အမ်း မူဝါဒ')}
        </h1>
        <p className="text-gray-500 text-sm">
          {tr('Last updated: January 2025', 'နောက်ဆုံးပြင်ဆင်ချိန်: ဇန်နဝါရီ ၂၀၂၅')}
        </p>
      </div>
      
      <div className="space-y-6 text-gray-300 leading-relaxed">
        <section className="scroll-fade game-card p-6" data-delay="100">
          <h2 className="heading-sm mb-3">
            {tr('Digital Product Refunds', 'ဒစ်ဂျစ်တယ် ထုတ်ကုန် ငွေပြန်အမ်းခြင်း')}
          </h2>
          <p>
            {tr(
              'Due to the nature of digital products, all sales are generally final. Once a product key or license has been delivered and revealed, it cannot be returned.',
              'ဒစ်ဂျစ်တယ် ထုတ်ကုန်များ၏ သဘာဝအရ ရောင်းချမှုအားလုံးသည် ယေဘုယျအားဖြင့် နောက်ဆုံးဖြစ်ပါသည်။ ထုတ်ကုန်ကီး သို့မဟုတ် လိုင်စင်ကို ပို့ဆောင်ပြီး ဖော်ပြပြီးသည်နှင့် ပြန်ပေးနိုင်မည် မဟုတ်ပါ။'
            )}
          </p>
        </section>

        <section className="scroll-fade game-card p-6" data-delay="150">
          <h2 className="heading-sm mb-3">
            {tr('Eligible Refund Cases', 'ငွေပြန်အမ်းနိုင်သော ကိစ္စများ')}
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>{tr('Product key is invalid or already used at time of delivery', 'ထုတ်ကုန်ကီးသည် ပို့ဆောင်ချိန်တွင် မမှန်ကန် သို့မဟုတ် အသုံးပြုပြီးဖြစ်နေခြင်း')}</li>
            <li>{tr('Wrong product delivered (different from what was ordered)', 'မှားယွင်းသော ထုတ်ကုန် ပို့ဆောင်ခြင်း (မှာယူသည်နှင့် မတူခြင်း)')}</li>
            <li>{tr('Order was approved but product key was not provided', 'အော်ဒါ အတည်ပြုပြီးသော်လည်း ထုတ်ကုန်ကီး မပေးခြင်း')}</li>
            <li>{tr('Duplicate charge for the same product', 'တူညီသော ထုတ်ကုန်အတွက် ထပ်ခါတလဲလဲ ကောက်ခံခြင်း')}</li>
          </ul>
        </section>

        <section className="scroll-fade game-card p-6" data-delay="200">
          <h2 className="heading-sm mb-3">
            {tr('Refund Process', 'ငွေပြန်အမ်း လုပ်ငန်းစဉ်')}
          </h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>{tr('Contact us through the Contact page with your order details', 'သင့်အော်ဒါ အသေးစိတ်နှင့်အတူ ဆက်သွယ်ရန် စာမျက်နှာမှတဆင့် ဆက်သွယ်ပါ')}</li>
            <li>{tr('Provide proof of the issue (screenshots, error messages)', 'ပြဿနာ၏ အထောက်အထား (ဖန်သားပြင်ဓာတ်ပုံ၊ အမှားသတင်းစကား) ပေးပါ')}</li>
            <li>{tr('Our team will review within 24-48 hours', 'ကျွန်ုပ်တို့၏ အဖွဲ့သည် ၂၄-၄၈ နာရီအတွင်း စစ်ဆေးပါမည်')}</li>
            <li>{tr('If approved, refund will be processed to original payment method', 'အတည်ပြုပါက မူရင်း ငွေပေးချေမှု နည်းလမ်းသို့ ငွေပြန်အမ်းပါမည်')}</li>
          </ol>
        </section>

        <section className="scroll-fade game-card p-6" data-delay="250">
          <h2 className="heading-sm mb-3">
            {tr('Non-Refundable Cases', 'ငွေပြန်မအမ်းနိုင်သော ကိစ္စများ')}
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>{tr('Change of mind after product key has been revealed', 'ထုတ်ကုန်ကီး ဖော်ပြပြီးနောက် စိတ်ပြောင်းခြင်း')}</li>
            <li>{tr('Failure to meet system requirements for software products', 'ဆော့ဖ်ဝဲ ထုတ်ကုန်များအတွက် စနစ် လိုအပ်ချက်များ မပြည့်မီခြင်း')}</li>
            <li>{tr('Account-related issues on third-party platforms', 'ပြင်ပ ပလက်ဖောင်းများတွင် အကောင့်ဆိုင်ရာ ပြဿနာများ')}</li>
          </ul>
        </section>

        <section className="scroll-fade game-card p-6" data-delay="300">
          <h2 className="heading-sm mb-3">
            {tr('Refund Timeline', 'ငွေပြန်အမ်း အချိန်ဇယား')}
          </h2>
          <p>
            {tr(
              'Approved refunds are typically processed within 3-5 business days. The actual time for the refund to appear in your account may vary depending on your payment provider.',
              'အတည်ပြုထားသော ငွေပြန်အမ်းမှုများကို ပုံမှန်အားဖြင့် လုပ်ငန်းရက် ၃-၅ ရက်အတွင်း လုပ်ဆောင်ပါသည်။'
            )}
          </p>
        </section>

      </div>
    </div>
  );
}
