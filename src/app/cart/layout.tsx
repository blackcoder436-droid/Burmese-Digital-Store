import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shopping Cart',
  description: 'Review your items and proceed to checkout at Burmese Digital Store.',
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
