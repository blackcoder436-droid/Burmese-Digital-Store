import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/orders' });
import { extractPaymentInfo } from '@/lib/ocr';
import { getSiteSettings } from '@/models/SiteSettings';
import { validateCoupon, recordCouponUsage } from '@/models/Coupon';
import { computeScreenshotHash, detectFraudFlags } from '@/lib/fraud-detection';
import { saveToQuarantine } from '@/lib/quarantine';
import { sendPaymentScreenshot, buildScreenshotCaption } from '@/lib/telegram';
import User from '@/models/User';
import { createNotification, notifyAdmins } from '@/models/Notification';

import {
  validateImageUpload,
  safeExtension,
  isPathWithinDir,
  sanitizeString,
  isValidObjectId,
  ALLOWED_IMAGE_TYPES,
  MAX_SCREENSHOT_SIZE,
} from '@/lib/security';

// GET /api/orders - List user's orders
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);

    const query: Record<string, unknown> = { user: authUser.userId };
    // Validate status against allowed values
    if (status) {
      const validStatuses = ['pending', 'verifying', 'completed', 'rejected', 'refunded'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { success: false, error: 'Invalid status filter' },
          { status: 400 }
        );
      }
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('product', 'name category price image')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(query),
    ]);

    const sanitizedOrders = orders.map((order: any) => {
      const { ocrExtractedData, ocrVerified, transactionId, ...safeOrder } = order;
      return safeOrder;
    });

    return NextResponse.json({
      success: true,
      data: {
        orders: sanitizedOrders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: unknown) {
    log.error('Orders GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/orders - Create new order with payment screenshot
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
    const productId = formData.get('productId') as string;
    const quantity = parseInt(formData.get('quantity') as string) || 1;
    const paymentMethod = formData.get('paymentMethod') as string;
    const transactionId = sanitizeString((formData.get('transactionId') as string) || '');
    const screenshot = formData.get('screenshot') as File;
    const couponCode = sanitizeString((formData.get('couponCode') as string) || '');

    // Validation
    if (!productId || !paymentMethod || !screenshot) {
      return NextResponse.json(
        { success: false, error: 'Product, payment method, and screenshot are required' },
        { status: 400 }
      );
    }

    // Validate productId format
    if (!isValidObjectId(productId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid product ID' },
        { status: 400 }
      );
    }

    // Validate payment method
    const validMethods = ['kpay', 'wavemoney', 'cbpay', 'ayapay'];
    if (!validMethods.includes(paymentMethod)) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment method' },
        { status: 400 }
      );
    }

    // Validate quantity
    if (quantity < 1 || quantity > 10 || !Number.isInteger(quantity)) {
      return NextResponse.json(
        { success: false, error: 'Invalid quantity' },
        { status: 400 }
      );
    }

    // Validate screenshot: size, MIME, magic bytes, suspicious content
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

    // Find product
    const product = await Product.findOne({ _id: productId, active: true });
    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    // Check stock
    const availableStock = product.details.filter((d) => !d.sold).length;
    if (availableStock < quantity) {
      return NextResponse.json(
        { success: false, error: `Only ${availableStock} items in stock` },
        { status: 400 }
      );
    }

    const subtotal = product.price * quantity;

    // Validate and apply coupon if provided
    let discountAmount = 0;
    let validatedCouponCode = '';
    let couponId: string | null = null;
    if (couponCode) {
      try {
        const couponResult = await validateCoupon(couponCode, authUser.userId, subtotal, product.category);
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

    // Save screenshot to quarantine (S7 — not publicly accessible until admin approval)
    const ext = safeExtension(screenshot.type) || 'png';
    const filename = `pay-${randomUUID()}.${ext}`;
    const relativePath = `uploads/payments/${filename}`;

    const { publicPath: screenshotUrl } = await saveToQuarantine(screenshotBuffer, relativePath);

    // Also save to public for OCR processing (temp copy if OCR enabled)
    // OCR needs filesystem access; quarantine path is used
    const quarantinePath = path.join(process.cwd(), 'quarantine', relativePath);

    // Compute screenshot hash for duplicate detection
    const screenshotHash = computeScreenshotHash(screenshotBuffer);

    // Check if OCR is enabled
    const siteSettings = await getSiteSettings();
    const ocrEnabled = siteSettings.ocrEnabled;

    let ocrData = null;
    let orderStatus: 'pending' | 'verifying' = 'pending';

    if (ocrEnabled) {
      // Run OCR on the quarantined screenshot
      try {
        ocrData = await extractPaymentInfo(quarantinePath);
      } catch (ocrError) {
        log.error('OCR processing failed', { error: ocrError instanceof Error ? ocrError.message : String(ocrError) });
      }
      orderStatus = 'verifying';
    }
    // If OCR disabled, status stays 'pending' for manual admin review

    // Run fraud detection
    const fraudResult = await detectFraudFlags({
      userId: authUser.userId,
      transactionId: transactionId || (ocrData?.transactionId ?? ''),
      screenshotHash,
      amount: totalAmount,
      highAmountThreshold: siteSettings.highAmountThreshold || 50000,
    });

    // If strict fraud flags (duplicate txid/screenshot), block auto-complete
    const hasStrictFraud = fraudResult.flags.some((f) =>
      ['duplicate_txid', 'duplicate_screenshot'].includes(f)
    );

    // Calculate payment expiry window
    const paymentWindowMinutes = siteSettings.paymentWindowMinutes || 30;
    const paymentExpiresAt = new Date(Date.now() + paymentWindowMinutes * 60 * 1000);

    // Send screenshot to Telegram channel
    let telegramFileId: string | undefined;
    let telegramMessageId: number | undefined;
    try {
      const caption = buildScreenshotCaption({
        orderNumber: '', // Will update after order is created
        userName: authUser.email,
        productName: product.name,
        amount: totalAmount,
        paymentMethod,
        transactionId: transactionId || (ocrData?.transactionId ?? undefined),
      });
      const tgResult = await sendPaymentScreenshot(screenshotBuffer, filename, caption);
      if (tgResult) {
        telegramFileId = tgResult.fileId;
        telegramMessageId = tgResult.messageId;
      }
    } catch (e) {
      log.warn('Telegram screenshot upload failed (non-blocking)', { error: e instanceof Error ? e.message : String(e) });
    }

    // Create order
    const order = await Order.create({
      user: authUser.userId,
      product: productId,
      quantity,
      totalAmount,
      paymentMethod,
      paymentScreenshot: screenshotUrl,
      telegramFileId,
      telegramMessageId,
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
      couponCode: validatedCouponCode || undefined,
      discountAmount: discountAmount || undefined,
      // Fraud detection fields
      paymentExpiresAt,
      screenshotHash,
      fraudFlags: fraudResult.flags,
      requiresManualReview: fraudResult.requiresManualReview,
      reviewReason: fraudResult.reviewReason,
    });

    // Record coupon usage after successful order creation
    if (couponId) {
      try {
        await recordCouponUsage(couponId, authUser.userId);
      } catch (e) {
        log.warn('Failed to record coupon usage', { error: e instanceof Error ? e.message : String(e) });
      }
    }

    let autoCompleted = false;

    // If OCR verified with high confidence, amount matches, AND no strict fraud flags → auto-complete
    if (
      ocrEnabled &&
      !hasStrictFraud &&
      !fraudResult.requiresManualReview &&
      ocrData &&
      ocrData.confidence > 80 &&
      ocrData.transactionId &&
      ocrData.amount &&
      Math.abs(parseFloat(ocrData.amount) - totalAmount) <= totalAmount * 0.02 // 2% tolerance for OCR extraction variance
    ) {
      // Auto-deliver keys
      const keysToDeliver = product.details
        .filter((d) => !d.sold)
        .slice(0, quantity);

      for (const key of keysToDeliver) {
        key.sold = true;
        key.soldTo = authUser.userId as any;
        key.soldAt = new Date();
      }
      await product.save();

      order.status = 'completed';
      order.deliveredKeys = keysToDeliver.map((k) => ({
        serialKey: k.serialKey,
        loginEmail: k.loginEmail,
        loginPassword: k.loginPassword,
        additionalInfo: k.additionalInfo,
      }));
      await order.save();

      // Update stock count
      await Product.findByIdAndUpdate(productId, {
        stock: product.details.filter((d) => !d.sold).length,
      });

      autoCompleted = true;
    }



    try {
      const userNotificationType =
        order.status === 'completed'
          ? 'order_completed'
          : order.status === 'verifying'
            ? 'order_verifying'
            : 'order_placed';

      await createNotification({
        user: authUser.userId,
        type: userNotificationType,
        title: order.status === 'completed' ? 'Order completed' : 'Order placed',
        message:
          order.status === 'completed'
            ? `Your order ${order.orderNumber} was auto-completed and keys were delivered.`
            : `Your order ${order.orderNumber} is now ${order.status}.`,
        orderId: order._id,
      });

      await notifyAdmins({
        type: 'admin_new_order',
        title: 'New order received',
        message: `Order ${order.orderNumber} from ${authUser.email} (${totalAmount.toLocaleString()} MMK).`,
        orderId: order._id,
      });
    } catch (notificationError: unknown) {
      log.warn('Order notification creation failed (non-blocking)', {
        error: notificationError instanceof Error ? notificationError.message : String(notificationError),
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: { order },
        message:
          order.status === 'completed'
            ? 'Payment verified! Your keys have been delivered.'
            : 'Order placed. Payment is being verified.',
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    log.error('Order POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
