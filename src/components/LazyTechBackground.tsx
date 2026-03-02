'use client';

import { lazy, Suspense, useEffect, useState } from 'react';

const TechBackground = lazy(() => import('@/components/TechBackground'));

/**
 * Deferred TechBackground loader.
 * Waits until after initial paint (requestIdleCallback) before loading
 * the heavy canvas animation, so it doesn't block FCP/LCP.
 */
export default function LazyTechBackground() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Defer until browser is idle, or after 1.5s max
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(() => setReady(true), { timeout: 1500 });
      return () => cancelIdleCallback(id);
    } else {
      const timer = setTimeout(() => setReady(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!ready) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
      <Suspense fallback={null}>
        <TechBackground />
      </Suspense>
    </div>
  );
}
