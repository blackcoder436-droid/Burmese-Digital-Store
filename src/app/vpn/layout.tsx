import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'VPN Plans — Express VPN Myanmar',
  description: 'Get Express VPN accounts at the best prices in Myanmar. 1-5 devices, 1 month to 2 years. Secure browsing with instant setup.',
  openGraph: {
    title: 'VPN Plans — Burmese Digital Store',
    description: 'Express VPN at the best prices in Myanmar',
  },
};

export default function VpnLayout({ children }: { children: React.ReactNode }) {
  return children;
}
