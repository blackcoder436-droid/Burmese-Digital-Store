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
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-red-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="text-center max-w-lg scroll-fade relative z-10">
        {/* Animated warning icon with floating effect */}
        <div className="relative w-28 h-28 mx-auto mb-8">
          <div className="absolute inset-0 bg-red-500/10 rounded-2xl blur-xl animate-pulse" />
          <div className="relative w-full h-full bg-[#12122a] border border-red-500/20 rounded-2xl flex items-center justify-center animate-[error-shake_0.5s_ease-in-out]">
            <AlertTriangle className="w-12 h-12 text-red-400" />
          </div>
        </div>

        <h1 className="heading-md text-white mb-3">
          {tr('Something went wrong', 'တစ်ခုခု မှားယွင်းနေပါသည်')}
        </h1>
        <p className="text-gray-400 mb-3 leading-relaxed max-w-sm mx-auto">
          {tr(
            'An unexpected error occurred. Please try again.',
            'မမျှော်လင့်ထားသော အမှားတစ်ခု ဖြစ်ပေါ်ခဲ့ပါသည်။ ထပ်ကြိုးစားကြည့်ပါ။'
          )}
        </p>

        {error.digest && (
          <p className="text-xs text-gray-600 mb-6 font-mono">
            Error ID: {error.digest}
          </p>
        )}

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

      {/* Shake animation */}
      <style>{`
        @keyframes error-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-2px); }
          80% { transform: translateX(2px); }
        }
      `}</style>
    </div>
  );
}
