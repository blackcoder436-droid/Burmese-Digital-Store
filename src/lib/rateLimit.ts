import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// ==========================================
// Rate Limiter - Burmese Digital Store
// Uses Upstash Redis in production, in-memory fallback for dev
// ==========================================

// ---- helpers ----

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function buildRateLimitResponse(retryAfterSec: number, maxRequests: number): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'Too many requests. Please try again later.',
      retryAfter: retryAfterSec,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSec),
        'X-RateLimit-Limit': String(maxRequests),
        'X-RateLimit-Remaining': '0',
      },
    }
  );
}

function buildRateLimitUnavailableResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'Rate limiting service unavailable',
    },
    {
      status: 503,
      headers: {
        'Retry-After': '60',
      },
    }
  );
}

// ---- Upstash Redis (production) ----

const useRedis =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

let redis: Redis | null = null;
if (useRedis) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

function createUpstashLimiter(
  maxRequests: number,
  windowSec: number,
  prefix: string
): Ratelimit {
  return new Ratelimit({
    redis: redis!,
    limiter: Ratelimit.slidingWindow(maxRequests, `${windowSec} s`),
    prefix: `rl:${prefix}`,
    analytics: false,
  });
}

// ---- In-memory fallback (dev / single-instance) ----

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
if (typeof globalThis !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    rateLimitMap.forEach((value, key) => {
      if (now > value.resetTime) {
        rateLimitMap.delete(key);
      }
    });
  }, 5 * 60 * 1000);
}

function inMemoryCheck(
  request: NextRequest,
  windowMs: number,
  maxRequests: number
): NextResponse | null {
  const ip = getClientIp(request);
  const key = `${ip}:${request.nextUrl.pathname}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return null;
  }

  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return buildRateLimitResponse(retryAfter, maxRequests);
  }

  entry.count++;
  return null;
}

// ---- Public API ----

interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  /** Prefix for Redis key namespace */
  prefix?: string;
}

export function rateLimit(options: RateLimitOptions = {}) {
  const {
    windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '30'),
    prefix = 'api',
  } = options;

  const windowSec = Math.ceil(windowMs / 1000);
  const failClosedInProd =
    process.env.NODE_ENV === 'production' && process.env.RATE_LIMIT_FAIL_CLOSED !== 'false';

  // Upstash limiter (created lazily once)
  let upstashLimiter: Ratelimit | null = null;
  if (useRedis) {
    upstashLimiter = createUpstashLimiter(maxRequests, windowSec, prefix);
  }

  return async function checkRateLimit(
    request: NextRequest
  ): Promise<NextResponse | null> {
    if (!upstashLimiter && failClosedInProd) {
      return buildRateLimitUnavailableResponse();
    }

    // --- Upstash path ---
    if (upstashLimiter) {
      const ip = getClientIp(request);
      const key = `${ip}:${request.nextUrl.pathname}`;
      try {
        const { success, reset } = await upstashLimiter.limit(key);
        if (!success) {
          const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
          return buildRateLimitResponse(retryAfter, maxRequests);
        }
        return null;
      } catch (err) {
        if (failClosedInProd) {
          console.error('[RateLimit] Upstash error in production (fail-closed):', err);
          return buildRateLimitUnavailableResponse();
        }

        // Redis unreachable — fall through to in-memory in non-production
        console.warn('[RateLimit] Upstash error, falling back to in-memory:', err);
      }
    }

    // --- In-memory fallback ---
    return inMemoryCheck(request, windowMs, maxRequests);
  };
}

// Pre-configured limiters for different routes
export const apiLimiter = rateLimit({ windowMs: 60000, maxRequests: 30, prefix: 'api' });
export const authLimiter = rateLimit({ windowMs: 60000, maxRequests: 5, prefix: 'auth' });
export const uploadLimiter = rateLimit({ windowMs: 60000, maxRequests: 10, prefix: 'upload' });
/** Registration: 1 request per 3 minutes per IP to prevent mass account creation */
export const registerLimiter = rateLimit({ windowMs: 3 * 60 * 1000, maxRequests: 1, prefix: 'register' });
