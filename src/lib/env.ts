import { z } from 'zod';

// ==========================================
// Environment Variable Validation
// Burmese Digital Store
//
// Validates all required env vars at startup.
// Catches missing/invalid config early instead of runtime crashes.
// ==========================================

const serverSchema = z.object({
  // Required
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters for security'),

  // App
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url('NEXT_PUBLIC_APP_URL must be a valid URL')
    .default('http://localhost:3000'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Email (optional in dev, required in production)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional().default('noreply@burmesedigital.store'),
  EMAIL_FROM_NAME: z.string().optional().default('Burmese Digital Store'),

  // Rate Limiting — Upstash Redis
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  RATE_LIMIT_FAIL_CLOSED: z
    .enum(['true', 'false'])
    .optional()
    .default('false'),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().optional(),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHANNEL_ID: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  TELEGRAM_ERROR_CHANNEL_ID: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),

  // Storage
  STORAGE_PROVIDER: z
    .enum(['local', 's3', 'telegram'])
    .optional()
    .default('local'),

  // S3 (required if STORAGE_PROVIDER=s3)
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_CDN_URL: z.string().optional(),

  // VPN / 3xUI
  XUI_USERNAME: z.string().optional(),
  XUI_PASSWORD: z.string().optional(),
  VPN_SERVER_ALLOWED_HOSTS: z.string().optional(),

  // OCR
  OCR_LANGUAGE: z.string().optional().default('eng'),

  // AI Chat Assistant
  AI_API_KEY: z.string().optional(),
  AI_API_URL: z.string().url().optional().default('https://generativelanguage.googleapis.com/v1beta/openai'),
  AI_MODEL: z.string().optional().default('gemini-2.0-flash'),
  AI_CHAT_ENABLED: z.enum(['true', 'false']).optional().default('false'),

  // Admin
  ENABLE_ADMIN_SEED: z.enum(['true', 'false']).optional().default('false'),
  ADMIN_SECRET: z.string().optional(),

  // Logging
  LOG_RETENTION_DAYS: z.string().optional().default('90'),
  LOG_LEVEL: z
    .enum(['debug', 'info', 'warn', 'error'])
    .optional()
    .default('info'),
});

// Client-side public env vars
const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_APP_NAME: z.string().default('Burmese Digital Store'),
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().optional(),
  NEXT_PUBLIC_AI_CHAT_ENABLED: z.enum(['true', 'false']).optional().default('false'),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

/**
 * Validate server environment variables.
 * Call this at app startup to catch config issues early.
 */
export function validateServerEnv(): ServerEnv {
  const result = serverSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    console.error(
      `\n❌ Invalid environment variables:\n${errors}\n\nFix .env.local and restart.\n`
    );

    // In production, fail hard. In dev, warn only.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Invalid environment variables:\n${errors}`);
    }
  }

  return result.success ? result.data : (process.env as unknown as ServerEnv);
}

/**
 * Validate client-side public environment variables.
 */
export function validateClientEnv(): ClientEnv {
  const clientVars = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  };

  const result = clientSchema.safeParse(clientVars);
  return result.success ? result.data : (clientVars as unknown as ClientEnv);
}

// Auto-validate on import in server context
let _serverEnv: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (!_serverEnv) {
    _serverEnv = validateServerEnv();
  }
  return _serverEnv;
}
