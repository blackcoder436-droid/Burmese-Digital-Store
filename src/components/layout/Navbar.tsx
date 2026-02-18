'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Menu,
  X,
  ShoppingBag,
  ShoppingCart,
  User,
  Bell,
  ChevronDown,
  LogOut,
  LayoutDashboard,
} from 'lucide-react';
import { useLanguage } from '@/lib/language';
import { useCart } from '@/lib/cart';
import NotificationBell from '@/components/NotificationBell';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  avatar: string | null;
}

interface SessionInfo {
  issuedAt: string | null;
  expiresAt: string | null;
  remainingSeconds: number | null;
}

export default function Navbar() {
  const { lang, setLang, t } = useLanguage();
  const { getItemCount } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    fetchUser();
    setIsOpen(false);
    setShowDropdown(false);
  }, [pathname]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowDropdown(false);
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [user?.avatar]);

  useEffect(() => {
    if (!sessionInfo || sessionInfo.remainingSeconds === null) return;
    const timer = setInterval(() => {
      setSessionInfo((prev) => {
        if (!prev || prev.remainingSeconds === null) return prev;
        return { ...prev, remainingSeconds: Math.max(0, prev.remainingSeconds - 60) };
      });
    }, 60000);

    return () => clearInterval(timer);
  }, [sessionInfo?.remainingSeconds]);

  function formatRemainingTime(seconds: number | null): string {
    if (seconds === null) return t('account.sessionUnknown');
    if (seconds <= 0) return t('account.sessionExpired');

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  async function fetchUser() {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.success) {
        setUser(data.data.user);
        setSessionInfo(data.data.session || null);
      }
      else {
        setUser(null);
        setSessionInfo(null);
      }
    } catch {
      setUser(null);
      setSessionInfo(null);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/me', { method: 'POST' });
    setUser(null);
    setShowDropdown(false);
    window.location.href = '/';
  }

  const navLinks = [
    { href: '/', label: t('nav.home') },
    { href: '/shop', label: t('nav.shop') },
    { href: '/vpn', label: t('nav.vpn') },
    { href: '/contact', label: t('nav.contact') },
  ];

  return (
    <>
    {/* Skip to content link for keyboard users */}
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:px-4 focus:py-2 focus:bg-purple-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold"
    >
      {t('nav.skipToContent')}
    </a>
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-dark-950/95 backdrop-blur-xl border-b border-dark-600/50 shadow-lg shadow-black/30'
          : 'bg-transparent'
      }`}
      role="navigation"
      aria-label={t('nav.mainNavigation')}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 sm:gap-3 group min-w-0 shrink-0">
            <Image
              src="/logo.jpg"
              alt="Burmese Digital Store"
              width={40}
              height={40}
              priority
              className="rounded-xl shadow-glow-sm group-hover:shadow-glow transition-shadow duration-300 sm:w-11 sm:h-11"
            />
            <span className="hidden lg:inline text-xl font-bold text-white whitespace-nowrap">
              Burmese<span className="text-accent-gradient"> Digital Store</span>
            </span>
            <span className="hidden sm:inline lg:hidden text-base font-bold text-white whitespace-nowrap">
              BDS
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-0.5 lg:gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 lg:px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                  pathname === link.href
                    ? 'text-purple-400 bg-purple-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Cart Icon - only show when items in cart */}
            {getItemCount() > 0 && (
              <Link
                href="/cart"
                className="relative p-2 text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-all animate-slide-up"
                aria-label={lang === 'my' ? `စျေးခြင်းတောင်း၊ ${getItemCount()} ခု` : `Shopping cart, ${getItemCount()} items`}
              >
                <ShoppingCart className="w-5 h-5" />
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-purple-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-glow-sm">
                  {getItemCount() > 99 ? '99+' : getItemCount()}
                </span>
              </Link>
            )}

            {user && <NotificationBell />}

            <button
              onClick={() => setLang(lang === 'my' ? 'en' : 'my')}
              className="hidden md:flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-dark-800/80 border border-dark-600/50 text-xs font-medium text-gray-300 hover:border-purple-500/50 hover:text-white transition-all"
              aria-label={lang === 'my' ? t('nav.switchToEnglish') : t('nav.switchLanguage')}
            >
              {lang === 'my' ? (
                <svg className="w-5 h-4 rounded-sm overflow-hidden" viewBox="0 0 60 40" aria-hidden="true">
                  <rect width="60" height="40" fill="#012169"/>
                  <path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" strokeWidth="6"/>
                  <path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" strokeWidth="4"/>
                  <path d="M30,0 V40 M0,20 H60" stroke="#fff" strokeWidth="10"/>
                  <path d="M30,0 V40 M0,20 H60" stroke="#C8102E" strokeWidth="6"/>
                </svg>
              ) : (
                <svg className="w-5 h-4 rounded-sm overflow-hidden" viewBox="0 0 60 40" aria-hidden="true">
                  <rect width="60" height="13.33" fill="#FECB00"/>
                  <rect y="13.33" width="60" height="13.33" fill="#34B233"/>
                  <rect y="26.67" width="60" height="13.33" fill="#EA2839"/>
                  <polygon points="30,5 33,15 43,15 35,21 37.5,31 30,25 22.5,31 25,21 17,15 27,15" fill="#fff"/>
                </svg>
              )}
            </button>

            {user ? (
              <>
                <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  aria-expanded={showDropdown}
                  aria-haspopup="true"
                  aria-label={t('nav.userMenu')}
                  className="h-10 min-w-10 flex items-center justify-center gap-1 px-1.5 sm:px-2 py-1 rounded-lg bg-dark-800/80 border border-dark-600/50 hover:border-purple-500/50 hover:shadow-glow-sm transition-all duration-200"
                >
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg overflow-hidden bg-gradient-to-br from-purple-400 to-cyan-500 flex items-center justify-center">
                    {user.avatar && !avatarLoadFailed ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-full h-full object-cover"
                        onError={() => setAvatarLoadFailed(true)}
                      />
                    ) : (
                      <span className="text-xs font-bold text-white">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <ChevronDown className={`hidden sm:block w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showDropdown && (
                  <div className="absolute right-0 mt-3 w-56 glass-panel shadow-2xl shadow-black/50 overflow-hidden animate-slide-up" role="menu" aria-orientation="vertical">
                    <div className="px-4 py-4 border-b border-white/5 bg-gradient-to-r from-purple-500/10 to-transparent">
                      <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                      <p className="text-xs text-gray-500 truncate mt-1">{user.email}</p>
                      <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400" />
                        {t('account.session')}: {formatRemainingTime(sessionInfo?.remainingSeconds ?? null)}
                      </p>
                    </div>
                    <div className="p-2">
                      <Link
                        href="/account"
                        className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                        onClick={() => setShowDropdown(false)}
                      >
                        <User className="w-4 h-4" />
                        {t('nav.myAccount')}
                      </Link>
                      <Link
                        href="/account/notifications"
                        className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                        onClick={() => setShowDropdown(false)}
                      >
                        <Bell className="w-4 h-4" />
                        {t('account.notifications')}
                      </Link>
                      <Link
                        href="/account/orders"
                        className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                        onClick={() => setShowDropdown(false)}
                      >
                        <ShoppingBag className="w-4 h-4" />
                        {t('nav.myOrders')}
                      </Link>
                      {user.role === 'admin' && (
                        <Link
                          href="/admin"
                          className="flex items-center gap-3 px-3 py-2.5 text-sm text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-all"
                          onClick={() => setShowDropdown(false)}
                        >
                          <LayoutDashboard className="w-4 h-4" />
                          {t('nav.adminPanel')}
                        </Link>
                      )}
                    </div>
                    <div className="p-2 border-t border-white/5">
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-3 py-2.5 w-full text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                      >
                        <LogOut className="w-4 h-4" />
                        {t('nav.logOut')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="hidden sm:block text-sm font-medium text-gray-400 hover:text-white px-4 py-2.5 transition-colors"
                >
                    {t('nav.signIn')}
                </Link>
              </div>
            )}

            {/* Mobile Toggle */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              aria-expanded={isOpen}
              aria-controls="mobile-menu"
              aria-label={isOpen ? t('nav.closeMenu') : t('nav.openMenu')}
              className="md:hidden p-2 text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-all"
            >
              {isOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div id="mobile-menu" className="md:hidden bg-dark-900/95 backdrop-blur-xl border-t border-dark-600/50 animate-slide-up" role="menu">
          <div className="px-4 py-4 space-y-1">
            <div className="mb-3">
              <button
                onClick={() => setLang(lang === 'my' ? 'en' : 'my')}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-dark-800 border border-dark-600 text-xs font-semibold text-gray-300"
              >
                {lang === 'my' ? (
                  <svg className="w-5 h-4 rounded-sm" viewBox="0 0 60 40">
                    <rect width="60" height="40" fill="#012169"/>
                    <path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" strokeWidth="6"/>
                    <path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" strokeWidth="4"/>
                    <path d="M30,0 V40 M0,20 H60" stroke="#fff" strokeWidth="10"/>
                    <path d="M30,0 V40 M0,20 H60" stroke="#C8102E" strokeWidth="6"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-4 rounded-sm" viewBox="0 0 60 40">
                    <rect width="60" height="13.33" fill="#FECB00"/>
                    <rect y="13.33" width="60" height="13.33" fill="#34B233"/>
                    <rect y="26.67" width="60" height="13.33" fill="#EA2839"/>
                    <polygon points="30,5 33,15 43,15 35,21 37.5,31 30,25 22.5,31 25,21 17,15 27,15" fill="#fff"/>
                  </svg>
                )}
                {lang === 'my' ? 'English' : 'မြန်မာ'}
              </button>
            </div>

            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`block px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  pathname === link.href
                    ? 'text-purple-400 bg-purple-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {link.label}
              </Link>
            ))}
            {user ? (
              <div className="pt-4 mt-3 border-t border-dark-600/50 space-y-1">
                <Link
                  href="/account"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    pathname === '/account'
                      ? 'text-purple-400 bg-purple-500/10'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <User className="w-4 h-4" />
                  {t('nav.profile')}
                </Link>
                <Link
                  href="/account/notifications"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    pathname === '/account/notifications'
                      ? 'text-purple-400 bg-purple-500/10'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Bell className="w-4 h-4" />
                  {t('account.notifications')}
                </Link>
                <Link
                  href="/account/orders"
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    pathname === '/account/orders'
                      ? 'text-purple-400 bg-purple-500/10'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                  {t('nav.myOrders')}
                </Link>
                {user.role === 'admin' && (
                  <Link
                    href="/admin"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-all"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    {t('nav.adminPanel')}
                  </Link>
                )}
                <button
                  onClick={() => { setIsOpen(false); handleLogout(); }}
                  className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  {t('nav.logOut')}
                </button>
              </div>
            ) : (
              <div className="pt-4 mt-3 border-t border-dark-600/50 space-y-3">
                <Link
                  href="/login"
                  onClick={() => setIsOpen(false)}
                  className="block text-center px-4 py-3 text-gray-400 hover:text-white rounded-xl transition-colors"
                >
                  {t('nav.signIn')}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
    </>
  );
}
