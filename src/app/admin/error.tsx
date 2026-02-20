'use client';

// ==========================================
// Admin Error Boundary
// Phase 10.8 — Route segment error handling
// ==========================================

import { useEffect } from 'react';
import { RefreshCw, AlertTriangle, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/lib/language';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { tr } = useLanguage();

  useEffect(() => {
    console.error('Admin error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-red-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="text-center max-w-md relative z-10">
        <div className="relative w-24 h-24 mx-auto mb-6">
          <div className="absolute inset-0 bg-red-500/10 rounded-2xl blur-xl animate-pulse" />
          <div className="relative w-full h-full bg-dark-800 border border-red-500/20 rounded-2xl flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-red-400" />
          </div>
        </div>

        <h1 className="text-xl font-bold text-white mb-2">
          {tr('Admin Panel Error', 'Admin Panel အမှားဖြစ်နေပါတယ်')}
        </h1>
        <p className="text-gray-400 mb-2 text-sm">
          {tr(
            'The admin dashboard encountered an error. Try refreshing.',
            'Admin dashboard မှာ အမှားတစ်ခုဖြစ်သွားပါတယ်။ ပြန်ဖွင့်ကြည့်ပါ။'
          )}
        </p>

        {error.digest && (
          <p className="text-xs text-gray-600 mb-4 font-mono">ID: {error.digest}</p>
        )}

        <div className="flex items-center justify-center gap-3">
          <button onClick={reset} className="btn-primary flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" />
            {tr('Retry', 'ထပ်ကြိုးစားမယ်')}
          </button>
          <Link href="/admin" className="btn-secondary flex items-center gap-2 text-sm">
            <LayoutDashboard className="w-4 h-4" />
            {tr('Dashboard', 'Dashboard')}
          </Link>
        </div>
      </div>
    </div>
  );
}
