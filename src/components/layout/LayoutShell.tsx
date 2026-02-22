'use client';

import { usePathname } from 'next/navigation';
import { ReactNode, lazy, Suspense } from 'react';

const AiChatWidget = lazy(() => import('@/components/AiChatWidget'));

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
      {/* AI Chat Widget - only on customer-facing pages */}
      {!isAdmin && (
        <Suspense fallback={null}>
          <AiChatWidget />
        </Suspense>
      )}
    </>
  );
}
