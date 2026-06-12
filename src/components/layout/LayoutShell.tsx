'use client';

import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import AiChatWidget from '@/components/AiChatWidget';

interface LayoutShellProps {
  navbar: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}

export function LayoutShell({ navbar, footer, children }: LayoutShellProps) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');

  return (
    <>
      {!isAdmin && navbar}
      <main className={`flex-1 ${isAdmin ? 'pt-[64px]' : 'pt-16'} relative z-10`}>
        {children}
      </main>
      {!isAdmin && footer}
      {/* AI Chat Widget */}
      {!isAdmin && (
        <AiChatWidget />
      )}
    </>
  );
}
