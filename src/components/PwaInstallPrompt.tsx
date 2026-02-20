'use client';

// ==========================================
// PWA Install Prompt + Service Worker Registration
// Phase 10.2 — Progressive Web App support
// ==========================================

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useLanguage } from '@/lib/language';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallPrompt() {
  const { lang } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch(() => {
          // SW registration failed — non-critical
        });
    }

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show banner after 30 seconds of browsing
      const alreadyDismissed = localStorage.getItem('pwa-install-dismissed');
      if (!alreadyDismissed) {
        setTimeout(() => setShowBanner(true), 30000);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (!showBanner || dismissed || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:max-w-sm animate-slide-up">
      <div className="bg-dark-800 border border-purple-500/30 rounded-2xl p-4 shadow-glow-lg backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-xl flex items-center justify-center">
            <Download className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">
              {lang === 'my' ? 'App ထည့်သွင်းပါ' : 'Install App'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {lang === 'my'
                ? 'Home screen မှ အလွယ်တကူ ဝင်ရောက်နိုင်ပါတယ်'
                : 'Quick access from your home screen'}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleInstall}
            className="flex-1 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white text-sm font-medium py-2 px-4 rounded-xl transition-all"
          >
            {lang === 'my' ? 'ထည့်သွင်းမယ်' : 'Install'}
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            {lang === 'my' ? 'နောက်မှ' : 'Later'}
          </button>
        </div>
      </div>
    </div>
  );
}
