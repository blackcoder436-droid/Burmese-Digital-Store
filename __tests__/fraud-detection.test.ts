import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// ==========================================
// Fraud Detection Tests - Burmese Digital Store
// Tests for all fraud detection utility functions
// ==========================================

// Mock mongoose / Order model before importing fraud-detection
vi.mock('@/lib/mongodb', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/models/Order', () => {
  const mockModel = {
    findOne: vi.fn(),
    countDocuments: vi.fn(),
    updateMany: vi.fn(),
  };
  return { default: mockModel };
});

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

import {
  computeScreenshotHash,
  isDuplicateTransactionId,
  isDuplicateScreenshot,
  isSuspiciousAmountTime,
  isFirstTimeUser,
  isHighAmount,
  detectFraudFlags,
  expireOverdueOrders,
} from '@/lib/fraud-detection';

import Order from '@/models/Order';

// ---- Pure functions (no DB) ----

describe('computeScreenshotHash', () => {
  it('returns SHA-256 hex string for a buffer', () => {
    const buf = Buffer.from('test-image-data');
    const hash = computeScreenshotHash(buf);
    const expected = crypto.createHash('sha256').update(buf).digest('hex');
    expect(hash).toBe(expected);
    expect(hash).toHaveLength(64); // SHA-256 = 64 hex chars
  });

  it('returns different hashes for different buffers', () => {
    const hash1 = computeScreenshotHash(Buffer.from('image-1'));
    const hash2 = computeScreenshotHash(Buffer.from('image-2'));
    expect(hash1).not.toBe(hash2);
  });

  it('returns same hash for identical buffers', () => {
    const data = Buffer.from('identical-data');
    expect(computeScreenshotHash(data)).toBe(computeScreenshotHash(data));
  });

  it('handles empty buffer', () => {
    const hash = computeScreenshotHash(Buffer.alloc(0));
    expect(typeof hash).toBe('string');
    expect(hash).toHaveLength(64);
  });
});

describe('isHighAmount', () => {
  it('returns true when amount >= threshold', () => {
    expect(isHighAmount(100000, 100000)).toBe(true);
    expect(isHighAmount(200000, 100000)).toBe(true);
  });

  it('returns false when amount < threshold', () => {
    expect(isHighAmount(99999, 100000)).toBe(false);
    expect(isHighAmount(0, 100000)).toBe(false);
  });

  it('works with decimal amounts', () => {
    expect(isHighAmount(50000.01, 50000)).toBe(true);
    expect(isHighAmount(49999.99, 50000)).toBe(false);
  });
});

// ---- DB-dependent functions (mocked) ----

describe('isDuplicateTransactionId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false for empty transactionId', async () => {
    const result = await isDuplicateTransactionId('');
    expect(result).toBe(false);
    expect(Order.findOne).not.toHaveBeenCalled();
  });

  it('returns false for whitespace-only transactionId', async () => {
    const result = await isDuplicateTransactionId('   ');
    expect(result).toBe(false);
  });

  it('returns true when a matching order exists', async () => {
    (Order.findOne as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ _id: 'order123' }),
      }),
    });

    const result = await isDuplicateTransactionId('TXN-123456');
    expect(result).toBe(true);
  });

  it('returns false when no matching order exists', async () => {
    (Order.findOne as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
    });

    const result = await isDuplicateTransactionId('TXN-UNIQUE');
    expect(result).toBe(false);
  });

  it('excludes specified orderId from query', async () => {
    (Order.findOne as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
    });

    await isDuplicateTransactionId('TXN-123', 'exclude-order-id');
    expect(Order.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: { $ne: 'exclude-order-id' },
      })
    );
  });
});

describe('isDuplicateScreenshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false for empty hash', async () => {
    const result = await isDuplicateScreenshot('');
    expect(result).toBe(false);
  });

  it('returns true when duplicate hash found', async () => {
    (Order.findOne as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ _id: 'dup-order' }),
      }),
    });

    const result = await isDuplicateScreenshot('abc123hash');
    expect(result).toBe(true);
  });

  it('returns false when no duplicate hash found', async () => {
    (Order.findOne as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
    });

    const result = await isDuplicateScreenshot('unique-hash');
    expect(result).toBe(false);
  });
});

