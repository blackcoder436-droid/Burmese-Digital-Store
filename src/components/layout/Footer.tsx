'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/lib/language';

export default function Footer() {
  const { tr } = useLanguage();

  return (
    <footer className="bg-dark-900 border-t border-dark-600/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Brand — wider column */}
          <div className="lg:col-span-4">
            <Link href="/" className="inline-flex items-center gap-2">
              <Image
                src="/logo.jpg"
                alt="Burmese Digital Store"
                width={36}
                height={36}
                loading="lazy"
                className="rounded-lg"
              />
              <span className="text-lg font-bold text-white">
                Burmese<span className="text-accent-gradient"> Digital Store</span>
              </span>
            </Link>
            <p className="mt-3 text-sm text-gray-500 leading-relaxed max-w-xs">
              {tr(
                'Your trusted source for premium digital products — VPN, streaming, gaming & more.',
                'VPN၊ streaming၊ gaming စသည့် premium digital products များအတွက် ယုံကြည်ရသော အရင်းအမြစ်။'
              )}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 lg:col-span-4">
            {/* Quick Links */}
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                {tr('Shop', 'ဆိုင်')}
              </h4>
              <ul className="space-y-2.5">
                {[
                  { label: tr('VPN Accounts', 'VPN အကောင့်များ'), href: '/shop?category=vpn' },
                  { label: 'Streaming', href: '/shop?category=streaming' },
                  { label: 'Gaming', href: '/shop?category=gaming' },
                  { label: 'Software', href: '/shop?category=software' },
                ].map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-gray-500 hover:text-purple-400 transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                {tr('Support', 'ပံ့ပိုးမှု')}
              </h4>
              <ul className="space-y-2.5">
                {[
                  { label: tr('Contact Us', 'ဆက်သွယ်ရန်'), href: '/contact' },
                  { label: tr('VPN Plans', 'VPN အစီအစဉ်များ'), href: '/vpn' },
                  { label: tr('My Account', 'ကျွန်ုပ်အကောင့်'), href: '/account' },
                  { label: tr('My Orders', 'ကျွန်ုပ်၏အော်ဒါများ'), href: '/account/orders' },
                ].map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-gray-500 hover:text-purple-400 transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="lg:col-span-4">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
              {tr('We Accept', 'ငွေပေးချေနည်းများ')}
            </h4>
            <div className="flex flex-wrap gap-2">
              {['KBZ Pay', 'WaveMoney', 'UAB Pay', 'AYA Pay'].map((method) => (
                <span
                  key={method}
                  className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-medium text-gray-300 bg-dark-800 border border-dark-600/50"
                >
                  {method}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-dark-600/30 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-600">
            &copy; {new Date().getFullYear()} Burmese Digital Store. {tr('All rights reserved.', 'မူပိုင်ခွင့်များအားလုံးကို သိမ်းဆည်းထားသည်။')}
          </p>
          <div className="flex items-center gap-5 text-xs text-gray-600">
            <Link href="/terms" className="hover:text-purple-400 transition-colors">{tr('Terms', 'စည်းကမ်းချက်များ')}</Link>
            <Link href="/privacy" className="hover:text-purple-400 transition-colors">{tr('Privacy', 'ကိုယ်ရေးလုံခြုံမှု')}</Link>
            <Link href="/refund-policy" className="hover:text-purple-400 transition-colors">{tr('Refund Policy', 'ငွေပြန်အမ်းမူဝါဒ')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
