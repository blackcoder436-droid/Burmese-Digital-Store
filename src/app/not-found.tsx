'use client';

import Link from 'next/link';
import { Home, Search, Ghost } from 'lucide-react';
import { useLanguage } from '@/lib/language';

export default function NotFound() {
  const { tr } = useLanguage();

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[200px] h-[200px] bg-cyan-500/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="text-center max-w-lg relative z-10 animate-[fadeInUp_0.6s_ease-out_both]">
        {/* Animated ghost icon with floating effect */}
        <div className="relative w-28 h-28 mx-auto mb-8">
          <div className="absolute inset-0 bg-purple-500/10 rounded-2xl blur-xl animate-pulse" />
          <div className="relative w-full h-full bg-[#12122a] border border-purple-500/20 rounded-2xl flex items-center justify-center animate-[float_3s_ease-in-out_infinite]">
            <Ghost className="w-12 h-12 text-purple-400" />
          </div>
        </div>

        {/* Big 404 number with glitch-like effect */}
        <div className="relative mb-4">
          <div className="heading-xl text-accent-gradient tracking-tight select-none" style={{ fontSize: 'clamp(5rem, 12vw, 8rem)', lineHeight: 1 }}>
            404
          </div>
          <div className="absolute inset-0 heading-xl text-purple-500/10 tracking-tight select-none blur-sm" style={{ fontSize: 'clamp(5rem, 12vw, 8rem)', lineHeight: 1 }}>
            404
          </div>
        </div>

        <h1 className="heading-md text-white mb-3">
          {tr('Page Not Found', 'စာမျက်နှာ မတွေ့ပါ')}
        </h1>
        <p className="text-gray-400 mb-8 leading-relaxed max-w-sm mx-auto">
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

      {/* Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
