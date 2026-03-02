'use client';

import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ReactNode } from 'react';

const AiChatWidget = dynamic(() => import('@/components/AiChatWidget'), {
  ssr: false,
});

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
      <main className={`flex-1 ${isAdmin ? 'pt-16' : 'pt-16'} relative z-10`}>
        {children}
      </main>
      {!isAdmin && footer}
      {/* AI Chat Widget - temporarily hidden from users */}
      {/* {!isAdmin && (
        <AiChatWidget />
      )} */}
    </>
  );
}
