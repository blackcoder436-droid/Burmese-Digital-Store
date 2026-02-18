import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import type { JWTPayload } from '@/types';

// ==========================================
// Middleware - Route Protection + CSP Nonce
// Burmese Digital Store
// Uses 'jose' for Edge Runtime compatible JWT
// CSP nonce-based script protection (S5)
// ==========================================

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// Routes that require authentication
const protectedRoutes = ['/account', '/api/orders', '/vpn/order'];
const adminRoutes = ['/admin', '/api/admin'];

// Public admin routes (no auth required - secured by ADMIN_SECRET)
const ENABLE_ADMIN_SEED = process.env.ENABLE_ADMIN_SEED === 'true';
const publicAdminRoutes = ENABLE_ADMIN_SEED ? ['/api/admin/seed'] : [];

async function verifyTokenEdge(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    });
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Check production cookie name first, fall back to legacy name
  const COOKIE_NAME = process.env.NODE_ENV === 'production' ? '__Host-auth-token' : 'auth-token';
  const token = request.cookies.get(COOKIE_NAME)?.value || request.cookies.get('auth-token')?.value;

  // Check if route needs protection
  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );
  const isAdminRoute = adminRoutes.some((route) =>
    pathname.startsWith(route)
  ) && !publicAdminRoutes.some((route) => pathname === route);

  if (isProtected || isAdminRoute) {
    if (!token) {
      // Redirect to login for page routes, 401 for API routes
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: 'Authentication required' },
          { status: 401 }
        );
      }
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }

    const user = await verifyTokenEdge(token);
    if (!user) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: 'Invalid or expired token' },
          { status: 401 }
        );
      }
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }

    // Check admin access
    if (isAdminRoute && user.role !== 'admin') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: 'Admin access required' },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // --- Generate CSP Nonce ---
  // crypto.randomUUID() is available in Edge Runtime
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  // Forward nonce via REQUEST headers so Next.js can auto-apply it
  // to its generated inline scripts during server rendering
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Also set on response so client-side code can read it
  response.headers.set('x-nonce', nonce);

  // --- CORS Headers (for future mobile app / cross-origin API access) ---
  const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : [];
  const origin = request.headers.get('Origin');

  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Max-Age', '86400');
  }

  // Handle CORS preflight
  if (request.method === 'OPTIONS' && origin && allowedOrigins.includes(origin)) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // --- Security Headers ---
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  );
  // Content-Security-Policy: nonce-based script protection (S5)
  // 'unsafe-inline' removed from script-src in production — nonce replaces it
  // 'strict-dynamic' allows nonce-approved scripts to load their children
  const isDev = process.env.NODE_ENV === 'development';
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;
  const styleSrc = `style-src 'self' 'unsafe-inline'`; // Tailwind needs unsafe-inline for styles
  response.headers.set(
    'Content-Security-Policy',
    `default-src 'self'; ${scriptSrc}; ${styleSrc}; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and images.
     * This ensures security headers are applied to all routes
     * and auth protection applies to the specific paths below.
     */
    '/((?!_next/static|_next/image|favicon.ico|logo.jpg).*)',
  ],
};
