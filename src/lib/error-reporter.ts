import { createLogger } from '@/lib/logger';

// ==========================================
// Error Reporting — Burmese Digital Store
// Lightweight error tracking via Telegram + structured logs
// No external service dependency (Sentry alternative)
//
// Set TELEGRAM_ERROR_CHANNEL_ID for error alerts
// Falls back to TELEGRAM_CHANNEL_ID if not set
// ==========================================

const log = createLogger({ module: 'error-reporter' });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ERROR_CHANNEL_ID =
  process.env.TELEGRAM_ERROR_CHANNEL_ID || process.env.TELEGRAM_CHANNEL_ID;

interface ErrorReport {
  /** Error message */
  message: string;
  /** Where the error occurred (API route, component, etc.) */
  source: string;
  /** Stack trace (truncated) */
  stack?: string;
  /** User ID if authenticated */
  userId?: string;
  /** HTTP method + path */
  request?: string;
  /** Additional context */
  metadata?: Record<string, unknown>;
  /** Error severity */
  severity?: 'error' | 'warning' | 'critical';
}

// Rate limiting: don't spam Telegram with the same error
const errorCounts = new Map<string, { count: number; lastSent: number }>();
const ERROR_DEDUP_WINDOW = 5 * 60 * 1000; // 5 minutes
const MAX_ERRORS_PER_WINDOW = 3; // Max 3 alerts per error fingerprint per window

/**
 * Generate a fingerprint for deduplication.
 */
function getErrorFingerprint(report: ErrorReport): string {
  return `${report.source}:${report.message.slice(0, 100)}`;
}

/**
 * Check if this error should be sent (rate limit).
 */
function shouldSendAlert(fingerprint: string): boolean {
  const now = Date.now();
  const entry = errorCounts.get(fingerprint);

  if (!entry || now - entry.lastSent > ERROR_DEDUP_WINDOW) {
    errorCounts.set(fingerprint, { count: 1, lastSent: now });
    return true;
  }

  if (entry.count < MAX_ERRORS_PER_WINDOW) {
    entry.count++;
    return true;
  }

  return false; // Rate limited
}

/**
 * Report an error to Telegram channel + structured log.
 */
export async function reportError(report: ErrorReport): Promise<void> {
  const severity = report.severity || 'error';

  // Always log structured error
  log[severity === 'critical' ? 'error' : severity === 'warning' ? 'warn' : 'error'](
    report.message,
    {
      source: report.source,
      userId: report.userId,
      request: report.request,
      ...(report.metadata || {}),
      stack: report.stack?.slice(0, 500),
    }
  );

  // Send to Telegram if configured
  if (!BOT_TOKEN || !ERROR_CHANNEL_ID) return;

  const fingerprint = getErrorFingerprint(report);
  if (!shouldSendAlert(fingerprint)) return;

  try {
    const icon =
      severity === 'critical' ? '🚨' : severity === 'warning' ? '⚠️' : '❌';

    const lines = [
      `${icon} <b>${severity.toUpperCase()}</b>`,
      ``,
      `<b>Message:</b> <code>${escapeHtml(report.message.slice(0, 200))}</code>`,
      `<b>Source:</b> ${escapeHtml(report.source)}`,
    ];

    if (report.request) {
      lines.push(`<b>Request:</b> ${escapeHtml(report.request)}`);
    }
    if (report.userId) {
      lines.push(`<b>User:</b> ${escapeHtml(report.userId)}`);
    }
    if (report.stack) {
      lines.push(`<pre>${escapeHtml(report.stack.slice(0, 300))}</pre>`);
    }
    if (report.metadata) {
      const meta = JSON.stringify(report.metadata, null, 0).slice(0, 200);
      lines.push(`<b>Meta:</b> <code>${escapeHtml(meta)}</code>`);
    }

    lines.push(``, `<i>${new Date().toISOString()}</i>`);

    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ERROR_CHANNEL_ID,
          text: lines.join('\n'),
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      }
    );

    if (!res.ok) {
      const data = await res.json();
      log.warn('Error report to Telegram failed', { error: data.description });
    }
  } catch (err) {
    log.warn('Error report send failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Convenience: report a caught Error object.
 */
export async function captureException(
  error: unknown,
  context?: { source?: string; userId?: string; request?: string; metadata?: Record<string, unknown> }
): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error));
  await reportError({
    message: err.message,
    source: context?.source || 'unknown',
    stack: err.stack,
    userId: context?.userId,
    request: context?.request,
    metadata: context?.metadata,
    severity: 'error',
  });
}

/**
 * Report a critical error (highest severity — always alerts).
 */
export async function reportCritical(
  message: string,
  context?: { source?: string; userId?: string; request?: string; metadata?: Record<string, unknown> }
): Promise<void> {
  await reportError({
    message,
    source: context?.source || 'unknown',
    userId: context?.userId,
    request: context?.request,
    metadata: context?.metadata,
    severity: 'critical',
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Periodic cleanup of dedup map (every 10 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of errorCounts) {
      if (now - entry.lastSent > ERROR_DEDUP_WINDOW * 2) {
        errorCounts.delete(key);
      }
    }
  }, 10 * 60 * 1000);
}
