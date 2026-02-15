// ==========================================
// Structured Logger - Burmese Digital Store
// JSON-structured logging with levels & context
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

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  [key: string]: unknown;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
}

function formatEntry(level: LogLevel, message: string, meta?: Record<string, unknown>): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: 'burmese-digital-store',
    ...meta,
  };
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
