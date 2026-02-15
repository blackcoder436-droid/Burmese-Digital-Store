import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import type { JWTPayload } from '@/types';

// ==========================================
// Middleware - Route Protection
// Burmese Digital Store
// Uses 'jose' for Edge Runtime compatible JWT
// ==========================================

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// Routes that require authentication
const protectedRoutes = ['/account', '/api/orders'];
const adminRoutes = ['/admin', '/api/admin'];

// Public admin routes (no auth required - secured by ADMIN_SECRET)
const publicAdminRoutes = ['/api/admin/seed'];

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
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const user = await verifyTokenEdge(token);
    if (!user) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { success: false, error: 'Invalid or expired token' },
          { status: 401 }
        );
      }
      return NextResponse.redirect(new URL('/login', request.url));
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

  const response = NextResponse.next();

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
  // Content-Security-Policy: allow self, inline styles (Tailwind), and images from self + data URIs
  // Note: 'unsafe-eval' removed for production hardening. Next.js production works without it.
  const isDev = process.env.NODE_ENV === 'development';
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";
  response.headers.set(
    'Content-Security-Policy',
    `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`
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
