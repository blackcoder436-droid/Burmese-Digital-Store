'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Package, RefreshCw, ChevronRight, ChevronDown, Clock, Search, CheckCircle, XCircle } from 'lucide-react';
import { useLanguage } from '@/lib/language';
import { useScrollFade } from '@/hooks/useScrollFade';

interface Order {
  _id: string;
  product: {
    _id: string;
    name: string;
    category: string;
    price: number;
    image?: string;
  } | null;
  orderType: 'product' | 'vpn';
  quantity: number;
  totalAmount: number;
  paymentMethod: string;
  status: 'pending' | 'verifying' | 'completed' | 'rejected' | 'refunded';
  transactionId?: string;
  ocrVerified: boolean;
  deliveredKeys: {
    serialKey?: string;
    loginEmail?: string;
    loginPassword?: string;
    additionalInfo?: string;
  }[];
  vpnPlan?: { serverId: string; planId: string; devices: number; months: number };
  vpnKey?: {
    clientEmail: string;
    subLink: string;
    configLink: string;
    protocol: string;
    expiryTime: number;
    provisionedAt?: string;
  };
  vpnProvisionStatus?: string;
  createdAt: string;
}

export default function OrdersPage() {
  const { t } = useLanguage();
  const containerRef = useScrollFade();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    fetchOrders();
  }, [filter]);

  async function fetchOrders() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (filter) params.set('status', filter);

      const res = await fetch(`/api/orders?${params}`);
      const data = await res.json();

      if (!data.success) {
        router.push('/login');
        return;
      }

      setOrders(data.data.orders);
    } catch {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  const statusConfig: Record<string, { icon: typeof Clock; color: string; bg: string; border: string }> = {
    pending: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25' },
    verifying: { icon: Search, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/25' },
    completed: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25' },
    rejected: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/25' },
    refunded: { icon: XCircle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25' },
  };

  const filters = [
    { value: '', label: t('account.orders.all'), count: orders.length },
    { value: 'pending', label: t('account.orders.pending') },
    { value: 'verifying', label: t('account.orders.verifying') },
    { value: 'completed', label: t('account.orders.completed') },
    { value: 'rejected', label: t('account.orders.rejected') },
  ];

  return (
    <div className="min-h-screen pt-6 sm:pt-8 pb-12 relative z-[1]" ref={containerRef}>
      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Header + Filter row */}
        <div className="scroll-fade mb-5 sm:mb-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => router.push('/account')} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors" aria-label="Back to account">
                <ArrowLeft className="w-4 h-4 text-gray-400" />
              </button>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">{t('account.orders.myOrders')}</h1>
            </div>
            <div className="flex items-center gap-2">
              {/* Status filter dropdown */}
              <div className="relative">
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-[#12122a] text-gray-300 border border-purple-500/20 hover:border-purple-500/50 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/30 transition-all cursor-pointer"
                >
                  {filters.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
              </div>
              <button
                onClick={() => fetchOrders()}
                className="p-2 sm:p-2.5 text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-xl transition-all flex-shrink-0"
                title={t('account.orders.refresh')}
              >
                <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="game-card h-20 sm:h-24 animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 sm:py-24">
            <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 bg-[#12122a] rounded-2xl flex items-center justify-center">
              <Package className="w-8 h-8 sm:w-10 sm:h-10 text-gray-600" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
              {t('account.orders.noOrdersYet')}
            </h3>
            <p className="text-sm sm:text-base text-gray-500 mb-6 sm:mb-8">
              {t('account.orders.browseShopMsg')}
            </p>
            <Link href="/shop" className="btn-electric">
              {t('account.orders.browseShop')}
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5 sm:space-y-4">
            {orders.map((order, i) => {
              const sc = statusConfig[order.status] || statusConfig.pending;
              const StatusIcon = sc.icon;
              const isVpn = order.orderType === 'vpn' && order.vpnPlan;

              return (
                <Link
                  key={order._id}
                  href={`/account/orders/${order._id}`}
                  className="scroll-fade game-card overflow-hidden block hover:border-purple-500/30 active:scale-[0.99] transition-all"
                  data-delay={`${Math.min(i * 60, 300)}`}
                >
                  <div className="p-3.5 sm:p-5">
                    <div className="flex items-center gap-3">
                      {/* Left: product info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          {isVpn && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 flex-shrink-0">
                              VPN
                            </span>
                          )}
                          <h3 className="text-sm sm:text-base font-bold text-white truncate">
                            {isVpn && order.vpnPlan
                              ? `${order.vpnPlan.devices}D / ${order.vpnPlan.months}M — ${order.vpnPlan.serverId.toUpperCase()}`
                              : order.product?.name || 'Product'
                            }
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500">
                          <span className="text-purple-400 font-semibold">{order.totalAmount.toLocaleString()} MMK</span>
                          <span className="text-gray-700">•</span>
                          <span>{order.paymentMethod.toUpperCase()}</span>
                          <span className="text-gray-700">•</span>
                          <span className="hidden sm:inline">{new Date(order.createdAt).toLocaleDateString()}</span>
                          <span className="sm:hidden">{new Date(order.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        </div>
                      </div>

                      {/* Right: status badge + chevron */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold ${sc.bg} ${sc.color} ${sc.border} border`}>
                          <StatusIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          <span className="hidden sm:inline">
                            {order.status === 'pending' ? t('order.pending')
                              : order.status === 'verifying' ? t('order.verifying')
                              : order.status === 'completed' ? t('order.completed')
                              : order.status === 'rejected' ? t('order.rejected')
                              : t('order.refunded')}
                          </span>
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
