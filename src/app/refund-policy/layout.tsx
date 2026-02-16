import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Refund Policy',
  description: 'Refund Policy for Burmese Digital Store. Understand our refund and return policies for digital products.',
};

export default function RefundPolicyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
