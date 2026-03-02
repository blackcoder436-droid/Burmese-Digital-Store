// ==========================================
// Bot Session Management
// Burmese Digital Store - Integrated Bot
// ==========================================
// In-memory session store for Telegram bot conversation state.
// Sessions auto-expire after 1 hour.

import type { BotSession } from './types';

const SESSION_TTL = 60 * 60 * 1000; // 1 hour
const sessions = new Map<number, BotSession>();

/**
 * Get a user's session (returns copy)
 */
export function getSession(telegramId: number): BotSession | null {
  const session = sessions.get(telegramId);
  if (!session) return null;

  // Check TTL
  if (Date.now() - session.createdAt > SESSION_TTL) {
    sessions.delete(telegramId);
    return null;
  }

  return { ...session };
}

/**
 * Set/create a user's session
 */
export function setSession(telegramId: number, data: Partial<BotSession>): void {
  const existing = sessions.get(telegramId);
  sessions.set(telegramId, {
    telegramId,
    ...(existing || {}),
    ...data,
    createdAt: Date.now(),
  });
}

/**
 * Update a single field in the session
 */
export function updateSessionField<K extends keyof BotSession>(
  telegramId: number,
  key: K,
  value: BotSession[K]
): void {
  const session = sessions.get(telegramId);
  if (session) {
    session[key] = value;
    session.createdAt = Date.now(); // refresh TTL
  }
}

/**
 * Clear a user's session
 */
export function clearSession(telegramId: number): void {
  sessions.delete(telegramId);
}

/**
 * Check if a user has an active session
 */
export function hasSession(telegramId: number): boolean {
  const session = sessions.get(telegramId);
  if (!session) return false;
  if (Date.now() - session.createdAt > SESSION_TTL) {
    sessions.delete(telegramId);
    return false;
  }
  return true;
}

/**
 * Cleanup expired sessions (call periodically)
 */
export function cleanupExpiredSessions(): number {
  const now = Date.now();
  let cleaned = 0;
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_TTL) {
      sessions.delete(id);
      cleaned++;
    }
  }
  return cleaned;
}

/**
 * Get total active session count
 */
export function getActiveSessionCount(): number {
  return sessions.size;
}
