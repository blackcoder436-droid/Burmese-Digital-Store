'use client';

import { RefreshCw, ShieldAlert } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="my" className="dark">
      <body className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a1a] text-white px-4">
        <div
          className="text-center max-w-md"
          style={{
            animation: 'fadeInUp 0.6s ease-out both',
          }}
        >
          {/* Icon */}
          <div
            className="w-24 h-24 mx-auto mb-6 flex items-center justify-center rounded-2xl"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
            }}
          >
            <ShieldAlert className="w-10 h-10" style={{ color: '#f87171' }} />
          </div>

          <h1
            style={{
              fontSize: 'clamp(1.5rem, 4vw, 2rem)',
              fontWeight: 800,
              marginBottom: '0.75rem',
              letterSpacing: '-0.02em',
            }}
          >
            Critical Error
          </h1>
          <p style={{ color: '#9ca3af', marginBottom: '2rem', lineHeight: 1.6 }}>
            Something went seriously wrong. Please refresh the page.
          </p>
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-6 py-3 font-semibold rounded-xl transition-all duration-300"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Page
          </button>
        </div>

        {/* Inline keyframes since globals.css may not be available */}
        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(24px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </body>
    </html>
  );
}
