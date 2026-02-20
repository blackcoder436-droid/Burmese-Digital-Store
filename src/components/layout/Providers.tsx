'use client';

import { ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import { LanguageProvider } from '@/lib/language';
import { CartProvider } from '@/lib/cart';
import { WishlistProvider } from '@/lib/wishlist';
import { WebVitalsReporter } from '@/components/WebVitalsReporter';
import { PwaInstallPrompt } from '@/components/PwaInstallPrompt';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <CartProvider>
        <WishlistProvider>
          <WebVitalsReporter />
          <PwaInstallPrompt />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#12122a',
                color: '#e2e8f0',
                border: '1px solid rgba(108,92,231,0.2)',
                borderRadius: '12px',
                fontSize: '14px',
              },
              success: {
                iconTheme: { primary: '#10b981', secondary: '#12122a' },
              },
              error: {
                iconTheme: { primary: '#ef4444', secondary: '#12122a' },
              },
            }}
          />
          {children}
        </WishlistProvider>
      </CartProvider>
    </LanguageProvider>
  );
}