'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/language';

export default function CheckoutSuccessPage() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Give webhook time to process
    const timer = setTimeout(() => setReady(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {!ready ? (
          <>
            <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">{t('checkout.processing')}</h1>
            <p className="text-gray-500 text-sm">{t('checkout.pleaseWait')}</p>
          </>
        ) : (
          <>
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">{t('checkout.success')}</h1>
            <p className="text-gray-400 text-sm mb-6">{t('checkout.successMessage')}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/account/orders"
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-colors"
              >
                {t('checkout.viewOrders')}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/shop"
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 font-semibold rounded-xl transition-colors"
              >
                {t('checkout.continueShopping')}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
