import { NextRequest, NextResponse } from 'next/server';
import { expireOverdueOrders } from '@/lib/fraud-detection';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/cron/expire-orders' });

// ==========================================
// Cron: Expire Overdue Orders
// Called by external cron (e.g. cron-job.org, Vercel cron, PM2 cron)
// Protected by CRON_SECRET header
// ==========================================

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const expired = await expireOverdueOrders();

    log.info('Cron: expire-orders completed', { expiredCount: expired });

    return NextResponse.json({
      success: true,
      data: { expiredCount: expired },
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    log.error('Cron: expire-orders failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
