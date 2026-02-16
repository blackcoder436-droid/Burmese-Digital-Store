import { createLogger } from '@/lib/logger';

// ==========================================
// Security Monitoring & Alerts (S10)
// Burmese Digital Store
//
// In-process alert tracking for suspicious activity.
// Logs alerts as structured JSON for external ingestion
// (Logtail, Datadog, Loki, etc.)
//
// Tracked events:
// - Repeated login failures (brute force detection)
// - Password reset spikes (account takeover attempts)
// - Admin seed endpoint hits
// - Rate limit 503 spikes
// - Admin privilege changes (promote/demote)
// - VPN server URL changes
// - Export endpoint usage
// ==========================================

const log = createLogger({ module: 'security-monitor' });

// In-memory sliding window counters (per server instance)
// In production, this should be backed by Redis for multi-instance support
interface WindowCounter {
  count: number;
  windowStart: number;
  events: { timestamp: number; meta?: Record<string, unknown> }[];
}

const counters = new Map<string, WindowCounter>();

const WINDOW_MS = 5 * 60 * 1000; // 5-minute sliding window
const MAX_EVENTS_STORED = 100; // Max events stored per counter for memory safety

function getOrCreateCounter(key: string): WindowCounter {
  const now = Date.now();
  let counter = counters.get(key);

  if (!counter || now - counter.windowStart > WINDOW_MS) {
    counter = { count: 0, windowStart: now, events: [] };
    counters.set(key, counter);
  }

  // Prune old events
  counter.events = counter.events.filter((e) => now - e.timestamp < WINDOW_MS);
  counter.count = counter.events.length;

  return counter;
}

function incrementCounter(key: string, meta?: Record<string, unknown>): number {
  const counter = getOrCreateCounter(key);
  counter.events.push({ timestamp: Date.now(), meta });

  // Memory safety — trim oldest events
  if (counter.events.length > MAX_EVENTS_STORED) {
    counter.events = counter.events.slice(-MAX_EVENTS_STORED);
  }

  counter.count = counter.events.length;
  return counter.count;
}

// --- Alert Thresholds ---
const THRESHOLDS = {
  LOGIN_FAILURES_PER_IP: parseInt(process.env.ALERT_LOGIN_FAILURES_THRESHOLD || '10', 10),
  LOGIN_FAILURES_GLOBAL: parseInt(process.env.ALERT_LOGIN_FAILURES_GLOBAL || '50', 10),
  PASSWORD_RESET_SPIKE: parseInt(process.env.ALERT_PASSWORD_RESET_THRESHOLD || '20', 10),
  RATE_LIMIT_SPIKE: parseInt(process.env.ALERT_RATE_LIMIT_THRESHOLD || '100', 10),
  SEED_ENDPOINT_HITS: 1, // Any seed endpoint hit in production is suspicious
};

// --- Alert Emitters ---

/**
 * Track a failed login attempt. Alerts on brute force patterns.
 */
export function trackLoginFailure(ip: string, email?: string): void {
  const perIpCount = incrementCounter(`login_fail:ip:${ip}`, { email });
  const globalCount = incrementCounter('login_fail:global', { ip, email });

  if (perIpCount >= THRESHOLDS.LOGIN_FAILURES_PER_IP) {
    log.warn('ALERT: Repeated login failures from single IP', {
      alert: 'brute_force_suspected',
      severity: 'high',
      ip,
      count: perIpCount,
      window: '5min',
      lastEmail: email,
    });
  }

  if (globalCount >= THRESHOLDS.LOGIN_FAILURES_GLOBAL) {
    log.warn('ALERT: Login failure spike (global)', {
      alert: 'login_failure_spike',
      severity: 'high',
      count: globalCount,
      window: '5min',
    });
  }
}

/**
 * Track password reset requests. Alerts on unusual spikes.
 */
