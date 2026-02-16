import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for Burmese Digital Store. Read our terms and conditions for using our digital products and services.',
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
