'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Menu,
  X,
  ShoppingBag,
  User,
  ChevronDown,
  LogOut,
  LayoutDashboard,
} from 'lucide-react';
import { useLanguage } from '@/lib/language';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  avatar: string | null;
}

export default function Navbar() {
  const { lang, setLang, tr } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function fetchUser() {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.success) setUser(data.data.user);
      else setUser(null);
    } catch {
      setUser(null);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/me', { method: 'POST' });
    setUser(null);
    setShowDropdown(false);
    window.location.href = '/';
  }

  const navLinks = [
    { href: '/', label: tr('Home', 'မူလစာမျက်နှာ') },
    { href: '/shop', label: tr('Shop', 'ဆိုင်') },
    { href: '/vpn', label: 'VPN' },
    { href: '/contact', label: tr('Contact', 'ဆက်သွယ်ရန်') },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-dark-950/95 backdrop-blur-xl border-b border-dark-600/50 shadow-lg shadow-black/30'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group min-w-0">
            <Image
              src="/logo.jpg"
              alt="Burmese Digital Store"
              width={40}
              height={40}
              priority
              className="rounded-xl shadow-glow-sm group-hover:shadow-glow transition-shadow duration-300 sm:w-11 sm:h-11"
            />
            <span className="hidden sm:inline text-xl font-bold text-white whitespace-nowrap">
              Burmese<span className="text-accent-gradient"> Digital Store</span>
            </span>
            <span className="sm:hidden text-base font-bold text-white truncate">
              Burmese<span className="text-accent-gradient"> Digital Store</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
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
            <button
              onClick={() => setLang(lang === 'my' ? 'en' : 'my')}
              className="hidden md:flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-dark-800/80 border border-dark-600/50 text-xs font-medium text-gray-300 hover:border-purple-500/50 hover:text-white transition-all"
              title={lang === 'my' ? 'Switch to English' : 'မြန်မာဘာသာသို့ ပြောင်းရန်'}
            >
              {lang === 'my' ? (
                <svg className="w-5 h-4 rounded-sm overflow-hidden" viewBox="0 0 60 40">
                  <rect width="60" height="40" fill="#012169"/>
                  <path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" strokeWidth="6"/>
                  <path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" strokeWidth="4"/>
                  <path d="M30,0 V40 M0,20 H60" stroke="#fff" strokeWidth="10"/>
                  <path d="M30,0 V40 M0,20 H60" stroke="#C8102E" strokeWidth="6"/>
                </svg>
              ) : (
                <svg className="w-5 h-4 rounded-sm overflow-hidden" viewBox="0 0 60 40">
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
                  className="flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-lg bg-dark-800/80 border border-dark-600/50 hover:border-purple-500/50 hover:shadow-glow-sm transition-all duration-200"
                >
                  <div className="w-7 h-7 rounded-lg overflow-hidden bg-gradient-to-br from-purple-400 to-cyan-500 flex items-center justify-center">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-full h-full object-cover"
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
                  <div className="absolute right-0 mt-3 w-56 glass-panel shadow-2xl shadow-black/50 overflow-hidden animate-slide-up">
                    <div className="px-4 py-4 border-b border-white/5 bg-gradient-to-r from-purple-500/10 to-transparent">
                      <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                      <p className="text-xs text-gray-500 truncate mt-1">{user.email}</p>
                    </div>
                    <div className="p-2">
                      <Link
                        href="/account"
                        className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                        onClick={() => setShowDropdown(false)}
                      >
                        <User className="w-4 h-4" />
                        {tr('My Account', 'ကျွန်ုပ်အကောင့်')}
                      </Link>
                      <Link
                        href="/account/orders"
                        className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                        onClick={() => setShowDropdown(false)}
                      >
                        <ShoppingBag className="w-4 h-4" />
                        {tr('My Orders', 'ကျွန်ုပ်အော်ဒါများ')}
                      </Link>
                      {user.role === 'admin' && (
                        <Link
                          href="/admin"
                          className="flex items-center gap-3 px-3 py-2.5 text-sm text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-all"
                          onClick={() => setShowDropdown(false)}
                        >
                          <LayoutDashboard className="w-4 h-4" />
                          {tr('Admin Panel', 'အက်ဒမင်')}
                        </Link>
                      )}
                    </div>
                    <div className="p-2 border-t border-white/5">
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-3 py-2.5 w-full text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                      >
                        <LogOut className="w-4 h-4" />
                        {tr('Log Out', 'ထွက်မည်')}
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
                  {tr('Sign In', 'ဝင်မည်')}
                </Link>
              </div>
            )}

            {/* Mobile Toggle */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden p-2 text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-all"
            >
              {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-dark-900/95 backdrop-blur-xl border-t border-dark-600/50 animate-slide-up">
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
                  {tr('Profile', 'ပရိုဖိုင်')}
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
                  {tr('My Orders', 'ကျွန်ုပ်အော်ဒါများ')}
                </Link>
                {user.role === 'admin' && (
                  <Link
                    href="/admin"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-all"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    {tr('Admin Panel', 'အက်ဒမင်')}
                  </Link>
                )}
                <button
                  onClick={() => { setIsOpen(false); handleLogout(); }}
                  className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  {tr('Log Out', 'ထွက်မည်')}
                </button>
              </div>
            ) : (
              <div className="pt-4 mt-3 border-t border-dark-600/50 space-y-3">
                <Link
                  href="/login"
                  onClick={() => setIsOpen(false)}
                  className="block text-center px-4 py-3 text-gray-400 hover:text-white rounded-xl transition-colors"
                >
                  {tr('Sign In', 'ဝင်မည်')}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
