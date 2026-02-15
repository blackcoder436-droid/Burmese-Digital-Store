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
  const { tr } = useLanguage();
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

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const [productsRes, ordersRes, usersRes] = await Promise.all([
        fetch('/api/admin/products?limit=1'),
        fetch('/api/admin/orders?limit=5'),
        fetch('/api/admin/users?limit=1'),
      ]);

      const productsData = await productsRes.json();
      const ordersData = await ordersRes.json();
      const usersData = await usersRes.json();

      if (productsData.success && ordersData.success) {
        const orders = ordersData.data.orders;
        setRecentOrders(orders);
        setStats({
          totalProducts: productsData.data.pagination.total,
          totalOrders: ordersData.data.pagination.total,
          pendingOrders: orders.filter(
            (o: any) => o.status === 'pending' || o.status === 'verifying'
          ).length,
          completedOrders: orders.filter((o: any) => o.status === 'completed')
            .length,
          revenue: orders
            .filter((o: any) => o.status === 'completed')
            .reduce((sum: number, o: any) => sum + o.totalAmount, 0),
          totalUsers: usersData.success ? usersData.data.pagination.total : 0,
        });
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
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

  return (
    <div className="space-y-10">
      <h1 className="heading-lg">{tr('Dashboard', 'ဒက်ရှ်ဘုတ်')}</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { icon: Users, label: tr('Total Users', 'အသုံးပြုသူစုစုပေါင်း'), value: stats.totalUsers, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
          { icon: Package, label: tr('Total Products', 'ပစ္စည်းစုစုပေါင်း'), value: stats.totalProducts, color: 'text-purple-400', bg: 'bg-purple-500/20' },
          { icon: ShoppingCart, label: tr('Total Orders', 'အော်ဒါစုစုပေါင်း'), value: stats.totalOrders, color: 'text-sky-400', bg: 'bg-sky-500/20' },
          { icon: DollarSign, label: tr('Revenue (MMK)', 'ဝင်ငွေ (MMK)'), value: stats.revenue.toLocaleString(), color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
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
        <h2 className="text-xl font-bold text-white mb-6">{tr('Recent Orders', 'နောက်ဆုံးအော်ဒါများ')}</h2>
        {recentOrders.length === 0 ? (
          <p className="text-gray-500">{tr('No orders yet.', 'အော်ဒါမရှိသေးပါ။')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase border-b border-dark-600/50">
                  <th className="pb-4 pr-4 font-semibold">{tr('User', 'အသုံးပြုသူ')}</th>
                  <th className="pb-4 pr-4 font-semibold">{tr('Product', 'ပစ္စည်း')}</th>
                  <th className="pb-4 pr-4 font-semibold">{tr('Amount', 'ပမာဏ')}</th>
                  <th className="pb-4 pr-4 font-semibold">{tr('Status', 'အခြေအနေ')}</th>
                  <th className="pb-4 font-semibold">{tr('Date', 'ရက်စွဲ')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-600/50">
                {recentOrders.map((order: any) => (
                  <tr key={order._id} className="text-gray-300">
                    <td className="py-4 pr-4 font-medium">{order.user?.name || 'Unknown'}</td>
                    <td className="py-4 pr-4">{order.product?.name || 'Product'}</td>
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
