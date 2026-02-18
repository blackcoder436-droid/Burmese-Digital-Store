'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Key, Loader2, Shield, Clock, Server, RefreshCw } from 'lucide-react';
import VpnKeyDisplay from '@/components/VpnKeyDisplay';
import { useLanguage } from '@/lib/language';
import { useScrollFade } from '@/hooks/useScrollFade';

interface VpnOrder {
  _id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
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

export default function VpnKeysPage() {
  const { tr } = useLanguage();
  const containerRef = useScrollFade();
  const router = useRouter();
  const [orders, setOrders] = useState<VpnOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVpnOrders();
  }, []);

  async function fetchVpnOrders() {
    setLoading(true);
    try {
      const res = await fetch('/api/orders?limit=50');
      const data = await res.json();
      if (!data.success) {
        router.push('/login');
        return;
      }
      // Filter VPN orders that are completed and have keys
      const vpnOrders = data.data.orders.filter(
        (o: VpnOrder) => o.vpnKey && o.status === 'completed'
      );
      setOrders(vpnOrders);
    } catch {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-12 relative z-[1]" ref={containerRef}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="scroll-fade flex items-center justify-between mb-10">
          <div>
            <Link
              href="/account"
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-purple-400 mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {tr('Back to Account', 'အကောင့်သို့ပြန်မည်')}
            </Link>
            <h1 className="heading-lg flex items-center gap-3">
              <Key className="w-7 h-7 text-purple-400" />
              {tr('My VPN Keys', 'ကျွန်ုပ်၏ VPN Keys')}
            </h1>
          </div>
          <button
            onClick={() => fetchVpnOrders()}
            className="p-3 text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-xl transition-all"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="scroll-fade text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 bg-dark-800 rounded-2xl flex items-center justify-center">
              <Shield className="w-10 h-10 text-gray-600" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {tr('No VPN keys yet', 'VPN key မရှိသေးပါ')}
            </h3>
            <p className="text-gray-500 mb-8">
              {tr('Purchase a VPN plan to get started.', 'VPN plan တစ်ခု ၀ယ်ပါ။')}
            </p>
            <Link href="/vpn" className="btn-electric">
              {tr('Browse VPN Plans', 'VPN Plans ကြည့်မည်')}
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order, i) => {
              const isExpired = order.vpnKey && order.vpnKey.expiryTime < Date.now();
              return (
                <div
                  key={order._id}
                  className="scroll-fade game-card overflow-hidden"
                  data-delay={`${i * 80}`}
                >
                  {/* Key Header */}
                  <div className="p-5 border-b border-dark-600/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${isExpired ? 'bg-red-500' : 'bg-green-500'} animate-pulse`} />
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <Server className="w-4 h-4 text-purple-400" />
                          {order.vpnPlan?.serverId.toUpperCase()} — {order.vpnPlan?.devices} Device{(order.vpnPlan?.devices ?? 0) > 1 ? 's' : ''}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          {isExpired
                            ? tr('Expired', 'သက်တမ်းကုန်ပြီ')
                            : `${tr('Expires', 'သက်တမ်းကုန်')} ${new Date(order.vpnKey!.expiryTime).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-gray-500">{order.orderNumber}</span>
                  </div>

                  {/* VPN Key Display */}
                  {order.vpnKey && (
                    <div className="p-5">
                      <VpnKeyDisplay vpnKey={order.vpnKey} vpnPlan={order.vpnPlan} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
