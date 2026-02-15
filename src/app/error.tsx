'use client';

import { useEffect } from 'react';
import { RefreshCw, Home, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/lib/language';
import { useScrollFade } from '@/hooks/useScrollFade';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { tr } = useLanguage();
  useScrollFade();

  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="text-center max-w-lg scroll-fade">
        {/* Animated warning icon */}
        <div className="w-24 h-24 mx-auto mb-6 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center animate-[gentle-glow_3s_ease-in-out_infinite]">
          <AlertTriangle className="w-10 h-10 text-red-400" />
        </div>

        <h1 className="heading-md text-white mb-3">
          {tr('Something went wrong', 'တစ်ခုခု မှားယွင်းနေပါသည်')}
        </h1>
        <p className="text-gray-400 mb-8 leading-relaxed">
          {tr(
            'An unexpected error occurred. Please try again.',
            'မမျှော်လင့်ထားသော အမှားတစ်ခု ဖြစ်ပေါ်ခဲ့ပါသည်။ ထပ်ကြိုးစားကြည့်ပါ။'
          )}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button onClick={reset} className="btn-primary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            {tr('Try Again', 'ထပ်ကြိုးစားမည်')}
          </button>
          <Link href="/" className="btn-secondary flex items-center gap-2">
            <Home className="w-4 h-4" />
            {tr('Go Home', 'ပင်မစာမျက်နှာ')}
          </Link>
        </div>
      </div>
    </div>
  );
}
