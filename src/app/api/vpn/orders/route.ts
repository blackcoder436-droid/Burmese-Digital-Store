import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/vpn/orders' });
import { extractPaymentInfo } from '@/lib/ocr';
import { getSiteSettings } from '@/models/SiteSettings';
import { validateCoupon, recordCouponUsage } from '@/models/Coupon';
import { computeScreenshotHash, detectFraudFlags } from '@/lib/fraud-detection';

import {
  validateImageUpload,
  safeExtension,
  isPathWithinDir,
  sanitizeString,
  ALLOWED_IMAGE_TYPES,
  MAX_SCREENSHOT_SIZE,
} from '@/lib/security';
import { isValidServerId, getServer } from '@/lib/vpn-servers';
import { getPlan, buildPlanId, isValidPlanId } from '@/lib/vpn-plans';

// POST /api/vpn/orders - Create new VPN order with payment screenshot
export async function POST(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    await connectDB();

    const formData = await request.formData();
    const serverId = sanitizeString((formData.get('serverId') as string) || '');
    const protocol = sanitizeString((formData.get('protocol') as string) || 'trojan').toLowerCase();
    const devices = parseInt(formData.get('devices') as string) || 0;
    const months = parseInt(formData.get('months') as string) || 0;
    const paymentMethod = formData.get('paymentMethod') as string;
    const transactionId = sanitizeString((formData.get('transactionId') as string) || '');
    const screenshot = formData.get('screenshot') as File;
    const couponCode = sanitizeString((formData.get('couponCode') as string) || '');

    // Validation
    if (!serverId || !devices || !months || !paymentMethod || !screenshot) {
      return NextResponse.json(
        { success: false, error: 'Server, devices, months, payment method, and screenshot are required' },
        { status: 400 }
      );
    }

    const validProtocols = ['trojan', 'vless', 'vmess', 'shadowsocks'];
    if (!validProtocols.includes(protocol)) {
      return NextResponse.json(
        { success: false, error: 'Invalid protocol selection' },
        { status: 400 }
      );
    }

    // Validate server
    if (!(await isValidServerId(serverId))) {
      return NextResponse.json(
        { success: false, error: 'Invalid server selection' },
        { status: 400 }
      );
    }

    // Validate plan
    const planId = buildPlanId(devices, months);
    if (!isValidPlanId(planId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid plan selection' },
        { status: 400 }
      );
    }

    const plan = getPlan(planId)!;

    // Validate payment method
    const validMethods = ['kpay', 'wavemoney', 'cbpay', 'ayapay'];
    if (!validMethods.includes(paymentMethod)) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment method' },
        { status: 400 }
      );
    }

    // Validate screenshot
    const screenshotBuffer = Buffer.from(await screenshot.arrayBuffer());
    const screenshotError = validateImageUpload(screenshot, screenshotBuffer, {
      maxSize: MAX_SCREENSHOT_SIZE,
      allowedTypes: ALLOWED_IMAGE_TYPES,
    });
    if (screenshotError) {
      return NextResponse.json(
        { success: false, error: `Screenshot: ${screenshotError}` },
        { status: 400 }
      );
    }

    const subtotal = plan.price;

    // Validate and apply coupon if provided
    let discountAmount = 0;
    let validatedCouponCode = '';
    let couponId: string | null = null;
    if (couponCode) {
      try {
        const couponResult = await validateCoupon(couponCode, authUser.userId, subtotal, 'vpn');
        discountAmount = couponResult.discountAmount;
        validatedCouponCode = couponResult.coupon.code;
        couponId = couponResult.coupon._id.toString();
      } catch (couponError: unknown) {
        return NextResponse.json(
          { success: false, error: couponError instanceof Error ? couponError.message : 'Invalid coupon' },
          { status: 400 }
        );
      }
    }

    const totalAmount = Math.max(0, subtotal - discountAmount);

    // Save screenshot
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'payments');
    await mkdir(uploadsDir, { recursive: true });

    const ext = safeExtension(screenshot.type) || 'png';
    const filename = `vpn-pay-${randomUUID()}.${ext}`;
    const filepath = path.join(uploadsDir, filename);

    if (!isPathWithinDir(filepath, uploadsDir)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file path' },
        { status: 400 }
      );
    }

    await writeFile(filepath, screenshotBuffer);
    const screenshotUrl = `/uploads/payments/${filename}`;

    // Compute screenshot hash for duplicate detection
    const screenshotHash = computeScreenshotHash(screenshotBuffer);

    // OCR
    const siteSettings = await getSiteSettings();
    const ocrEnabled = siteSettings.ocrEnabled;

    let ocrData = null;
    let orderStatus: 'pending' | 'verifying' = 'pending';

    if (ocrEnabled) {
      try {
        ocrData = await extractPaymentInfo(filepath);
      } catch (ocrError) {
        log.error('OCR processing failed', { error: ocrError instanceof Error ? ocrError.message : String(ocrError) });
      }
      orderStatus = 'verifying';
    }

    // Run fraud detection
    const fraudResult = await detectFraudFlags({
      userId: authUser.userId,
      transactionId: transactionId || (ocrData?.transactionId ?? ''),
      screenshotHash,
      amount: totalAmount,
      highAmountThreshold: siteSettings.highAmountThreshold || 50000,
    });

    // Calculate payment expiry window
    const paymentWindowMinutes = siteSettings.paymentWindowMinutes || 30;
    const paymentExpiresAt = new Date(Date.now() + paymentWindowMinutes * 60 * 1000);

    // Create VPN order
    const order = await Order.create({
      user: authUser.userId,
      orderType: 'vpn',
      quantity: 1,
      totalAmount,
      paymentMethod,
      paymentScreenshot: screenshotUrl,
      transactionId: transactionId || (ocrData?.transactionId ?? ''),
      ocrVerified: ocrEnabled && ocrData ? ocrData.confidence > 60 && ocrData.transactionId !== null : false,
      ocrExtractedData: ocrData
        ? {
            amount: ocrData.amount,
            transactionId: ocrData.transactionId,
            confidence: ocrData.confidence,
          }
        : undefined,
      status: orderStatus,
      vpnPlan: {
        serverId,
        planId,
        devices: plan.devices,
        months: plan.months,
        protocol,
      },
      vpnProvisionStatus: 'pending',
      couponCode: validatedCouponCode || undefined,
      discountAmount: discountAmount || undefined,
      // Fraud detection fields
      paymentExpiresAt,
      screenshotHash,
      fraudFlags: fraudResult.flags,
      requiresManualReview: fraudResult.requiresManualReview,
      reviewReason: fraudResult.reviewReason,
    });

    // Record coupon usage
    if (couponId) {
      try {
        await recordCouponUsage(couponId, authUser.userId);
      } catch (e) {
        log.warn('Failed to record coupon usage', { error: e instanceof Error ? e.message : String(e) });
      }
    }

    // NOTE: VPN orders do NOT auto-complete with OCR — they always require admin approval
    // because provisioning a VPN key involves calling the 3xUI API.

    return NextResponse.json(
      {
        success: true,
        data: { order },
        message: 'VPN order placed. Payment is being verified.',
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    log.error('VPN order POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
