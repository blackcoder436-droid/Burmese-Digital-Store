'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import MobileCarousel from '@/components/MobileCarousel';
import {
  ArrowRight,
  CheckCircle,
  ShoppingBag,
  CreditCard,
  Zap,
  Key,
  Shield,
  Monitor,
  Gamepad2,
  Gift,
  Layers,
  Box,
  Sparkles,
} from 'lucide-react';
import { useLanguage } from '@/lib/language';
import { useScrollFade } from '@/hooks/useScrollFade';

const howItWorksSteps = [
  {
    icon: ShoppingBag,
    titleEn: 'Choose Product',
    titleMy: 'ပစ္စည်းရွေးချယ်ရန်',
    descEn: 'Browse our catalog of VPNs, streaming, gaming, and more.',
    descMy: 'VPN, streaming, gaming နှင့် အခြားပစ္စည်းများကို ရွေးချယ်ပါ။',
    step: '01',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: CreditCard,
    titleEn: 'Make Payment',
    titleMy: 'ငွေပေးချေပါ',
    descEn: 'Pay via KBZ Pay, WaveMoney, UAB Pay, or AYA Pay.',
    descMy: 'KBZ Pay, WaveMoney, UAB Pay သို့မဟုတ် AYA Pay ဖြင့်ပေးချေပါ။',
    step: '02',
    color: 'from-violet-500 to-purple-500',
  },
  {
    icon: Zap,
    titleEn: 'Auto Verification',
    titleMy: 'အလိုအလျောက်စစ်ဆေးမှု',
    descEn: 'Our system verifies your payment screenshot instantly.',
    descMy: 'သင့်ငွေပေးချေမှု screenshot ကို စနစ်ကချက်ချင်းစစ်ဆေးပါသည်။',
    step: '03',
    color: 'from-amber-500 to-orange-500',
  },
  {
    icon: Key,
    titleEn: 'Get Your Keys',
    titleMy: 'သင့် Key များရယူပါ',
    descEn: 'Receive your account details or serial keys right away.',
    descMy: 'အကောင့်အချက်အလက် သို့မဟုတ် serial key များကိုချက်ချင်းရယူပါ။',
    step: '04',
    color: 'from-emerald-500 to-green-500',
  },
];

