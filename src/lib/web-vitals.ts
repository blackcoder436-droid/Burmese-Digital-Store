// ==========================================
// Web Vitals Performance Monitoring
// Burmese Digital Store
//
// Tracks Core Web Vitals (LCP, FID, CLS, FCP, TTFB, INP)
// Reports to /api/analytics/vitals endpoint
// Uses web-vitals library (built into Next.js)
// ==========================================

import type { Metric } from 'web-vitals';

const VITALS_ENDPOINT = '/api/analytics/vitals';

// Batch vitals to reduce API calls
let vitalsQueue: VitalEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

interface VitalEntry {
  name: string;
  value: number;
  rating: string;
  delta: number;
  id: string;
  navigationType: string;
  url: string;
  timestamp: number;
}

function queueVital(metric: Metric) {
  const entry: VitalEntry = {
    name: metric.name,
    value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value), // CLS is unitless, multiply for precision
    rating: metric.rating,
    delta: Math.round(metric.delta),
    id: metric.id,
    navigationType: metric.navigationType || 'unknown',
    url: typeof window !== 'undefined' ? window.location.pathname : '',
    timestamp: Date.now(),
  };

  vitalsQueue.push(entry);

  // Flush after 5 seconds or when we have 10+ entries
  if (vitalsQueue.length >= 10) {
    flushVitals();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flushVitals, 5000);
  }
}

function flushVitals() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (vitalsQueue.length === 0) return;

  const batch = [...vitalsQueue];
  vitalsQueue = [];

  // Use sendBeacon for reliability (works even during page unload)
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify({ vitals: batch })], {
      type: 'application/json',
    });
    navigator.sendBeacon(VITALS_ENDPOINT, blob);
  } else {
    // Fallback to fetch
    fetch(VITALS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vitals: batch }),
      keepalive: true,
    }).catch(() => {
      // Silently fail — analytics should never break the app
    });
  }
}

/**
 * Report a web vital metric. Called by Next.js reportWebVitals.
 */
export function reportWebVital(metric: Metric) {
  queueVital(metric);

  // Also log to console in development
  if (process.env.NODE_ENV === 'development') {
    const color = metric.rating === 'good' ? '🟢' : metric.rating === 'needs-improvement' ? '🟡' : '🔴';
    console.log(`${color} ${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`);
  }
}

// Flush remaining vitals on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushVitals();
    }
  });
}
