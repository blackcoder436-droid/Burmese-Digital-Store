'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle,
  Clock3,
  CreditCard,
  Cpu,
  Globe,
  HardDrive,
  MapPin,
  MemoryStick,
  Server,
  Upload,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/language';
import { useScrollFade } from '@/hooks/useScrollFade';
import { useCart } from '@/lib/cart';
import { vpsPlans, type VpsPlan } from '@/lib/vps-plans';

const flowSteps = [
  {
    icon: CreditCard,
    enTitle: 'Choose Plan',
    myTitle: 'Plan ရွေးချယ်ရန်',
    enDesc: 'Pick a plan and continue to checkout.',
    myDesc: 'Plan ကိုရွေးချယ်ပြီး checkout ဆက်ပါ။',
  },
  {
    icon: Upload,
    enTitle: 'Upload Payment',
    myTitle: 'Payment Screenshot တင်ပါ',
    enDesc: 'Pay and upload screenshot for verification.',
    myDesc: 'ငွေပေးပြီး screenshot ကို verification အတွက်တင်ပါ။',
  },
  {
    icon: Clock3,
    enTitle: 'Auto Verification',
    myTitle: 'Auto Verification',
    enDesc: 'Order is reviewed quickly and queued for deployment.',
    myDesc: 'Order ကိုမြန်မြန်စစ်ဆေးပြီး deployment queue ထဲသို့ ထည့်ပေးပါတယ်။',
  },
  {
    icon: CheckCircle,
    enTitle: 'Receive Credentials',
    myTitle: 'Credential ရယူရန်',
    enDesc: 'Get IP, username, password, and basic setup guide instantly.',
    myDesc: 'IP, username, password နှင့် basic setup guide ကိုချက်ချင်းရယူနိုင်ပါတယ်။',
  },
];

const faqItems: { enQ: string; myQ: string; enA: string; myA: string }[] = [
  {
    enQ: 'How fast is VPS delivery after payment?',
    myQ: 'ငွေပေးချေပြီး VPS ဘယ်လောက်မြန်မြန်ရမလဲ?',
    enA: 'After payment verification, VPS credentials are usually delivered within 5 to 20 minutes.',
    myA: 'ငွေပေးချေမှုစစ်ဆေးပြီးချိန်ကနေ VPS account credentials ကို ပုံမှန်အားဖြင့် 5 မိနစ်မှ 20 မိနစ်အတွင်းပေးပို့ပေးပါတယ်။',
  },
  {
    enQ: 'Can I choose location and operating system?',
    myQ: 'Location နဲ့ OS ကို ကိုယ့်တိုင်ရွေးလို့ရလား?',
    enA: 'Yes. You can request preferred region and OS during checkout, and we will provision based on availability.',
    myA: 'ရပါတယ်။ Checkout အချိန်မှာ region နဲ့ OS ကိုရွေးချယ်နိုင်ပြီး available ဖြစ်မှုအလိုက် provision လုပ်ပေးပါတယ်။',
  },
  {
    enQ: 'Do you provide setup support?',
    myQ: 'Setup support ပေးလား?',
    enA: 'Yes. Basic setup guidance is included, and managed setup can be added as an optional service.',
    myA: 'ပေးပါတယ်။ Basic setup guideline ပါဝင်ပြီး managed setup ကို optional service အနေနဲ့ ထပ်ဖြည့်နိုင်ပါတယ်။',
  },
  {
    enQ: 'What payment methods are available?',
    myQ: 'Payment method ဘာတွေသုံးလို့ရလဲ?',
    enA: 'KBZ Pay, WavePay, AYA Pay, and UAB Pay are supported. Upload payment screenshot to complete order.',
    myA: 'KBZ Pay, WavePay, AYA Pay, UAB Pay တို့နဲ့ပေးချေနိုင်ပါတယ်။ Order ပြီးစီးရန် payment screenshot တင်ပေးရပါမယ်။',
  },
];

