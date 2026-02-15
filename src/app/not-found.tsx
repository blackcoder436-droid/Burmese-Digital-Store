'use client';

import Link from 'next/link';
import { Home, Search, Ghost } from 'lucide-react';
import { useLanguage } from '@/lib/language';
import { useScrollFade } from '@/hooks/useScrollFade';

export default function NotFound() {
  const { tr } = useLanguage();
  useScrollFade();

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="text-center max-w-lg scroll-fade">
        {/* Animated icon */}
        <div className="w-24 h-24 mx-auto mb-6 bg-accent/10 border border-accent/20 rounded-2xl flex items-center justify-center animate-[gentle-glow_3s_ease-in-out_infinite]">
          <Ghost className="w-10 h-10 text-accent" />
        </div>

        {/* Big 404 number */}
        <div className="heading-xl text-accent-gradient mb-2 tracking-tight" style={{ fontSize: 'clamp(4rem, 10vw, 7rem)' }}>
          404
        </div>

        <h1 className="heading-md text-white mb-3">
          {tr('Page Not Found', 'စာမျက်နှာ မတွေ့ပါ')}
        </h1>
        <p className="text-gray-400 mb-8 leading-relaxed">
          {tr(
            "The page you're looking for doesn't exist or has been moved.",
            'သင်ရှာဖွေနေသော စာမျက်နှာ မရှိပါ သို့မဟုတ် ရွှေ့ပြောင်းထားပါသည်။'
          )}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/" className="btn-primary flex items-center gap-2">
            <Home className="w-4 h-4" />
            {tr('Go Home', 'ပင်မစာမျက်နှာ')}
          </Link>
          <Link href="/shop" className="btn-secondary flex items-center gap-2">
            <Search className="w-4 h-4" />
            {tr('Browse Shop', 'ဆိုင်ကြည့်မည်')}
          </Link>
        </div>
      </div>
    </div>
  );
}
