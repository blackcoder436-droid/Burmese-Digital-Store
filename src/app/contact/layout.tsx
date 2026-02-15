import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with Burmese Digital Store. We respond within 24 hours. Available via email, Telegram, and Viber.',
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
