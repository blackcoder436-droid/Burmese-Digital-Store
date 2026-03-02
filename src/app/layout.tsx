import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Inter, Noto_Sans_Myanmar } from 'next/font/google';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import LazyTechBackground from '@/components/LazyTechBackground';
import { LayoutShell } from '@/components/layout/LayoutShell';
import { Providers } from '@/components/layout/Providers';
import { getOrganizationJsonLd, getWebsiteJsonLd } from '@/lib/jsonld';
import './globals.css';

// ── Optimized font loading via next/font (self-hosted, zero render-blocking) ──
const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-inter',
});

const notoSansMyanmar = Noto_Sans_Myanmar({
  subsets: ['myanmar'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-noto-myanmar',
});

export const metadata: Metadata = {
  title: {
    default: 'Burmese Digital Store — Premium Digital Products',
    template: '%s | Burmese Digital Store',
  },
  description:
    "Myanmar's trusted digital store for VPN accounts, streaming subscriptions, gaming credits, and more. Instant delivery with verified payments.",
  keywords: ['digital store', 'VPN', 'Myanmar', 'Kpay', 'WaveMoney', 'streaming', 'gaming', 'software', 'gift card', 'Netflix', 'Express VPN'],
  metadataBase: new URL('https://burmesedigital.store'),
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Burmese Digital Store',
    description: 'Premium Digital Products — Instant Delivery in Myanmar',
    url: 'https://burmesedigital.store',
    siteName: 'Burmese Digital Store',
    images: [
      {
        url: '/logo.jpg',
        width: 512,
        height: 512,
        alt: 'Burmese Digital Store Logo',
      },
    ],
    type: 'website',
    locale: 'my_MM',
  },
  twitter: {
    card: 'summary',
    title: 'Burmese Digital Store',
    description: 'Premium Digital Products — Instant Delivery in Myanmar',
    images: ['/logo.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BD Store',
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
    <html lang="my" className={`dark ${inter.variable} ${notoSansMyanmar.variable}`}>
      <head>
        {/* PWA meta tags */}
        <meta name="theme-color" content="#6c5ce7" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
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
        {/* ── Global animated tech network background (lazy loaded) ── */}
        <LazyTechBackground />

        <Providers>
          <LayoutShell
            navbar={<Navbar />}
            footer={<Footer />}
          >
            <main id="main-content">
              {children}
            </main>
          </LayoutShell>
        </Providers>
      </body>
    </html>
  );
}
