'use client';

import { useEffect } from 'react';
import { reportWebVital } from '@/lib/web-vitals';

/**
 * Web Vitals reporter component.
 * Mounted once in root layout to track Core Web Vitals.
 * Uses web-vitals library directly (App Router compatible).
 */
export function WebVitalsReporter() {
  useEffect(() => {
    // Dynamically import web-vitals to avoid SSR issues
    import('web-vitals').then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
      onCLS(reportWebVital);
      onFCP(reportWebVital);
      onINP(reportWebVital);
      onLCP(reportWebVital);
      onTTFB(reportWebVital);
    }).catch(() => {
      // web-vitals may not be available — silently fail
    });
  }, []);

  return null; // No visual output
}
