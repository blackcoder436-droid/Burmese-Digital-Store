import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import TechBackground from '@/components/TechBackground';
import { LayoutShell } from '@/components/layout/LayoutShell';
import { Providers } from '@/components/layout/Providers';
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
    <html lang="my" className="dark">
      <head>
        {/* PWA meta tags */}
        <meta name="theme-color" content="#6c5ce7" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" />
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