export function trackPasswordResetRequest(ip: string, email: string): void {
  const count = incrementCounter('password_reset:global', { ip, email });
  const perIpCount = incrementCounter(`password_reset:ip:${ip}`, { email });

  if (count >= THRESHOLDS.PASSWORD_RESET_SPIKE) {
    log.warn('ALERT: Password reset request spike', {
      alert: 'password_reset_spike',
      severity: 'medium',
      count,
      window: '5min',
    });
  }

  if (perIpCount >= 5) {
    log.warn('ALERT: Multiple password reset requests from single IP', {
      alert: 'password_reset_abuse',
      severity: 'medium',
      ip,
      count: perIpCount,
      window: '5min',
    });
  }
}

/**
 * Track admin seed endpoint access. Any hit in production is suspicious.
 */
export function trackSeedEndpointHit(ip: string, success: boolean): void {
  const count = incrementCounter('seed_endpoint:global', { ip, success });

  log.warn('ALERT: Admin seed endpoint accessed', {
    alert: 'seed_endpoint_hit',
    severity: success ? 'critical' : 'high',
    ip,
    success,
    totalHits: count,
  });
}

/**
 * Track rate limit 503 responses. Alerts on spikes indicating attack or misconfiguration.
 */
export function trackRateLimitHit(ip: string, endpoint: string): void {
  const count = incrementCounter('rate_limit:global', { ip, endpoint });
  const perIpCount = incrementCounter(`rate_limit:ip:${ip}`, { endpoint });

  if (count >= THRESHOLDS.RATE_LIMIT_SPIKE) {
    log.warn('ALERT: Rate limit spike (global)', {
      alert: 'rate_limit_spike',
      severity: 'medium',
      count,
      window: '5min',
    });
  }

  if (perIpCount >= 30) {
    log.warn('ALERT: Excessive rate limiting for single IP', {
      alert: 'rate_limit_abuse',
      severity: 'medium',
      ip,
      count: perIpCount,
      endpoint,
      window: '5min',
    });
  }
}

/**
 * Track admin privilege changes (promote/demote).
 */
export function trackAdminPrivilegeChange(
  adminId: string,
  targetUserId: string,
  action: 'promote' | 'demote',
  targetEmail?: string
): void {
  log.info('AUDIT: Admin privilege change', {
    alert: 'admin_privilege_change',
    severity: 'high',
    adminId,
    targetUserId,
    targetEmail,
    action,
  });

  const count = incrementCounter('admin_privilege:global', {
    adminId,
    targetUserId,
    action,
  });

  // Multiple privilege changes in short time is unusual
  if (count >= 5) {
    log.warn('ALERT: Rapid admin privilege changes', {
      alert: 'privilege_change_spike',
      severity: 'high',
      count,
      window: '5min',
    });
  }
}

/**
 * Track VPN server configuration changes (URL changes are SSRF-sensitive).
 */
export function trackVpnServerChange(
  adminId: string,
  serverId: string,
  action: 'create' | 'update' | 'delete',
  changes?: Record<string, unknown>
): void {
  log.info('AUDIT: VPN server configuration change', {
    alert: 'vpn_server_change',
    severity: 'medium',
    adminId,
    serverId,
    action,
    changes,
  });
}

/**
 * Track data export usage.
 */
export function trackDataExport(
  adminId: string,
  exportType: string,
  recordCount: number
): void {
  log.info('AUDIT: Data export', {
    alert: 'data_export',
    severity: 'low',
    adminId,
    exportType,
    recordCount,
  });

  const count = incrementCounter('data_export:global', {
    adminId,
    exportType,
  });

  // Unusual export activity
  if (count >= 10) {
    log.warn('ALERT: Excessive data export activity', {
      alert: 'export_spike',
      severity: 'medium',
      count,
      window: '5min',
    });
  }
}

/**
 * Get current monitoring counters summary (for admin dashboard, if needed).
 */
export function getMonitoringSummary(): Record<string, number> {
  const summary: Record<string, number> = {};
  const now = Date.now();

  for (const [key, counter] of counters.entries()) {
    // Only include active windows
    const activeEvents = counter.events.filter((e) => now - e.timestamp < WINDOW_MS);
    if (activeEvents.length > 0) {
      summary[key] = activeEvents.length;
    }
  }

  return summary;
}
