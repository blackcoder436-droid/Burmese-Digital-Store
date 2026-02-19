import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import {
  RATE_LIMIT_CONFIGS,
  getInMemoryRateLimitStats,
} from '@/lib/rateLimit';

// ==========================================
// Admin Rate Limit Dashboard API
// GET /api/admin/rate-limits
// ==========================================

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser || authUser.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const stats = getInMemoryRateLimitStats();

    // Summarize by prefix
    const summary = RATE_LIMIT_CONFIGS.map((config) => {
      const matching = stats.activeEntries.filter((e) =>
        e.route.includes(config.prefix) ||
        e.key.includes(config.prefix)
      );
      const blockedCount = matching.filter(
        (e) => e.count >= config.maxRequests
      ).length;

      return {
        prefix: config.prefix,
        maxRequests: config.maxRequests,
        windowMs: config.windowMs,
        activeIPs: matching.length,
        blockedIPs: blockedCount,
        topIPs: matching.slice(0, 5).map((e) => ({
          ip: e.ip,
          count: e.count,
          remaining: e.remaining,
          ttl: Math.max(0, Math.ceil((e.resetTime - Date.now()) / 1000)),
        })),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        backend: stats.backend,
        totalTracked: stats.totalTracked,
        configs: summary,
        recentEntries: stats.activeEntries.slice(0, 50),
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
