import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your Burmese Digital Store account to manage orders, view purchased keys, and access VPN services.',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
