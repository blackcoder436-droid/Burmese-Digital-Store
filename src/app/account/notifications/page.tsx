'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Bell,
  BellOff,
  CheckCheck,
  Package,
  ShieldCheck,
  XCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useLanguage } from '@/lib/language';
import { useScrollFade } from '@/hooks/useScrollFade';
import toast from 'react-hot-toast';

const POLL_INTERVAL_MS = 10000;

interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  orderId?: string;
  read: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const { t } = useLanguage();
  const containerRef = useScrollFade();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications(true);

    const handleFocusRefresh = () => {
      if (document.visibilityState === 'visible') {
        void fetchNotifications(false);
      }
    };

    const interval = setInterval(() => {
      void fetchNotifications(false);
    }, POLL_INTERVAL_MS);

    window.addEventListener('focus', handleFocusRefresh);
    document.addEventListener('visibilitychange', handleFocusRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocusRefresh);
      document.removeEventListener('visibilitychange', handleFocusRefresh);
    };
  }, []);

  async function fetchNotifications(showLoading = false) {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=50', { cache: 'no-store' });
      const data = await res.json();
      if (!data.success) {
        router.push('/login');
        return;
      }
      setNotifications(data.data.notifications);
    } catch {
      router.push('/login');
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function markAllRead() {
    try {
      const unreadIds = notifications.filter((n) => !n.read).map((n) => n._id);
      if (unreadIds.length === 0) return;

      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      const data = await res.json();
      if (data.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        toast.success(t('notifications.allMarkedAsRead'));
      }
    } catch {
      toast.error(t('common.error'));
    }
  }

  const typeIcon: Record<string, React.ReactNode> = {
    order_placed: <Package className="w-5 h-5 text-blue-400" />,
    order_verifying: <ShieldCheck className="w-5 h-5 text-yellow-400" />,
    order_completed: <CheckCircle className="w-5 h-5 text-green-400" />,
    order_rejected: <XCircle className="w-5 h-5 text-red-400" />,
    order_refunded: <XCircle className="w-5 h-5 text-orange-400" />,
    admin_new_order: <Package className="w-5 h-5 text-purple-400" />,
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen pt-8 pb-12 relative z-[1]" ref={containerRef}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="scroll-fade flex items-center justify-between mb-10">
          <div>
            <h1 className="heading-lg flex items-center gap-3">
              <Bell className="w-7 h-7 text-purple-400" />
              {t('notifications.title')}
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 text-xs font-bold bg-purple-500 text-white rounded-full">
                  {unreadCount}
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-purple-400 px-3 py-2 rounded-lg hover:bg-purple-500/10 transition-all"
              >
                <CheckCheck className="w-4 h-4" />
                {t('notifications.markAllRead')}
              </button>
            )}
            <button
              onClick={() => fetchNotifications(true)}
              className="p-2.5 text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-xl transition-all"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="scroll-fade text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 bg-dark-800 rounded-2xl flex items-center justify-center">
              <BellOff className="w-10 h-10 text-gray-600" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {t('notifications.noNotifications')}
            </h3>
            <p className="text-gray-500">
              {t('notifications.statusChangesNotice')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif, i) => (
              <div
                key={notif._id}
                className={`scroll-fade game-card p-4 flex items-start gap-4 transition-all ${
                  !notif.read ? 'border-purple-500/20 bg-purple-500/[0.03]' : ''
                }`}
                data-delay={`${i * 40}`}
              >
                <div className="shrink-0 mt-0.5">
                  {typeIcon[notif.type] || <Bell className="w-5 h-5 text-gray-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-semibold ${!notif.read ? 'text-white' : 'text-gray-400'}`}>
                      {notif.title}
                    </p>
                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0 mt-1.5" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{notif.message}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px] text-gray-600">
                      {new Date(notif.createdAt).toLocaleString()}
                    </span>
                    {notif.orderId && (
                      <Link
                        href={`/account/orders/${notif.orderId}`}
                        className="text-[10px] text-purple-400 hover:text-purple-300"
                      >
                        {t('notifications.viewOrder')} →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
