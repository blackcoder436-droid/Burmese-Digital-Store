'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  XCircle,
  CheckCircle,
  Clock,
  Package,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/language';
import { useScrollFade } from '@/hooks/useScrollFade';

interface SubscriptionItem {
  _id: string;
  product: {
    _id: string;
    name: string;
    slug: string;
    image?: string;
    price: number;
    subscriptionDuration?: number;
    subscriptionPrice?: number;
  };
  status: 'active' | 'expired' | 'cancelled';
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  nextRenewalDate?: string;
  renewalCount: number;
}

const statusColors: Record<string, string> = {
  active: 'bg-green-500/20 text-green-300',
  expired: 'bg-red-500/20 text-red-300',
  cancelled: 'bg-gray-500/20 text-gray-400',
};

export default function SubscriptionsPage() {
  const { t } = useLanguage();
  const containerRef = useScrollFade();
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  async function fetchSubscriptions() {
    try {
      const res = await fetch('/api/subscriptions');
      const data = await res.json();
      if (data.success) {
        setSubscriptions(data.data.subscriptions);
      }
    } catch {
      toast.error(t('account.somethingWrong'));
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(id: string, action: string) {
    try {
      const res = await fetch(`/api/subscriptions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(action === 'cancel' ? t('subscription.cancelled') : t('subscription.updated'));
        fetchSubscriptions();
      } else {
        toast.error(data.error || t('account.somethingWrong'));
      }
    } catch {
      toast.error(t('account.somethingWrong'));
    }
  }

  function daysRemaining(endDate: string) {
    const diff = new Date(endDate).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  return (
    <div ref={containerRef} className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/account"
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">{t('subscription.title')}</h1>
          <p className="text-sm text-gray-500">{t('subscription.subtitle')}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="text-center py-20">
          <Package className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">{t('subscription.noSubscriptions')}</p>
          <Link href="/shop" className="text-purple-400 hover:underline text-sm mt-2 inline-block">
            {t('subscription.browseProducts')}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {subscriptions.map((sub) => {
            const days = daysRemaining(sub.endDate);
            return (
              <div
                key={sub._id}
                className="p-5 bg-white/[0.03] border border-purple-500/10 rounded-xl"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white">{sub.product?.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {sub.product?.subscriptionPrice?.toLocaleString()} Ks / {sub.product?.subscriptionDuration === 30 ? t('subscription.monthly') : t('subscription.yearly')}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[sub.status]}`}>
                    {sub.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-4">
                  <div>
                    <p className="text-gray-500">{t('subscription.startDate')}</p>
                    <p className="text-gray-300">{new Date(sub.startDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">{t('subscription.endDate')}</p>
                    <p className="text-gray-300">{new Date(sub.endDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">{t('subscription.daysLeft')}</p>
                    <p className={`font-semibold ${days > 7 ? 'text-green-400' : days > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {days}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">{t('subscription.autoRenew')}</p>
                    <p className={sub.autoRenew ? 'text-green-400' : 'text-gray-500'}>
                      {sub.autoRenew ? t('common.yes') : t('common.no')}
                    </p>
                  </div>
                </div>

                {sub.status === 'active' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(sub._id, 'toggle-auto-renew')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-semibold rounded-lg transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      {sub.autoRenew ? t('subscription.disableAutoRenew') : t('subscription.enableAutoRenew')}
                    </button>
                    <button
                      onClick={() => handleAction(sub._id, 'cancel')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold rounded-lg transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      {t('subscription.cancel')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