function StepCard({ feature, index, language }: { feature: typeof howItWorksSteps[0]; index: number; language: 'en' | 'my' }) {
  const Icon = feature.icon;
  return (
    <div className="scroll-fade game-card p-6 group relative overflow-hidden card-shimmer snap-center" data-delay={`${150 * index}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-[0.07] transition-opacity duration-500`} />
      <div className={`absolute top-0 left-0 w-0 group-hover:w-full h-[2px] bg-gradient-to-r ${feature.color} transition-all duration-500 ease-out`} />
      <div className="absolute top-4 right-4 text-5xl font-black text-dark-700 group-hover:text-dark-600/80 transition-colors duration-500">
        {feature.step}
      </div>
      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-500`}>
        <Icon className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-lg font-bold text-white mb-2 relative group-hover:text-purple-200 transition-colors duration-300">
        {language === 'en' ? feature.titleEn : feature.titleMy}
      </h3>
      <p className="text-sm text-gray-400 leading-relaxed relative">{language === 'en' ? feature.descEn : feature.descMy}</p>
    </div>
  );
}

function HowItWorksCarousel({ language }: { language: 'en' | 'my' }) {
  return (
    <>
      {/* Mobile: carousel */}
      <MobileCarousel className="sm:hidden -mx-4 px-4">
        {howItWorksSteps.map((feature, index) => (
          <StepCard key={feature.step} feature={feature} index={index} language={language} />
        ))}
      </MobileCarousel>

      {/* Desktop: grid */}
      <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {howItWorksSteps.map((feature, index) => (
          <StepCard key={feature.step} feature={feature} index={index} language={language} />
        ))}
      </div>
    </>
  );
}

export default function HomePage() {
  const { t, lang: language } = useLanguage();
  const containerRef = useScrollFade();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => { if (d.success) setLoggedIn(true); })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen" ref={containerRef}>
      {/* Hero */}
      <section className="relative pt-10 sm:pt-14 lg:pt-16 pb-20 sm:pb-28 lg:pb-36 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-mesh pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-radial from-purple-500/10 via-transparent to-transparent pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Badge */}
            <div className="scroll-fade inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-full animate-glow-pulse">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-semibold text-purple-300">
                {t('homePage.trustedStoreInMyanmar')}
              </span>
            </div>

            {/* Main Heading */}
            <h1 className="scroll-fade heading-xl !leading-[1.3] sm:!leading-[1.26] lg:!leading-[1.22] tracking-normal" data-delay="100">
              {t('homePage.premiumDigitalProducts')}
            </h1>

            <p className="scroll-fade text-xl text-gray-400 max-w-2xl mx-auto leading-[1.8] sm:leading-[1.7]" data-delay="200">
              {t('homePage.heroDescription')}
            </p>

            {/* CTA Buttons */}
            <div className="scroll-fade flex flex-col sm:flex-row items-center justify-center gap-4 pt-4" data-delay="300">
              <Link href="/shop" className="btn-electric group">
                <ShoppingBag className="w-5 h-5" />
                {t('homePage.browseShop')}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/vpn" className="btn-secondary">
                <Shield className="w-5 h-5" />
                {t('homePage.vpnPlans')}
              </Link>
            </div>

            {/* Trust Indicators */}
            <div className="scroll-fade flex flex-wrap items-center justify-center gap-x-8 gap-y-3 pt-6" data-delay="400">
              {[
                t('homePage.deliveryInSeconds'),
                t('homePage.autoVerifiedPayments'),
                t('homePage.secureTrusted'),
                t('homePage.support24x7')
              ].map(
                (item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-gray-400">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <span>{item}</span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-14 sm:py-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="scroll-fade text-center mb-16">
            <h2 className="heading-lg">{t('homePage.howItWorksTitle')}</h2>
            <p className="text-gray-400 mt-4 max-w-xl mx-auto">
              {t('homePage.howItWorksSubtitle')}
            </p>
          </div>

          <HowItWorksCarousel language={language} />
        </div>
      </section>

      <section className="py-20 sm:py-28 bg-dark-900/50 border-y border-dark-600/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="scroll-fade text-center mb-16">
            <h2 className="heading-lg">{t('homePage.productCategoriesTitle')}</h2>
            <p className="text-gray-400 mt-4 max-w-xl mx-auto">
              {t('homePage.productCategoriesSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { name: 'VPN', icon: Shield, label: 'Premium', href: '/shop?category=vpn', color: 'emerald', gradient: 'from-emerald-500 to-green-500' },
              { name: t('homePage.category.streamingName'), icon: Monitor, label: t('homePage.category.streamingLabel'), href: '/shop?category=streaming', color: 'violet', gradient: 'from-violet-500 to-purple-500' },
              { name: t('homePage.category.gamingName'), icon: Gamepad2, label: t('homePage.category.gamingLabel'), href: '/shop?category=gaming', color: 'rose', gradient: 'from-rose-500 to-pink-500' },
              { name: t('homePage.category.softwareName'), icon: Layers, label: t('homePage.category.softwareLabel'), href: '/shop?category=software', color: 'sky', gradient: 'from-sky-500 to-blue-500' },
              { name: t('homePage.category.giftCardsName'), icon: Gift, label: t('homePage.category.giftCardsLabel'), href: '/shop?category=gift-card', color: 'amber', gradient: 'from-amber-500 to-orange-500' },
              { name: t('homePage.category.moreName'), icon: Box, label: t('homePage.category.moreLabel'), href: '/shop', color: 'gray', gradient: 'from-gray-500 to-slate-500' },
            ].map((cat, catIdx) => {
              const Icon = cat.icon;
              const colorClasses: Record<string, string> = {
                emerald: 'group-hover:bg-emerald-500/10 group-hover:border-emerald-500/30 group-hover:text-emerald-400',
                violet: 'group-hover:bg-violet-500/10 group-hover:border-violet-500/30 group-hover:text-violet-400',
                rose: 'group-hover:bg-rose-500/10 group-hover:border-rose-500/30 group-hover:text-rose-400',
                sky: 'group-hover:bg-sky-500/10 group-hover:border-sky-500/30 group-hover:text-sky-400',
                amber: 'group-hover:bg-amber-500/10 group-hover:border-amber-500/30 group-hover:text-amber-400',
                gray: 'group-hover:bg-gray-500/10 group-hover:border-gray-500/30 group-hover:text-gray-400',
              };
              const iconColorClasses: Record<string, string> = {
                emerald: 'group-hover:text-emerald-400',
                violet: 'group-hover:text-violet-400',
                rose: 'group-hover:text-rose-400',
                sky: 'group-hover:text-sky-400',
                amber: 'group-hover:text-amber-400',
                gray: 'group-hover:text-gray-400',
              };
              return (
                <Link
                  key={cat.name}
                  href={cat.href}
                  className={`scroll-fade group p-6 text-center bg-dark-800 border border-dark-600/50 rounded-2xl transition-all duration-500 hover:-translate-y-2 hover:shadow-lg card-shimmer relative overflow-hidden ${colorClasses[cat.color]}`}
                  data-delay={`${catIdx * 80}`}
                >
                  {/* Hover gradient overlay */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${cat.gradient} opacity-0 group-hover:opacity-[0.06] transition-opacity duration-500`} />
                  {/* Bottom accent line */}
                  <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-0 group-hover:w-2/3 h-[2px] bg-gradient-to-r ${cat.gradient} transition-all duration-500 rounded-full`} />
                  
                  <div className={`w-14 h-14 mx-auto mb-4 bg-dark-700 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 relative`}>
                    <Icon className={`w-7 h-7 text-gray-400 transition-colors duration-300 ${iconColorClasses[cat.color]}`} />
                  </div>
                  <h3 className="text-base font-bold text-white relative">{cat.name}</h3>
                  <p className="text-xs text-gray-500 mt-1 relative">{cat.label}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA — only for guests */}
      {!loggedIn && (
        <section className="py-20 sm:py-28 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-cyan-600/10 to-cyan-500/10 pointer-events-none" />
          
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
            <div className="scroll-fade-scale scroll-fade glass-panel p-10 sm:p-16 glow-border relative overflow-hidden">
              {/* Animated background sparkles */}
              <div className="absolute top-6 left-10 w-2 h-2 bg-purple-400/30 rounded-full animate-float" />
              <div className="absolute top-12 right-16 w-1.5 h-1.5 bg-cyan-400/30 rounded-full animate-float" style={{ animationDelay: '1s' }} />
              <div className="absolute bottom-10 left-1/4 w-1 h-1 bg-purple-400/20 rounded-full animate-float" style={{ animationDelay: '2s' }} />
              
              <h2 className="heading-lg mb-4 relative">
                {t('homePage.readyToStartTitle')}
              </h2>
              <p className="text-gray-400 mb-8 max-w-lg mx-auto relative">
                {t('homePage.readyToStartSubtitle')}
              </p>
              <Link href="/register" className="btn-electric group relative">
                {t('homePage.createFreeAccount')}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