function formatMMK(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

export default function VpsPage() {
  const { tr } = useLanguage();
  const containerRef = useScrollFade();
  const router = useRouter();
  const { addItem } = useCart();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [addingPlan, setAddingPlan] = useState<string | null>(null);

  async function findProductForVpsPlan(plan: VpsPlan) {
    // Try to find exact product by slug/ID first
    try {
      const byIdRes = await fetch(`/api/products/${encodeURIComponent(plan.id)}`);
      if (byIdRes.ok) {
        const data = await byIdRes.json();
        if (data.success && data.data?.product) {
          console.log('Found VPS product by ID/slug:', plan.id);
          return data.data.product;
        }
      }
    } catch (err) {
      console.error('Error looking up VPS product by ID/slug:', err);
    }

    // Try search by name
    try {
      const searchRes = await fetch(`/api/products?search=${encodeURIComponent(plan.name)}`);
      if (searchRes.ok) {
        const data = await searchRes.json();
        if (data.success && Array.isArray(data.data?.products) && data.data.products.length > 0) {
          console.log('Found VPS product by name:', plan.name);
          return data.data.products[0];
        }
      }
    } catch (err) {
      console.error('Error looking up VPS product by name:', err);
    }

    // Fallback: create a virtual product object so users can add to cart
    // This supports manual-fulfillment VPS flows even when DB entries are absent
    console.warn('No VPS product found in DB; returning virtual product for plan:', plan.id);
    return {
      _id: plan.id,
      name: plan.name,
      slug: plan.id,
      price: plan.price,
      category: 'vps',
      image: '/images/vps-default.png',
      description: `${plan.os} Ubuntu VPS Instance`,
      stock: 999,
      purchaseDisabled: false,
      details: [],
      active: true,
    } as any;
  }

  async function handleStartPlan(plan: VpsPlan) {
    setAddingPlan(plan.id);
    try {
      const product = await findProductForVpsPlan(plan);
      
      if (!product || !product._id) {
        toast.error(tr('Could not process this plan. Please try again.', 'ဤ plan ကို လုပ်ဆောင်၍မရပါ။ ထပ်ကြိုးစားပါ။'));
        setAddingPlan(null);
        return;
      }

      if (product.purchaseDisabled) {
        toast.error(tr('This plan is not available for purchase right now.', 'ဤ plan ကို ယခု ဝယ်ယူ၍ မရနိုင်ပါ။'));
        setAddingPlan(null);
        return;
      }

      const effectiveStock = Math.max(0, Number(product.stock) || 0);
      
      if (effectiveStock <= 0) {
        toast.error(tr('This plan is currently out of stock. Please try another plan.', 'ဤ plan သည် ဈိုက်အားမရှိသေးပါ။ အခြား plan တစ်ခုကို ကြိုးစားပါ။'));
        setAddingPlan(null);
        return;
      }

      addItem(
        {
          productId: product._id as string,
          slug: product.slug || plan.id,
          name: product.name,
          price: product.price,
          stock: effectiveStock,
          category: product.category || 'vps',
          image: product.image,
        },
        1
      );
      
      toast.success(tr('Added to cart. Continue to checkout.', 'ကာတ်ထဲသို့ ထည့်ပြီး checkout ဆက်ပါ။'));
      router.push('/cart');
    } catch (err) {
      console.error('Error adding VPS plan to cart:', err);
      toast.error(tr('Unable to add plan to cart. Please try again.', 'ကာတ်ထဲထည့်၍ မရပါ။ ထပ်ကြိုးစားပါ။'));
    } finally {
      setAddingPlan(null);
    }
  }

  return (
    <div className="min-h-screen pt-10 sm:pt-14 pb-12" ref={containerRef}>
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 space-y-10 sm:space-y-14">
        <section className="scroll-fade game-card p-6 sm:p-10 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-cyan-500/10 pointer-events-none" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-xs font-semibold text-purple-300 mb-4">
              <Server className="w-4 h-4" />
              {tr('VPS Store', 'VPS Store')}
            </div>

            <h1 className="heading-lg mb-3">
              {tr('Cloud VPS — Ubuntu Instances', 'Cloud VPS — Ubuntu Instances')}
            </h1>
            <p className="text-gray-400 max-w-3xl leading-relaxed">
              {tr(
                'Fast, reliable VPS powered by DigitalOcean infrastructure. Deploy globally, pay with local wallets, and receive credentials quickly after payment verification.',
                'DigitalOcean infrastructure ကိုအသုံးပြုထားတဲ့ မြန်ဆန်ပြီးယုံကြည်စိတ်ချရတဲ့ VPS service ဖြစ်ပါတယ်။ Global location တွေမှာ deploy လုပ်နိုင်ပြီး local wallet များနဲ့ပေးချေနိုင်ကာ verification ပြီးတာနဲ့ credentials ကိုမြန်မြန်ရရှိနိုင်ပါတယ်။'
              )}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-xs sm:text-sm text-gray-300">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-900/60 border border-dark-600/60">
                <MapPin className="w-4 h-4 text-purple-400" />
                {tr('Locations', 'Locations')}: Singapore, US
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-900/60 border border-dark-600/60">
                <Globe className="w-4 h-4 text-cyan-400" />
                {tr('Region-Optimized for Asia & North America', 'Asia & North America အတွက် optimized')}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-900/60 border border-dark-600/60">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                {tr('Pay with local wallets; instant verification', 'Local wallets နဲ့ပေးချေနိုင်ပြီး instant verification')}
              </span>
            </div>
          </div>
        </section>

        <section id="plans" className="scroll-fade">
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 className="heading-md">{tr('VPS Plans', 'VPS Plan များ')}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {tr('Choose a package and continue to checkout flow below.', 'Package ရွေးပြီး အောက်က checkout flow အတိုင်း ဆက်သွားနိုင်ပါတယ်။')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {vpsPlans.map((plan) => (
              <article
                key={plan.id}
                className={`game-card p-6 relative overflow-hidden ${plan.highlight ? 'border-purple-500/60 shadow-glow-sm' : ''}`}
              >
                {plan.highlight && (
                  <div className="absolute top-3 right-3 text-[10px] px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 font-semibold">
                    {tr('Most Popular', 'အများဆုံးရွေးချယ်ထားသော Plan')}
                  </div>
                )}

                <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
                <p className="text-gray-400 mt-1 mb-5">{plan.os}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                  {plan.specs.map((spec) => (
                    <div key={spec.label} className="rounded-xl border border-dark-600/70 bg-dark-900/60 px-3 py-2.5">
                      <p className="text-[11px] uppercase tracking-wide text-gray-500">{spec.label}</p>
                      <p className="text-sm font-semibold text-gray-200 mt-0.5 inline-flex items-center gap-2">
                        {spec.label === 'CPU' && <Cpu className="w-4 h-4 text-purple-400" />}
                        {spec.label === 'RAM' && <MemoryStick className="w-4 h-4 text-cyan-400" />}
                        {spec.label === 'Storage' && <HardDrive className="w-4 h-4 text-amber-400" />}
                        {spec.label !== 'CPU' && spec.label !== 'RAM' && spec.label !== 'Storage' && (
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                        )}
                        {spec.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="pt-5 border-t border-dark-600/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <p className="text-4xl font-black text-white tracking-tight">
                    {formatMMK(plan.price)} <span className="text-xl text-gray-400 font-semibold">MMK</span>
                    <span className="text-base font-medium text-gray-500"> / {tr('month', 'လစဉ်')}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => handleStartPlan(plan)}
                    disabled={addingPlan === plan.id}
                    className="btn-electric inline-flex items-center gap-2"
                  >
                    {addingPlan === plan.id ? tr('Adding...', 'ထည့်နေသည်...') : tr('Get Started', 'စတင်ဝယ်ယူရန်')} <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="checkout" className="scroll-fade game-card p-6 sm:p-8">
          <div className="mb-5">
            <h2 className="heading-md">{tr('Checkout Flow', 'Checkout Flow')}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {tr(
                'A clear, low-friction purchase flow to turn plan views into paid VPS orders.',
                'Plan ကြည့်ထားသူတွေကို အလွယ်တကူ paid VPS order အဖြစ်ပြောင်းနိုင်ဖို့ ရိုးရှင်းတဲ့ flow ဖြစ်ပါတယ်။'
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {flowSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.enTitle} className="rounded-2xl border border-dark-600/70 bg-dark-900/60 p-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5" />
                  </div>
                  <p className="text-xs text-gray-500 mb-1">0{index + 1}</p>
                  <h3 className="text-base font-semibold text-white">{tr(step.enTitle, step.myTitle)}</h3>
                  <p className="text-sm text-gray-400 mt-1 leading-relaxed">{tr(step.enDesc, step.myDesc)}</p>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white">{tr('Ready to launch your VPS?', 'VPS စတင်အသုံးပြုဖို့ အဆင်သင့်ဖြစ်ပြီလား?')}</h3>
              <p className="text-sm text-gray-300 mt-1">
                {tr('Use Shop checkout for payment screenshot flow, then we provision your VPS.', 'Shop checkout flow ကနေ screenshot တင်ပြီးပေးချေပါ။ ပြီးတာနဲ့ VPS ကို provision လုပ်ပေးပါမယ်။')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/shop" className="btn-primary">
                {tr('Go to Shop Checkout', 'Shop Checkout သို့သွားရန်')} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/contact" className="btn-secondary">
                {tr('Need Custom Plan?', 'Custom Plan လိုလား?')}
              </Link>
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-fade">
          <div className="mb-5">
            <h2 className="heading-md">{tr('VPS FAQ', 'VPS FAQ')}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {tr('Common questions from first-time VPS buyers.', 'VPS ပထမဆုံးဝယ်ယူသူများ မကြာခဏမေးလေ့ရှိသည့် မေးခွန်းများ။')}
            </p>
          </div>

          <div className="space-y-3">
            {faqItems.map((item, index) => {
              const isOpen = openFaq === index;
              return (
                <article key={item.enQ} className="game-card overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full text-left px-5 py-4 flex items-center justify-between gap-3"
                    aria-expanded={isOpen}
                  >
                    <span className="text-sm sm:text-base font-semibold text-white">{tr(item.enQ, item.myQ)}</span>
                    <span className="text-purple-300 text-lg">{isOpen ? '-' : '+'}</span>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-sm text-gray-400 leading-relaxed border-t border-dark-600/60">
                      <p className="pt-3">{tr(item.enA, item.myA)}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
