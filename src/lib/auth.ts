import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { JWTPayload } from '@/types';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

// ==========================================
// Auth Utilities - Burmese Digital Store
// Unified on 'jose' for both Node.js & Edge
// Don't hardcode secrets - use .env.local
// ==========================================

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
/** Shared encoded secret — same encoding used by middleware.ts */
export const JWT_SECRET_KEY = new TextEncoder().encode(process.env.JWT_SECRET);
const TOKEN_EXPIRY = '7d';
const COOKIE_NAME = process.env.NODE_ENV === 'production' ? '__Host-auth-token' : 'auth-token';

export { COOKIE_NAME };

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export async function generateToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(TOKEN_EXPIRY)
    .setIssuedAt()
    .sign(JWT_SECRET_KEY);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY, {
      algorithms: ['HS256'],
    });
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function getAuthUser(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  // Check both cookie names for backward compatibility during transition
  const token = cookieStore.get(COOKIE_NAME)?.value || cookieStore.get('auth-token')?.value;

  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;

  // Enforce server-side tokenVersion and role consistency for all authenticated routes
  await connectDB();
  const dbUser = await User.findById(payload.userId).select('role tokenVersion').lean() as {
    role?: string;
    tokenVersion?: number;
  } | null;

  if (!dbUser) return null;

  const dbVersion = dbUser.tokenVersion ?? 0;
  const jwtVersion = payload.tokenVersion ?? 0;
  if (jwtVersion < dbVersion) {
    return null;
  }

  if (dbUser.role && payload.role !== dbUser.role) {
    return null;
  }

  return {
    ...payload,
    role: (dbUser.role as JWTPayload['role']) || payload.role,
    tokenVersion: dbVersion,
  };
}

export async function requireAuth(): Promise<JWTPayload> {
  const user = await getAuthUser();
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
}

/**
 * Require admin access with DB tokenVersion verification.
 * Prevents stale JWT from granting admin access after demotion.
 * Note: getAuthUser() (called by requireAuth()) already verifies
 * tokenVersion + role from DB, so we only need to check the result.
 */
export async function requireAdmin(): Promise<JWTPayload> {
  const user = await requireAuth();

  // getAuthUser() already synced role from DB and verified tokenVersion.
  // If role is not admin, either JWT was never admin or DB role changed.
  if (user.role !== 'admin') {
    throw new Error('Admin access required');
  }

  return user;
}
