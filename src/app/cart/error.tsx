'use client';

// ==========================================
// Cart Error Boundary
// Phase 10.8 — Route segment error handling
// ==========================================

import { useEffect } from 'react';
import { RefreshCw, ShoppingCart, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/lib/language';

export default function CartError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { tr, t } = useLanguage();

  useEffect(() => {
    console.error('Cart error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="text-center max-w-md relative z-10">
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 bg-amber-500/10 rounded-2xl blur-xl animate-pulse" />
          <div className="relative w-full h-full bg-dark-800 border border-amber-500/20 rounded-2xl flex items-center justify-center">
            <ShoppingCart className="w-10 h-10 text-amber-400" />
          </div>
        </div>

        <h1 className="text-xl font-bold text-white mb-2">
          {tr('Cart Error', 'စျေးခြင်းတောင်း အမှားဖြစ်နေပါတယ်')}
        </h1>
        <p className="text-gray-400 mb-2 text-sm">
          {tr(
            'Something went wrong with your cart. Your items are safe — try refreshing.',
            'စျေးခြင်းတောင်းမှာ အမှားဖြစ်သွားပါတယ်။ ပစ္စည်းတွေ ပျောက်မသွားပါ — ပြန်ဖွင့်ကြည့်ပါ။'
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
          <Link href="/shop" className="btn-secondary flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" />
            {tr('Back to Shop', 'ဆိုင်သို့ပြန်သွားမယ်')}
          </Link>
        </div>
      </div>
    </div>
  );
}
