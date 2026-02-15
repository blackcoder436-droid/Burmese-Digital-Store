import crypto from 'crypto';
import dbConnect from '@/lib/mongodb';
import Order, { FraudFlag } from '@/models/Order';
import { createLogger } from '@/lib/logger';

// ==========================================
// Fraud Detection — Burmese Digital Store
// Detects duplicate payments, suspicious patterns
// ==========================================

const log = createLogger({ module: 'fraud-detection' });

/**
 * Compute SHA-256 hash of a file buffer for duplicate screenshot detection.
 */
export function computeScreenshotHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Check for duplicate transaction ID across all orders.
 * Returns true if the txid is already used by another order.
 */
export async function isDuplicateTransactionId(
  transactionId: string,
  excludeOrderId?: string
): Promise<boolean> {
  if (!transactionId || transactionId.trim().length === 0) return false;

  await dbConnect();
  const query: Record<string, unknown> = {
    transactionId: transactionId.trim(),
    status: { $nin: ['rejected', 'refunded'] },
  };
  if (excludeOrderId) {
    query._id = { $ne: excludeOrderId };
  }

  const existing = await Order.findOne(query).select('_id').lean();
  return !!existing;
}

/**
 * Check for duplicate screenshot (same hash) across recent orders.
 */
export async function isDuplicateScreenshot(
  screenshotHash: string,
  excludeOrderId?: string
): Promise<boolean> {
  if (!screenshotHash) return false;

  await dbConnect();
  const query: Record<string, unknown> = {
    screenshotHash,
    status: { $nin: ['rejected', 'refunded'] },
  };
  if (excludeOrderId) {
    query._id = { $ne: excludeOrderId };
  }

  const existing = await Order.findOne(query).select('_id').lean();
  return !!existing;
}

/**
 * Check if there's a suspicious amount-time pattern:
 * Same amount within a short time window (5 minutes) from same user.
 */
export async function isSuspiciousAmountTime(
  userId: string,
  amount: number,
  windowMinutes: number = 5
): Promise<boolean> {
  await dbConnect();
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

  const count = await Order.countDocuments({
    user: userId,
    totalAmount: amount,
    createdAt: { $gte: windowStart },
    status: { $nin: ['rejected', 'refunded'] },
  });

  return count > 0; // If there's already an order with same amount in window
}

/**
 * Check if user is a first-time buyer (no previous completed orders).
 */
export async function isFirstTimeUser(userId: string): Promise<boolean> {
  await dbConnect();
  const pastOrderCount = await Order.countDocuments({
    user: userId,
    status: 'completed',
  });
  return pastOrderCount === 0;
}

/**
 * Check if amount exceeds the high-amount threshold.
 */
export function isHighAmount(amount: number, threshold: number): boolean {
  return amount >= threshold;
}

/**
 * Run all fraud detection checks on an order and return flags.
 */
export async function detectFraudFlags(params: {
  userId: string;
  transactionId: string;
  screenshotHash: string;
  amount: number;
  highAmountThreshold: number;
}): Promise<{ flags: FraudFlag[]; requiresManualReview: boolean; reviewReason?: string }> {
  const { userId, transactionId, screenshotHash, amount, highAmountThreshold } = params;
  const flags: FraudFlag[] = [];
  const reasons: string[] = [];

  try {
    // Run checks in parallel
    const [dupTxid, dupScreenshot, suspiciousAmount, firstTime] = await Promise.all([
      isDuplicateTransactionId(transactionId),
      isDuplicateScreenshot(screenshotHash),
      isSuspiciousAmountTime(userId, amount),
      isFirstTimeUser(userId),
    ]);

    if (dupTxid) {
      flags.push('duplicate_txid');
      reasons.push('Duplicate transaction ID detected');
    }

    if (dupScreenshot) {
      flags.push('duplicate_screenshot');
      reasons.push('Duplicate screenshot detected');
    }

    if (suspiciousAmount) {
      flags.push('amount_time_suspicious');
      reasons.push('Same amount in short time window');
    }

    if (firstTime) {
      flags.push('first_time_user');
      reasons.push('First-time user');
    }

    if (isHighAmount(amount, highAmountThreshold)) {
      flags.push('high_amount');
      reasons.push(`High amount order (>= ${highAmountThreshold.toLocaleString()} MMK)`);
    }

    // Determine if manual review is required
    // Strict flags always require manual review
    const strictFlags: FraudFlag[] = ['duplicate_txid', 'duplicate_screenshot'];
    const hasStrictFlag = flags.some((f) => strictFlags.includes(f));
    const requiresManualReview = hasStrictFlag || firstTime || isHighAmount(amount, highAmountThreshold);

    if (flags.length > 0) {
      log.info('Fraud flags detected', { userId, flags, reasons });
    }

    return {
      flags,
      requiresManualReview,
      reviewReason: reasons.length > 0 ? reasons.join('; ') : undefined,
    };
  } catch (error) {
    log.error('Fraud detection error', { error: error instanceof Error ? error.message : String(error) });
    // On error, flag for manual review as safety measure
    return {
      flags: [],
      requiresManualReview: true,
      reviewReason: 'Fraud check error — manual review required',
    };
  }
}

/**
 * Check and auto-expire orders past their payment window.
 * This can be called periodically or on-demand.
 */
export async function expireOverdueOrders(): Promise<number> {
  await dbConnect();

  const result = await Order.updateMany(
    {
      status: 'pending',
      paymentExpiresAt: { $lte: new Date() },
    },
    {
      $set: {
        status: 'rejected',
        adminNote: 'Auto-rejected: Payment window expired',
        rejectReason: 'Payment window expired',
      },
    }
  );

  if (result.modifiedCount > 0) {
    log.info(`Auto-expired ${result.modifiedCount} overdue orders`);
  }

  return result.modifiedCount;
}
