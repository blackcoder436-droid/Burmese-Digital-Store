import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { randomUUID } from 'crypto';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/orders/cart' });
import { extractPaymentInfo } from '@/lib/ocr';
import { getSiteSettings } from '@/models/SiteSettings';
import { validateCoupon, recordCouponUsage } from '@/models/Coupon';
import { computeScreenshotHash, detectFraudFlags } from '@/lib/fraud-detection';
import { saveToQuarantine } from '@/lib/quarantine';
import { sendPaymentScreenshot, buildScreenshotCaption, sendOrderWithApproveButtons } from '@/lib/telegram';
import path from 'path';
import User from '@/models/User';
import { createNotification, notifyAdmins } from '@/models/Notification';

import {
  validateImageUpload,
  safeExtension,
  sanitizeString,
  isValidObjectId,
  ALLOWED_IMAGE_TYPES,
  MAX_SCREENSHOT_SIZE,
} from '@/lib/security';

interface CartItem {
  productId: string;
  quantity: number;
}

// POST /api/orders/cart — Create multiple orders from cart (one payment screenshot for all)
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
    const cartItemsRaw = formData.get('cartItems') as string;
    const paymentMethod = formData.get('paymentMethod') as string;
    const screenshot = formData.get('screenshot') as File;
    const couponCode = sanitizeString((formData.get('couponCode') as string) || '');

    // Parse cart items
    let cartItems: CartItem[];
    try {
      cartItems = JSON.parse(cartItemsRaw);
      if (!Array.isArray(cartItems) || cartItems.length === 0) {
        throw new Error('Empty cart');
      }
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid cart items' },
        { status: 400 }
      );
    }

    // Limit cart size
    if (cartItems.length > 20) {
      return NextResponse.json(
        { success: false, error: 'Cart cannot have more than 20 items' },
        { status: 400 }
      );
    }

    // Validate payment method
    if (!paymentMethod || !screenshot) {
      return NextResponse.json(
        { success: false, error: 'Payment method and screenshot are required' },
        { status: 400 }
      );
    }

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

    // Validate each cart item
    for (const item of cartItems) {
      if (!item.productId || !isValidObjectId(item.productId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid product ID in cart' },
          { status: 400 }
        );
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) {
        return NextResponse.json(
          { success: false, error: 'Invalid quantity in cart (1-10 per item)' },
          { status: 400 }
        );
      }
    }

    // Fetch all products
    const productIds = cartItems.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds }, active: true });

    if (products.length !== cartItems.length) {
      const foundIds = products.map((p) => p._id.toString());
      const missing = cartItems.find((item) => !foundIds.includes(item.productId));
      return NextResponse.json(
        { success: false, error: `Product not found: ${missing?.productId}` },
        { status: 404 }
      );
    }

    // Check stock for each item
    for (const item of cartItems) {
      const product = products.find((p) => p._id.toString() === item.productId);
      if (!product) continue;
      const availableStock = product.details.filter((d: { sold: boolean }) => !d.sold).length;
      if (availableStock < item.quantity) {
        return NextResponse.json(
          { success: false, error: `${product.name}: Only ${availableStock} in stock` },
          { status: 400 }
        );
      }
    }

    // Calculate total
    let grandTotal = 0;
    const orderItems = cartItems.map((item) => {
      const product = products.find((p) => p._id.toString() === item.productId)!;
      const subtotal = product.price * item.quantity;
      grandTotal += subtotal;
      return { product, quantity: item.quantity, subtotal };
    });

    // Validate and apply coupon
    let discountAmount = 0;
    let validatedCouponCode = '';
    let couponId: string | null = null;
    if (couponCode) {
      try {
        // Use the first product's category for coupon validation
        const couponResult = await validateCoupon(couponCode, authUser.userId, grandTotal, orderItems[0].product.category);
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

    const totalAfterDiscount = Math.max(0, grandTotal - discountAmount);

    // Save screenshot to quarantine
    const ext = safeExtension(screenshot.type) || 'png';
    const filename = `pay-${randomUUID()}.${ext}`;
    const relativePath = `uploads/payments/${filename}`;
    const { publicPath: screenshotUrl } = await saveToQuarantine(screenshotBuffer, relativePath);
    const quarantinePath = path.join(process.cwd(), 'quarantine', relativePath);

    // Compute screenshot hash
    const screenshotHash = computeScreenshotHash(screenshotBuffer);

    // Check OCR settings
    const siteSettings = await getSiteSettings();
    const ocrEnabled = siteSettings.ocrEnabled;

    let ocrData = null;
    let orderStatus: 'pending' | 'verifying' = 'pending';

    if (ocrEnabled) {
      try {
        ocrData = await extractPaymentInfo(quarantinePath);
      } catch (ocrError) {
        log.error('OCR processing failed', { error: ocrError instanceof Error ? ocrError.message : String(ocrError) });
      }
      orderStatus = 'verifying';
    }

    // Run fraud detection
    const fraudResult = await detectFraudFlags({
      userId: authUser.userId,
      transactionId: ocrData?.transactionId ?? '',
      screenshotHash,
      amount: totalAfterDiscount,
      highAmountThreshold: siteSettings.highAmountThreshold || 50000,
    });

    const paymentWindowMinutes = siteSettings.paymentWindowMinutes || 30;
    const paymentExpiresAt = new Date(Date.now() + paymentWindowMinutes * 60 * 1000);

    // Send screenshot to Telegram channel
    let telegramFileId: string | undefined;
    let telegramMessageId: number | undefined;
    try {
      const productNames = orderItems.map((oi) => oi.product.name).join(', ');
      const caption = buildScreenshotCaption({
        orderNumber: `Cart (${orderItems.length} items)`,
        userName: authUser.email,
        productName: productNames.length > 100 ? productNames.slice(0, 97) + '...' : productNames,
        amount: totalAfterDiscount,
        paymentMethod,
        transactionId: ocrData?.transactionId ?? undefined,
      });
      const tgResult = await sendPaymentScreenshot(screenshotBuffer, filename, caption);
      if (tgResult) {
        telegramFileId = tgResult.fileId;
        telegramMessageId = tgResult.messageId;
      }
    } catch (e) {
      log.warn('Telegram screenshot upload failed (non-blocking)', { error: e instanceof Error ? e.message : String(e) });
    }

    // Create one order per cart item, all sharing the same screenshot
    const createdOrders = [];
    for (const orderItem of orderItems) {
      // Distribute discount proportionally
      const proportion = orderItem.subtotal / grandTotal;
      const itemDiscount = Math.round(discountAmount * proportion);
      const itemTotal = Math.max(0, orderItem.subtotal - itemDiscount);

      const order = await Order.create({
        user: authUser.userId,
        product: orderItem.product._id,
        quantity: orderItem.quantity,
        totalAmount: itemTotal,
        paymentMethod,
        paymentScreenshot: screenshotUrl,
        telegramFileId,
        telegramMessageId,
        transactionId: ocrData?.transactionId ?? '',
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
        discountAmount: itemDiscount || undefined,
        paymentExpiresAt,
        screenshotHash,
        fraudFlags: fraudResult.flags,
        requiresManualReview: fraudResult.requiresManualReview,
        reviewReason: fraudResult.reviewReason,
      });

      createdOrders.push(order);
    }

    // Record coupon usage
    if (couponId) {
      try {
        await recordCouponUsage(couponId, authUser.userId);
      } catch (e) {
        log.warn('Failed to record coupon usage', { error: e instanceof Error ? e.message : String(e) });
      }
    }

    const firstOrder = createdOrders[0];
    if (firstOrder) {
      try {
        await createNotification({
          user: authUser.userId,
          type: firstOrder.status === 'verifying' ? 'order_verifying' : 'order_placed',
          title: `${createdOrders.length} orders placed`,
          message: `Your cart checkout created ${createdOrders.length} order(s).`,
          orderId: firstOrder._id,
        });

        await notifyAdmins({
          type: 'admin_new_order',
          title: 'New cart checkout',
          message: `${authUser.email} placed ${createdOrders.length} order(s), total ${totalAfterDiscount.toLocaleString()} MMK.`,
          orderId: firstOrder._id,
        });
      } catch (notificationError: unknown) {
        log.warn('Cart order notification creation failed (non-blocking)', {
          error: notificationError instanceof Error ? notificationError.message : String(notificationError),
        });
      }
    }

    // Send Telegram approve/reject buttons for each cart order
    for (const co of createdOrders) {
      try {
        const prod = products.find((p) => p._id.toString() === co.product?.toString());
        await sendOrderWithApproveButtons({
          orderId: co._id.toString(),
          orderNumber: co.orderNumber,
          userName: authUser.email,
          productName: prod?.name || 'Product',
          amount: co.totalAmount,
          paymentMethod,
          orderType: 'product',
        });
      } catch (e) {
        log.warn('Telegram approve buttons failed (non-blocking)', { error: e instanceof Error ? e.message : String(e) });
      }
    }

    log.info('Cart orders created', {
      userId: authUser.userId,
      orderCount: createdOrders.length,
      totalAmount: totalAfterDiscount,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          orders: createdOrders,
          orderCount: createdOrders.length,
          totalAmount: totalAfterDiscount,
        },
        message: `${createdOrders.length} orders placed. Payment is being verified.`,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    log.error('Cart order POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
