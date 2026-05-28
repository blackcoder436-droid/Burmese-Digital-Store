import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { createLogger } from '@/lib/logger';
import { approveOrder } from '@/lib/order-actions';

const log = createLogger({ route: '/api/vpn/orders' });
import { extractPaymentInfo, verifyAmount } from '@/lib/ocr';
import { getSiteSettings } from '@/models/SiteSettings';
import { validateCoupon, recordCouponUsage } from '@/models/Coupon';
import { computeScreenshotHash, detectFraudFlags } from '@/lib/fraud-detection';
import User from '@/models/User';
import { createNotification, notifyAdmins } from '@/models/Notification';
import { buildApproveRejectKeyboard, buildScreenshotCaption, sendPaymentScreenshot, editTelegramCaption, editTelegramMessage } from '@/lib/telegram';
import { notifyBotUser } from '@/lib/order-actions';

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

const autoApproveTimers = new Map<string, NodeJS.Timeout>();

function scheduleAutoApprove(orderId: string, delaySeconds: number, ocrMatch: boolean): void {
  const existing = autoApproveTimers.get(orderId);
  if (existing) {
    clearTimeout(existing);
    autoApproveTimers.delete(orderId);
  }

  const timer = setTimeout(async () => {
    autoApproveTimers.delete(orderId);
    try {
      await connectDB();
      const order = await Order.findById(orderId);
      if (!order || order.status !== 'verifying') {
        log.info('VPN website auto-approve skipped — order already processed', { orderId, status: order?.status });
        return;
      }

      const result = await approveOrder(orderId, {
        adminId: 'bot-auto',
        adminName: ocrMatch ? 'Auto-Approve (OCR ✅)' : 'Auto-Approve (Timer)',
        source: 'auto-approve',
      });

      if (!result.success) {
        log.error('VPN website auto-approve failed', { orderId, error: result.error });
        return;
      }

      const updated = result.order;
      if (updated?.telegramMessageId) {
        const text = `🤖 <b>AUTO-APPROVED</b> (${ocrMatch ? 'OCR match ✅' : 'Timer ⏱'})\n\nOrder ${updated.orderNumber} auto-approved`;
        const captionOk = await editTelegramCaption(updated.telegramMessageId, text);
        if (!captionOk) {
          await editTelegramMessage(updated.telegramMessageId, text);
        }
      }

      log.info('VPN website order auto-approved', { orderId, ocrMatch });
    } catch (error) {
      log.error('VPN auto-approve timer error', {
        orderId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, delaySeconds * 1000);

  autoApproveTimers.set(orderId, timer);
  log.info('VPN website auto-approve scheduled', { orderId, delaySeconds, ocrMatch });
}

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

    const requireEmailVerification = process.env.REQUIRE_EMAIL_VERIFICATION_FOR_ORDERS === 'true';
    if (requireEmailVerification) {
      const dbUser = await User.findById(authUser.userId).select('emailVerified').lean() as { emailVerified?: boolean } | null;
      if (dbUser && !dbUser.emailVerified) {
        return NextResponse.json(
          { success: false, error: 'Please verify your email before placing orders. Check your inbox for the verification link.' },
          { status: 403 }
        );
      }
    }

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

    // Validate protocol is enabled on the selected server
    const server = await getServer(serverId);
    if (server && !server.enabledProtocols.includes(protocol)) {
      return NextResponse.json(
        { success: false, error: `${protocol} is not available on this server. Available: ${server.enabledProtocols.join(', ')}` },
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
    const validMethods = ['kpay', 'wavemoney', 'uabpay', 'ayapay'];
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

    try {
      const caption = buildScreenshotCaption({
        orderNumber: order.orderNumber,
        userName: authUser.email,
        productName: `VPN ${plan.name} - ${server?.name || serverId}`,
        amount: totalAmount,
        paymentMethod,
        transactionId: transactionId || (ocrData?.transactionId ?? undefined),
      });
      const tgResult = await sendPaymentScreenshot(
        screenshotBuffer,
        filename,
        caption,
        buildApproveRejectKeyboard(order._id.toString())
      );
      if (tgResult) {
        order.telegramFileId = tgResult.fileId;
        order.telegramMessageId = tgResult.messageId;
        await order.save();
      }
    } catch (e) {
      log.warn('Telegram VPN screenshot upload failed (non-blocking)', {
        error: e instanceof Error ? e.message : String(e),
      });
    }

    const ocrMatch = Boolean(
      ocrEnabled &&
      ocrData &&
      verifyAmount(ocrData.amount, totalAmount, 100)
    );
    if (ocrMatch && siteSettings.autoApproveEnabled !== false) {
      const delay = siteSettings.autoApproveDelaySeconds || 100;
      scheduleAutoApprove(order._id.toString(), delay, ocrMatch);
    } else if (ocrMatch) {
      log.info('VPN website auto-approve skipped because it is disabled in settings', {
        orderId: order._id.toString(),
      });
    }

    // Record coupon usage
    if (couponId) {
      try {
        await recordCouponUsage(couponId, authUser.userId);
      } catch (e) {
        log.warn('Failed to record coupon usage', { error: e instanceof Error ? e.message : String(e) });
      }
    }

    try {
      await createNotification({
        user: authUser.userId,
        type: order.status === 'verifying' ? 'order_verifying' : 'order_placed',
        title: 'VPN order placed',
        message: `Your VPN order ${order.orderNumber} is now ${order.status}.`,
        orderId: order._id,
      });

      await notifyAdmins({
        type: 'admin_new_order',
        title: 'New VPN order',
        message: `VPN order ${order.orderNumber} from ${authUser.email} (${totalAmount.toLocaleString()} MMK).`,
        orderId: order._id,
      });

      if (order.status !== 'completed') {
        await notifyBotUser(order, order.status === 'verifying' ? 'verifying' : 'pending');
      }
    } catch (notificationError: unknown) {
      log.warn('VPN order notification creation failed (non-blocking)', {
        error: notificationError instanceof Error ? notificationError.message : String(notificationError),
      });
    }

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
