'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Settings,
  BarChart3,
  History,
  Download,
  Tag,
  Key,
  Server,
} from 'lucide-react';
import { useLanguage } from '@/lib/language';
import AdminHeader from '@/components/layout/AdminHeader';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { tr } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.success && data.data.user.role === 'admin') {
        setAuthorized(true);
      } else {
        router.push('/login');
      }
    } catch {
      router.push('/login');
    }
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const navItems = [
    { href: '/admin', label: tr('Dashboard', 'ဒက်ရှ်ဘုတ်'), icon: LayoutDashboard },
    { href: '/admin/products', label: tr('Products', 'ပစ္စည်းများ'), icon: Package },
    { href: '/admin/orders', label: tr('Orders', 'အော်ဒါများ'), icon: ShoppingCart },
    { href: '/admin/vpn-keys', label: tr('VPN Keys', 'VPN Keys'), icon: Key },
    { href: '/admin/servers', label: tr('Servers', 'Servers'), icon: Server },
    { href: '/admin/users', label: tr('Users', 'အသုံးပြုသူများ'), icon: Users },
    { href: '/admin/analytics', label: tr('Analytics', 'Analytics'), icon: BarChart3 },
    { href: '/admin/activity', label: tr('Activity', 'မှတ်တမ်း'), icon: History },
    { href: '/admin/coupons', label: tr('Coupons', 'ကူပွန်များ'), icon: Tag },
    { href: '/admin/export', label: tr('Export', 'Export'), icon: Download },
    { href: '/admin/settings', label: tr('Settings', 'ဆက်တင်'), icon: Settings },
  ];

  return (
    <div className="min-h-screen relative z-[1]">
      {/* Admin-only header */}
      <AdminHeader />

      {/* Sticky admin nav bar */}
      <div className="sticky top-[64px] z-30 bg-[#0a0a1a]/90 backdrop-blur-lg border-b border-purple-500/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                    isActive
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8">
        {children}
      </div>
    </div>
  );
}
