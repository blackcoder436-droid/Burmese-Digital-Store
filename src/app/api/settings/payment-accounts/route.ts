import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { getSiteSettings } from '@/models/SiteSettings';
import { apiLimiter } from '@/lib/rateLimit';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/settings/payment-accounts' });

// GET /api/settings/payment-accounts - Public endpoint for payment account info
export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await connectDB();
    const settings = await getSiteSettings();

    // Only return enabled accounts with public info (no admin-only data)
    const accounts = (settings.paymentAccounts || [])
      .filter((a) => a.enabled && (a.accountName || a.accountNumber))
      .map((a) => ({
        method: a.method,
        accountName: a.accountName,
        accountNumber: a.accountNumber,
        qrImage: a.qrImage,
      }));

    return NextResponse.json({
      success: true,
      data: { accounts },
    });
  } catch (error) {
    log.error('Payment accounts GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
