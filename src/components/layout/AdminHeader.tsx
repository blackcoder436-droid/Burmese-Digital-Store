'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ChevronDown,
  LogOut,
  User,
  ShoppingBag,
  Store,
} from 'lucide-react';
import { useLanguage } from '@/lib/language';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  avatar: string | null;
}

export default function AdminHeader() {
  const { lang, setLang, tr } = useLanguage();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchUser();
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
    } catch { /* */ }
  }

  async function handleLogout() {
    await fetch('/api/auth/me', { method: 'POST' });
    window.location.href = '/';
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-[#0a0a1a]/95 backdrop-blur-xl border-b border-purple-500/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
        {/* Left: Logo + Admin badge */}
        <div className="flex items-center gap-3">
          <Link href="/admin" className="flex items-center gap-3 group">
            <Image
              src="/logo.jpg"
              alt="Burmese Digital Store"
              width={36}
              height={36}
              priority
              className="rounded-xl shadow-glow-sm group-hover:shadow-glow transition-shadow duration-300"
            />
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white hidden sm:inline">
                Burmese<span className="text-accent-gradient"> Digital Store</span>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/25 text-[11px] font-semibold text-purple-400 uppercase tracking-wider">
                Admin
              </span>
            </div>
          </Link>
        </div>

        {/* Right: Store link + lang + theme + user */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Back to store */}
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-purple-500/20 transition-all"
          >
            <Store className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{tr('View Store', 'ဆိုင်ကိုကြည့်ရန်')}</span>
          </Link>

          {/* Language toggle */}
          <button
            onClick={() => setLang(lang === 'my' ? 'en' : 'my')}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-dark-800/80 border border-dark-600/50 text-xs font-medium text-gray-300 hover:border-purple-500/50 hover:text-white transition-all"
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

          {/* User dropdown */}
          {user && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-dark-800/80 border border-dark-600/50 hover:border-purple-500/50 transition-all"
              >
                <div className="w-7 h-7 rounded-lg overflow-hidden bg-gradient-to-br from-purple-400 to-cyan-500 flex items-center justify-center">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-white">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-52 bg-[#12122a] border border-purple-500/20 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-white/5 bg-gradient-to-r from-purple-500/10 to-transparent">
                    <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{user.email}</p>
                  </div>
                  <div className="p-1.5">
                    <Link
                      href="/account"
                      className="flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                      onClick={() => setShowDropdown(false)}
                    >
                      <User className="w-4 h-4" />
                      {tr('My Account', 'ကျွန်ုပ်အကောင့်')}
                    </Link>
                    <Link
                      href="/account/orders"
                      className="flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                      onClick={() => setShowDropdown(false)}
                    >
                      <ShoppingBag className="w-4 h-4" />
                      {tr('My Orders', 'ကျွန်ုပ်အော်ဒါများ')}
                    </Link>
                  </div>
                  <div className="p-1.5 border-t border-white/5">
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 px-3 py-2 w-full text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      <LogOut className="w-4 h-4" />
                      {tr('Log Out', 'ထွက်မည်')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
