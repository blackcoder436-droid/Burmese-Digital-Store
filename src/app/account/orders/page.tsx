'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Package, RefreshCw } from 'lucide-react';
import OrderStatus from '@/components/OrderStatus';
import MyKeys from '@/components/MyKeys';
import VpnKeyDisplay from '@/components/VpnKeyDisplay';
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
  const { tr } = useLanguage();
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

  return (
    <div className="min-h-screen pt-24 pb-12 relative z-[1]" ref={containerRef}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="scroll-fade flex items-center justify-between mb-10">
          <div>
            <Link
              href="/account"
              className="inline-flex items-center space-x-2 text-sm text-gray-500 hover:text-purple-400 mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{tr('Back to Account', 'အကောင့်သို့ပြန်မည်')}</span>
            </Link>
            <h1 className="heading-lg">{tr('My Orders', 'ကျွန်ုပ်၏အော်ဒါများ')}</h1>
          </div>
          <button
            onClick={() => fetchOrders()}
            className="p-3 text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-xl transition-all"
            title={tr('Refresh', 'ပြန်လည်တင်ရန်')}
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="scroll-fade flex flex-wrap gap-2 mb-8" data-delay="100">
          {[
            { value: '', label: tr('All', 'အားလုံး') },
            { value: 'pending', label: tr('Pending', 'စောင့်ဆိုင်းနေသည်') },
            { value: 'verifying', label: tr('Verifying', 'စစ်ဆေးနေသည်') },
            { value: 'completed', label: tr('Completed', 'ပြီးဆုံးသည်') },
            { value: 'rejected', label: tr('Rejected', 'ပယ်ချသည်') },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                filter === f.value
                  ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-glow-sm'
                  : 'bg-[#12122a] text-gray-400 hover:text-white border border-purple-500/[0.15] hover:border-purple-500/50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="space-y-5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="game-card h-44 animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 mx-auto mb-6 bg-[#12122a] rounded-2xl flex items-center justify-center">
              <Package className="w-10 h-10 text-gray-600" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {tr('No orders yet', 'အော်ဒါမရှိသေးပါ')}
            </h3>
            <p className="text-gray-500 mb-8">
              {tr('Browse our shop to find amazing digital products.', 'Digital products များကိုရှာရန် ဆိုင်ကိုကြည့်ပါ။')}
            </p>
            <Link href="/shop" className="btn-electric">
              {tr('Browse Shop', 'ဆိုင်ကြည့်မည်')}
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order, i) => (
              <Link
                key={order._id}
                href={`/account/orders/${order._id}`}
                className="scroll-fade game-card overflow-hidden block hover:border-purple-500/30 transition-all"
                data-delay={`${i * 80}`}
              >
                {/* Order Header */}
                <div className="p-6 border-b border-dark-600/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        {order.orderType === 'vpn' && order.vpnPlan ? (
                          <>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">VPN</span>
                            {order.vpnPlan.devices} Device{order.vpnPlan.devices > 1 ? 's' : ''} / {order.vpnPlan.months} {order.vpnPlan.months > 1 ? 'Months' : 'Month'} — {order.vpnPlan.serverId.toUpperCase()}
                          </>
                        ) : (
                          order.product?.name || 'Product'
                        )}
                      </h3>
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-sm text-gray-500 mt-2">
                        <span className="text-purple-400 font-semibold">{order.totalAmount.toLocaleString()} MMK</span>
                        <span>•</span>
                        <span>{order.paymentMethod.toUpperCase()}</span>
                        <span>•</span>
                        <span>
                          {new Date(order.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {order.ocrVerified && (
                      <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        ✓ {tr('OCR Verified', 'OCR အတည်ပြုပြီး')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Order Status Stepper */}
                <div className="p-6">
                  <OrderStatus status={order.status} />
                </div>

                {/* Delivered Keys */}
                {order.status === 'completed' &&
                  order.deliveredKeys?.length > 0 && (
                    <div className="px-6 pb-6">
                      <MyKeys
                        keys={order.deliveredKeys}
                        productName={order.product?.name || 'Product'}
                      />
                    </div>
                  )}

                {/* VPN Key */}
                {order.status === 'completed' &&
                  order.orderType === 'vpn' &&
                  order.vpnKey && (
                    <div className="px-6 pb-6">
                      <VpnKeyDisplay vpnKey={order.vpnKey} vpnPlan={order.vpnPlan} />
                    </div>
                  )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
