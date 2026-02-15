import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shop — Browse Digital Products',
  description: 'Browse VPN accounts, streaming subscriptions, gaming credits, software licenses, and gift cards. Pay with KBZ Pay, WaveMoney, CB Pay. Instant delivery in Myanmar.',
  openGraph: {
    title: 'Shop — Burmese Digital Store',
    description: 'Browse & buy premium digital products with instant delivery',
  },
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}
