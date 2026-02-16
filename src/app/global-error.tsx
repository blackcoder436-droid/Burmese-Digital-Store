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
      <body style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a1a',
        color: 'white',
        padding: '1rem',
        margin: 0,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background glow */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '400px',
          height: '400px',
          background: 'rgba(239, 68, 68, 0.05)',
          borderRadius: '50%',
          filter: 'blur(120px)',
          pointerEvents: 'none',
        }} />

        <div
          style={{
            textAlign: 'center',
            maxWidth: '28rem',
            position: 'relative',
            zIndex: 1,
            animation: 'fadeInUp 0.6s ease-out both',
          }}
        >
          {/* Icon with glow */}
          <div style={{ position: 'relative', width: '7rem', height: '7rem', margin: '0 auto 2rem' }}>
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '1rem',
              filter: 'blur(16px)',
              animation: 'pulse 2s ease-in-out infinite',
            }} />
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '1rem',
                background: '#12122a',
                border: '1px solid rgba(239, 68, 68, 0.2)',
              }}
            >
              <ShieldAlert style={{ width: '3rem', height: '3rem', color: '#f87171' }} />
            </div>
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
          <p style={{ color: '#9ca3af', marginBottom: '0.75rem', lineHeight: 1.6 }}>
            Something went seriously wrong. Please refresh the page.
          </p>

          {error.digest && (
            <p style={{ color: '#4b5563', fontSize: '0.75rem', fontFamily: 'monospace', marginBottom: '1.5rem' }}>
              Error ID: {error.digest}
            </p>
          )}

          <button
            onClick={reset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              fontWeight: 600,
              borderRadius: '0.75rem',
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              transition: 'transform 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <RefreshCw style={{ width: '1rem', height: '1rem' }} />
            Refresh Page
          </button>
        </div>

        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(24px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 1; }
          }
        `}</style>
      </body>
    </html>
  );
}
