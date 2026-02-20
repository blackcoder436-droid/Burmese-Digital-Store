'use client';

// ==========================================
// Shop Error Boundary
// Phase 10.8 — Route segment error handling
// ==========================================

import { useEffect } from 'react';
import { RefreshCw, Home, AlertTriangle, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/lib/language';

export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t, tr } = useLanguage();

  useEffect(() => {
    console.error('Shop error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="text-center max-w-md relative z-10">
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 bg-purple-500/10 rounded-2xl blur-xl animate-pulse" />
          <div className="relative w-full h-full bg-dark-800 border border-purple-500/20 rounded-2xl flex items-center justify-center">
            <ShoppingBag className="w-10 h-10 text-purple-400" />
          </div>
        </div>

        <h1 className="text-xl font-bold text-white mb-2">
          {tr('Shop Loading Error', 'ဆိုင်ဖွင့်ရာတွင် အမှားဖြစ်နေပါတယ်')}
        </h1>
        <p className="text-gray-400 mb-2 text-sm">
          {tr(
            'We couldn\'t load the shop. Please try again.',
            'ဆိုင်ကို ဖွင့်၍မရပါ။ ထပ်ကြိုးစားပါ။'
          )}
        </p>

        {error.digest && (
          <p className="text-xs text-gray-600 mb-4 font-mono">ID: {error.digest}</p>
        )}

        <div className="flex items-center justify-center gap-3">
          <button onClick={reset} className="btn-primary flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" />
            {t('pages.error.tryAgain')}
          </button>
          <Link href="/" className="btn-secondary flex items-center gap-2 text-sm">
            <Home className="w-4 h-4" />
            {t('pages.error.goHome')}
          </Link>
        </div>
      </div>
    </div>
  );
}
