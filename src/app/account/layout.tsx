import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Account — Burmese Digital Store',
  description: 'Manage your account, view orders, and access your purchased digital products.',
};

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
