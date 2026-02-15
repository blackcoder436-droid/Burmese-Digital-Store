import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { getSiteSettings } from '@/models/SiteSettings';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { logActivity } from '@/models/ActivityLog';
import { sanitizeString } from '@/lib/security';

// ==========================================
// Admin Settings API - Burmese Digital Store
// GET: Retrieve settings, PATCH: Update settings
// ==========================================

// GET /api/admin/settings — Get current settings
export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
    await connectDB();

    const settings = await getSiteSettings();

    return NextResponse.json({
      success: true,
      data: { settings },
    });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    console.error('Admin settings GET error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/admin/settings — Update settings
export async function PATCH(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const admin = await requireAdmin();
    await connectDB();

    const body = await request.json();
    const settings = await getSiteSettings();

    const changes: string[] = [];
    if (typeof body.ocrEnabled === 'boolean') {
      changes.push(`OCR: ${body.ocrEnabled ? 'ON' : 'OFF'}`);
      settings.ocrEnabled = body.ocrEnabled;
    }

    // Update payment accounts if provided
    if (Array.isArray(body.paymentAccounts)) {
      const validMethods = ['kpay', 'wave', 'cbpay', 'ayapay'];
      const sanitizedAccounts = body.paymentAccounts
        .filter((a: any) => validMethods.includes(a.method))
        .map((a: any) => ({
          method: a.method,
          accountName: String(a.accountName || '').trim().slice(0, 100),
          accountNumber: String(a.accountNumber || '').trim().slice(0, 50),
          qrImage: a.qrImage ? sanitizeString(String(a.qrImage)).slice(0, 500) : null,
          enabled: typeof a.enabled === 'boolean' ? a.enabled : true,
        }));
      settings.paymentAccounts = sanitizedAccounts;
      changes.push(`Payment accounts updated`);
    }

    await settings.save();

    // Log settings change
    try {
      if (changes.length > 0) {
        await logActivity({
          admin: admin.userId,
          action: 'settings_updated',
          target: 'Site Settings',
          details: changes.join(', '),
        });
      }
    } catch { /* ignore */ }

    return NextResponse.json({
      success: true,
      data: { settings },
      message: 'Settings updated successfully',
    });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    console.error('Admin settings PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
