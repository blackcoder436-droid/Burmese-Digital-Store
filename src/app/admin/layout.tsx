'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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
  Activity,
  Shield,
  Menu,
  X,
  CreditCard,
  ChevronDown,
  MoreHorizontal,
  MessageSquare,
} from 'lucide-react';
import { useLanguage } from '@/lib/language';
import AdminHeader from '@/components/layout/AdminHeader';

const allNavItems = [
  { href: '/admin', labelKey: 'admin.nav.dashboard', icon: LayoutDashboard, group: 'main' },
  { href: '/admin/products', labelKey: 'admin.nav.products', icon: Package, group: 'main' },
  { href: '/admin/orders', labelKey: 'admin.nav.orders', icon: ShoppingCart, group: 'main' },
  { href: '/admin/vpn-keys', labelKey: 'admin.nav.vpnKeys', icon: Key, group: 'main' },
  { href: '/admin/servers', labelKey: 'admin.nav.servers', icon: Server, group: 'main' },
  { href: '/admin/users', labelKey: 'admin.nav.users', icon: Users, group: 'main' },
  { href: '/admin/payment-gateways', labelKey: 'admin.nav.paymentGateways', icon: CreditCard, group: 'tools' },
  { href: '/admin/analytics', labelKey: 'admin.nav.analytics', icon: BarChart3, group: 'tools' },
  { href: '/admin/performance', labelKey: 'performance', icon: Activity, group: 'tools', raw: true },
  { href: '/admin/rate-limits', labelKey: 'ratelimits', icon: Shield, group: 'tools', raw: true },
  { href: '/admin/activity', labelKey: 'admin.nav.activity', icon: History, group: 'tools' },
  { href: '/admin/coupons', labelKey: 'admin.nav.coupons', icon: Tag, group: 'tools' },
  { href: '/admin/support', labelKey: 'admin.nav.support', icon: MessageSquare, group: 'tools' },
  { href: '/admin/export', labelKey: 'admin.nav.export', icon: Download, group: 'tools' },
  { href: '/admin/settings', labelKey: 'admin.nav.settings', icon: Settings, group: 'settings' },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAdmin();
  }, []);

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); setMoreOpen(false); }, [pathname]);

  // Close drawer on outside click
  useEffect(() => {
    if (!drawerOpen) return;
    function handleClick(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setDrawerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [drawerOpen]);

  // Close more dropdown on outside click
  useEffect(() => {
    if (!moreOpen) return;
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [moreOpen]);

  // Lock body scroll when drawer is open on mobile
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const toggleDrawer = useCallback(() => setDrawerOpen((o) => !o), []);

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

  function getLabel(item: typeof allNavItems[0]) {
    if (item.raw) {
      if (item.labelKey === 'performance') return 'Performance';
      if (item.labelKey === 'ratelimits') return 'Rate Limits';
    }
    return t(item.labelKey);
  }

  const primaryItems = allNavItems.filter((i) => i.group === 'main');
  const secondaryItems = allNavItems.filter((i) => i.group !== 'main');
  const isSecondaryActive = secondaryItems.some((i) => pathname === i.href);

  return (
    <div className="min-h-screen relative z-[1]">
      <AdminHeader />

      {/* Sticky admin nav bar */}
      <div className="sticky top-[64px] z-30 bg-[#0a0a1a]/95 backdrop-blur-lg border-b border-purple-500/[0.08]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center h-11 sm:h-12">

            {/* Mobile: hamburger + current page title */}
            <div className="flex items-center gap-2 lg:hidden flex-1 min-w-0">
              <button
                onClick={toggleDrawer}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.06] active:bg-white/10 transition-colors"
                aria-label="Toggle menu"
              >
                {drawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <span className="text-sm font-semibold text-white truncate">
                {getLabel(allNavItems.find((i) => i.href === pathname) || allNavItems[0])}
              </span>
            </div>

            {/* Desktop: horizontal nav links (primary) + More dropdown (secondary) */}
            <div className="hidden lg:flex items-center gap-0.5 flex-1">
              {primaryItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-purple-500/20 text-purple-300'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {getLabel(item)}
                  </Link>
                );
              })}

              {/* Separator */}
              <div className="w-px h-5 bg-purple-500/10 mx-1 shrink-0" />

              {/* More dropdown for secondary items */}
              <div className="relative" ref={moreRef}>
                <button
                  onClick={() => setMoreOpen(!moreOpen)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    isSecondaryActive
                      ? 'bg-purple-500/20 text-purple-300'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
                  }`}
                >
                  <MoreHorizontal className="w-4 h-4 shrink-0" />
                  {isSecondaryActive
                    ? getLabel(secondaryItems.find((i) => pathname === i.href) || secondaryItems[0])
                    : t('admin.nav.more')}
                  <ChevronDown className={`w-3 h-3 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
                </button>

                {moreOpen && (
                  <div className="absolute top-full left-0 mt-1.5 w-56 bg-[#0c0c20] border border-purple-500/15 rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50">
                    <div className="p-1.5">
                      {secondaryItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                              isActive
                                ? 'bg-purple-500/15 text-purple-300'
                                : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                            }`}
                          >
                            <Icon className="w-4 h-4 shrink-0" />
                            {getLabel(item)}
                            {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-400" />}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Drawer panel */}
          <div
            ref={drawerRef}
            className="absolute top-[64px] left-0 bottom-0 w-64 sm:w-72 bg-[#0c0c20] border-r border-purple-500/10 overflow-y-auto overscroll-contain"
          >
            {/* Main section */}
            <div className="p-3">
              <p className="px-3 py-1.5 text-[10px] font-bold text-gray-600 uppercase tracking-widest">{t('admin.nav.dashboard')}</p>
              {primaryItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-purple-500/15 text-purple-300'
                        : 'text-gray-400 hover:text-white hover:bg-white/[0.04] active:bg-white/[0.08]'
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    {getLabel(item)}
                    {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-400" />}
                  </Link>
                );
              })}
            </div>

            <div className="mx-3 border-t border-purple-500/10" />

            {/* Tools section */}
            <div className="p-3">
              <p className="px-3 py-1.5 text-[10px] font-bold text-gray-600 uppercase tracking-widest">Tools</p>
              {secondaryItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-purple-500/15 text-purple-300'
                        : 'text-gray-400 hover:text-white hover:bg-white/[0.04] active:bg-white/[0.08]'
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    {getLabel(item)}
                    {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-400" />}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8">
        {children}
      </div>
    </div>
  );
}
