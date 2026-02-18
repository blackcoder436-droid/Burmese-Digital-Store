import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Toaster } from 'react-hot-toast';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import TechBackground from '@/components/TechBackground';
import { LanguageProvider } from '@/lib/language';
import { CartProvider } from '@/lib/cart';
import { LayoutShell } from '@/components/layout/LayoutShell';
import { getOrganizationJsonLd, getWebsiteJsonLd } from '@/lib/jsonld';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Burmese Digital Store — Premium Digital Products',
    template: '%s | Burmese Digital Store',
  },
  description:
    "Myanmar's trusted digital store for VPN accounts, streaming subscriptions, gaming credits, and more. Instant delivery with verified payments.",
  keywords: ['digital store', 'VPN', 'Myanmar', 'Kpay', 'WaveMoney', 'streaming', 'gaming', 'software', 'gift card', 'Netflix', 'Express VPN'],
  metadataBase: new URL('https://burmesedigital.store'),
  openGraph: {
    title: 'Burmese Digital Store',
    description: 'Premium Digital Products — Instant Delivery in Myanmar',
    url: 'https://burmesedigital.store',
    siteName: 'Burmese Digital Store',
    type: 'website',
    locale: 'my_MM',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Burmese Digital Store',
    description: 'Premium Digital Products — Instant Delivery in Myanmar',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read CSP nonce from request headers (set by middleware)
  const headersList = await headers();
  const nonce = headersList.get('x-nonce') ?? '';

  return (
    <html lang="my" className="dark">
      <head>
        {/* JSON-LD Structured Data for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(getOrganizationJsonLd()),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(getWebsiteJsonLd()),
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-[#0a0a1a]" suppressHydrationWarning>
        {/* ── Global animated tech network background ── */}
        <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
          <TechBackground />
        </div>

        <LanguageProvider>
          <CartProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#12122a',
                color: '#e2e8f0',
                border: '1px solid rgba(108,92,231,0.2)',
                borderRadius: '12px',
                fontSize: '14px',
              },
              success: {
                iconTheme: { primary: '#10b981', secondary: '#12122a' },
              },
              error: {
                iconTheme: { primary: '#ef4444', secondary: '#12122a' },
              },
            }}
          />
          <LayoutShell
            navbar={<Navbar />}
            footer={<Footer />}
          >
            <main id="main-content">
              {children}
            </main>
          </LayoutShell>
          </CartProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
