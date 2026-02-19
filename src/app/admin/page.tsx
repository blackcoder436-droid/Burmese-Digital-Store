'use client';

import { useEffect, useState } from 'react';
import {
  Package,
  ShoppingCart,
  Users,
  TrendingUp,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useLanguage } from '@/lib/language';

export default function AdminDashboard() {
  const { t } = useLanguage();
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    revenue: 0,
    totalUsers: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  async function safeFetch(url: string) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      return data.success ? data : null;
    } catch {
      return null;
    }
  }

  async function fetchStats() {
    setLoading(true);
    setFetchError(false);
    try {
      const [productsData, ordersData, usersData, analyticsData] = await Promise.all([
        safeFetch('/api/admin/products?limit=1'),
        safeFetch('/api/admin/orders?limit=5'),
        safeFetch('/api/admin/users?limit=1'),
        safeFetch('/api/admin/analytics?range=all'),
      ]);

      // If both core endpoints failed, show error state
      if (!productsData && !ordersData) {
        setFetchError(true);
        return;
      }

      const orders = ordersData?.data?.orders || [];
      setRecentOrders(orders);

      const totalRevenue = analyticsData?.data?.overviewStats?.totalRevenue || 0;
      const completedCount = analyticsData?.data?.overviewStats?.completedOrders
        ?? orders.filter((o: any) => o.status === 'completed').length;
      const pendingCount = analyticsData?.data?.overviewStats?.pendingOrders
        ?? orders.filter((o: any) => o.status === 'pending' || o.status === 'verifying').length;

      setStats({
        totalProducts: productsData?.data?.pagination?.total || 0,
        totalOrders: ordersData?.data?.pagination?.total || 0,
        pendingOrders: pendingCount,
        completedOrders: completedCount,
        revenue: totalRevenue,
        totalUsers: usersData?.data?.pagination?.total || 0,
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="game-card h-32 animate-pulse" />
        ))}
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-14 h-14 bg-red-500/15 rounded-full flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-red-400" />
        </div>
        <p className="text-gray-400 text-sm">{t('common.error')}</p>
        <button
          onClick={fetchStats}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 transition-all"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <h1 className="heading-lg">{t('admin.dashboard')}</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { icon: Users, label: t('admin.totalUsers'), value: stats.totalUsers, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
          { icon: Package, label: t('admin.totalProducts'), value: stats.totalProducts, color: 'text-purple-400', bg: 'bg-purple-500/20' },
          { icon: ShoppingCart, label: t('admin.totalOrders'), value: stats.totalOrders, color: 'text-sky-400', bg: 'bg-sky-500/20' },
          { icon: DollarSign, label: t('admin.revenueMmk'), value: stats.revenue.toLocaleString(), color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="game-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">{stat.label}</p>
                  <p className="text-3xl font-black text-white mt-2">{stat.value}</p>
                </div>
                <div className={`w-14 h-14 ${stat.bg} rounded-2xl flex items-center justify-center`}>
                  <Icon className={`w-7 h-7 ${stat.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Orders */}
      <div className="game-card p-6">
        <h2 className="text-xl font-bold text-white mb-6">{t('admin.recentOrders')}</h2>
        {recentOrders.length === 0 ? (
          <p className="text-gray-500">{t('admin.noOrdersYet')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase border-b border-dark-600/50">
                  <th className="pb-4 pr-4 font-semibold">{t('admin.user')}</th>
                  <th className="pb-4 pr-4 font-semibold">{t('admin.product')}</th>
                  <th className="pb-4 pr-4 font-semibold">{t('admin.amount')}</th>
                  <th className="pb-4 pr-4 font-semibold">{t('admin.status')}</th>
                  <th className="pb-4 font-semibold">{t('admin.date')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-600/50">
                {recentOrders.map((order: any) => (
                  <tr key={order._id} className="text-gray-300">
                    <td className="py-4 pr-4 font-medium">{order.user?.name || t('common.unknown')}</td>
                    <td className="py-4 pr-4">{order.product?.name || t('admin.product')}</td>
                    <td className="py-4 pr-4 text-purple-400 font-bold">{order.totalAmount?.toLocaleString()} MMK</td>
                    <td className="py-4 pr-4">
                      <span className={`status-${order.status}`}>{order.status}</span>
                    </td>
                    <td className="py-4 text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