describe('isSuspiciousAmountTime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when same amount exists within window', async () => {
    (Order.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    const result = await isSuspiciousAmountTime('user1', 50000);
    expect(result).toBe(true);
  });

  it('returns false when no same amount in window', async () => {
    (Order.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    const result = await isSuspiciousAmountTime('user1', 50000);
    expect(result).toBe(false);
  });

  it('uses default 5 minute window', async () => {
    (Order.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    await isSuspiciousAmountTime('user1', 50000);
    expect(Order.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        user: 'user1',
        totalAmount: 50000,
        createdAt: expect.objectContaining({ $gte: expect.any(Date) }),
      })
    );
  });

  it('respects custom window param', async () => {
    (Order.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    await isSuspiciousAmountTime('user1', 50000, 10);
    expect(Order.countDocuments).toHaveBeenCalled();
  });
});

describe('isFirstTimeUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when user has no completed orders', async () => {
    (Order.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(0);

    const result = await isFirstTimeUser('new-user');
    expect(result).toBe(true);
  });

  it('returns false when user has completed orders', async () => {
    (Order.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(3);

    const result = await isFirstTimeUser('returning-user');
    expect(result).toBe(false);
  });
});

describe('detectFraudFlags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: all checks return "safe"
    (Order.findOne as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
    });
    (Order.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(0);
  });

  const baseParams = {
    userId: 'user1',
    transactionId: 'TXN-001',
    screenshotHash: 'hash123',
    amount: 10000,
    highAmountThreshold: 100000,
  };

  it('returns empty flags for clean order (returning user, low amount)', async () => {
    // isSuspiciousAmountTime → 0 match, isFirstTimeUser → 2 completed orders
    (Order.countDocuments as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(0)  // isSuspiciousAmountTime: no same amount in window
      .mockResolvedValueOnce(2); // isFirstTimeUser: 2 past completed orders → not first time

    const result = await detectFraudFlags(baseParams);
    expect(result.flags).toEqual([]);
    expect(result.requiresManualReview).toBe(false);
    expect(result.reviewReason).toBeUndefined();
  });

  it('flags duplicate_txid and requires manual review', async () => {
    (Order.findOne as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ _id: 'existing-order' }), // duplicate txid
      }),
    }).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null), // no dup screenshot
      }),
    });
    (Order.countDocuments as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(0)  // no suspicious amount
      .mockResolvedValueOnce(5); // not first time

    const result = await detectFraudFlags(baseParams);
    expect(result.flags).toContain('duplicate_txid');
    expect(result.requiresManualReview).toBe(true);
  });

  it('flags high amount orders', async () => {
    (Order.countDocuments as ReturnType<typeof vi.fn>).mockResolvedValue(5); // not first time

    const result = await detectFraudFlags({
      ...baseParams,
      amount: 200000,
      highAmountThreshold: 100000,
    });
    expect(result.flags).toContain('high_amount');
    expect(result.requiresManualReview).toBe(true);
  });

  it('flags first-time user', async () => {
    // countDocuments called twice: once for isSuspiciousAmountTime(=0), once for isFirstTimeUser(=0)
    (Order.countDocuments as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(0) // suspicious amount
      .mockResolvedValueOnce(0); // first time user

    const result = await detectFraudFlags(baseParams);
    expect(result.flags).toContain('first_time_user');
    expect(result.requiresManualReview).toBe(true);
  });

  it('returns safe manual review on error', async () => {
    (Order.findOne as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('DB connection failed');
    });

    const result = await detectFraudFlags(baseParams);
    expect(result.flags).toEqual([]);
    expect(result.requiresManualReview).toBe(true);
    expect(result.reviewReason).toContain('error');
  });
});

describe('expireOverdueOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is disabled and always returns 0', async () => {
    const count = await expireOverdueOrders();
    expect(count).toBe(0);
    // Should NOT call updateMany — auto-reject is disabled
    expect(Order.updateMany).not.toHaveBeenCalled();
  });

  it('returns 0 when no orders to expire', async () => {
    const count = await expireOverdueOrders();
    expect(count).toBe(0);
  });
});
