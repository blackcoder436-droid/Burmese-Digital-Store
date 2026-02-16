// ==========================================
// Structured Logger - Burmese Digital Store
// JSON-structured logging with levels & context
// S6: Sensitive data redaction + retention policy
// Ready for Logtail / Sentry / Datadog ingestion
// ==========================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ||
  (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// --- S6: Sensitive field redaction ---
// These keys will have their values replaced with '[REDACTED]' in log output.
// Pattern-matched (case-insensitive) against all keys in meta objects.
const REDACT_KEY_PATTERNS = [
  /authorization/i,
  /cookie/i,
  /token/i,
  /password/i,
  /resettoken/i,
  /secret/i,
  /jwt/i,
  /apikey/i,
  /api[_-]?key/i,
  /session/i,
  /credential/i,
  /smtp/i,
  /private/i,
];

// Redact sensitive string patterns in values (e.g. Bearer tokens, JWTs in freeform strings)
const REDACT_VALUE_PATTERNS = [
  { pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, replacement: 'Bearer [REDACTED]' },
  { pattern: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_.+/=]*/g, replacement: '[JWT_REDACTED]' },
];

function shouldRedactKey(key: string): boolean {
  return REDACT_KEY_PATTERNS.some((p) => p.test(key));
}

function redactValue(value: unknown): unknown {
  if (typeof value === 'string') {
    let result = value;
    for (const { pattern, replacement } of REDACT_VALUE_PATTERNS) {
      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0;
      result = result.replace(pattern, replacement);
    }
    return result;
  }
  return value;
}

/**
 * Deep-redact sensitive fields from a metadata object.
 * Returns a new object with sensitive values replaced by '[REDACTED]'.
 */
function redactMeta(obj: Record<string, unknown>, depth = 0): Record<string, unknown> {
  if (depth > 5) return { _truncated: true }; // Prevent infinite recursion

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (shouldRedactKey(key)) {
      result[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redactMeta(value as Record<string, unknown>, depth + 1);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item && typeof item === 'object'
          ? redactMeta(item as Record<string, unknown>, depth + 1)
          : redactValue(item)
      );
    } else {
      result[key] = redactValue(value);
    }
  }
  return result;
}

// --- S6: Log retention policy ---
// Production retention: 90 days (enforced by external log management)
// Development: no retention limit (console only)
export const LOG_RETENTION_DAYS = process.env.LOG_RETENTION_DAYS
  ? parseInt(process.env.LOG_RETENTION_DAYS, 10)
  : 90;

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  retentionDays?: number;
  [key: string]: unknown;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
}

function formatEntry(level: LogLevel, message: string, meta?: Record<string, unknown>): LogEntry {
  const safeMeta = meta ? redactMeta(meta) : undefined;
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: typeof message === 'string' ? String(redactValue(message)) : message,
    service: 'burmese-digital-store',
    ...safeMeta,
  };
  // Include retention hint for log management systems (Logtail/Datadog/Loki)
  if (process.env.NODE_ENV === 'production') {
    entry.retentionDays = LOG_RETENTION_DAYS;
  }
  return entry;
}

function emit(entry: LogEntry): void {
  const json = JSON.stringify(entry);
  switch (entry.level) {
    case 'error':
      console.error(json);
      break;
    case 'warn':
      console.warn(json);
      break;
    case 'debug':
      console.debug(json);
      break;
    default:
      console.log(json);
  }
}

/** Create a child logger with pre-bound context fields */
export function createLogger(context?: Record<string, unknown>) {
  const ctx = context ?? {};

  return {
    debug(message: string, meta?: Record<string, unknown>) {
      if (!shouldLog('debug')) return;
      emit(formatEntry('debug', message, { ...ctx, ...meta }));
    },
    info(message: string, meta?: Record<string, unknown>) {
      if (!shouldLog('info')) return;
      emit(formatEntry('info', message, { ...ctx, ...meta }));
    },
    warn(message: string, meta?: Record<string, unknown>) {
      if (!shouldLog('warn')) return;
      emit(formatEntry('warn', message, { ...ctx, ...meta }));
    },
    error(message: string, meta?: Record<string, unknown>) {
      if (!shouldLog('error')) return;
      emit(formatEntry('error', message, { ...ctx, ...meta }));
    },
    /** Create a child logger inheriting this context */
    child(extra: Record<string, unknown>) {
      return createLogger({ ...ctx, ...extra });
    },
  };
}

/** Default root logger */
const logger = createLogger();
export default logger;
