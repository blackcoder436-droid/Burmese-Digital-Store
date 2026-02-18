import mongoose, { Schema, Document, Model } from 'mongoose';

// ==========================================
// Coupon Model - Burmese Digital Store
// ==========================================

export interface ICouponDocument extends Document {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount?: number; // Max discount for percentage type
  usageLimit: number; // Total uses allowed (0 = unlimited)
  usedCount: number;
  perUserLimit: number; // Uses per user (0 = unlimited)
  usedBy: { userId: mongoose.Types.ObjectId; usedAt: Date }[];
  validFrom: Date;
  validUntil: Date;
  categories: string[]; // Empty = all categories
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema: Schema = new Schema(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      trim: true,
      uppercase: true,
      maxlength: [30, 'Coupon code cannot exceed 30 characters'],
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: [true, 'Discount type is required'],
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [0, 'Discount value cannot be negative'],
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: [0, 'Minimum order amount cannot be negative'],
    },
    maxDiscountAmount: {
      type: Number,
      default: null,
    },
    usageLimit: {
      type: Number,
      default: 0, // 0 = unlimited
      min: 0,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    perUserLimit: {
      type: Number,
      default: 1, // Each user can use once by default
      min: 0,
    },
    usedBy: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        usedAt: { type: Date, default: Date.now },
      },
    ],
    validFrom: {
      type: Date,
      required: [true, 'Valid from date is required'],
    },
    validUntil: {
      type: Date,
      required: [true, 'Valid until date is required'],
    },
    categories: {
      type: [String],
      default: [], // Empty = applies to all categories
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

CouponSchema.index({ code: 1 }, { unique: true });
CouponSchema.index({ active: 1, validUntil: 1 });

const Coupon: Model<ICouponDocument> =
  mongoose.models.Coupon || mongoose.model<ICouponDocument>('Coupon', CouponSchema);

export default Coupon;

/**
 * Validate a coupon code for a given user and order.
 * Returns the coupon document if valid, or throws an error string.
 */
export async function validateCoupon(
  code: string,
  userId: string,
  orderAmount: number,
  category?: string
): Promise<{ coupon: ICouponDocument; discountAmount: number }> {
  const coupon = await Coupon.findOne({ code: code.toUpperCase(), active: true });

  if (!coupon) {
    throw new Error('Invalid coupon code');
  }

  const now = new Date();
  if (now < coupon.validFrom) {
    throw new Error('This coupon is not yet active');
  }
  if (now > coupon.validUntil) {
    throw new Error('This coupon has expired');
  }

  // Check usage limit
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    throw new Error('This coupon has reached its usage limit');
  }

  // Check per-user limit
  if (coupon.perUserLimit > 0) {
    const userUsageCount = coupon.usedBy.filter(
      (u) => u.userId.toString() === userId
    ).length;
    if (userUsageCount >= coupon.perUserLimit) {
      throw new Error('You have already used this coupon');
    }
  }

  // Check min order amount
  if (orderAmount < coupon.minOrderAmount) {
    throw new Error(`Minimum order amount is ${coupon.minOrderAmount.toLocaleString()} MMK`);
  }

  // Check category restriction
  if (coupon.categories.length > 0 && category) {
    if (!coupon.categories.includes(category)) {
      throw new Error('This coupon does not apply to this product category');
    }
  }

  // Calculate discount
  let discountAmount = 0;
  if (coupon.discountType === 'percentage') {
    discountAmount = Math.round((orderAmount * coupon.discountValue) / 100);
    if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
      discountAmount = coupon.maxDiscountAmount;
    }
  } else {
    discountAmount = coupon.discountValue;
  }

  // Discount cannot exceed order amount
  if (discountAmount > orderAmount) {
    discountAmount = orderAmount;
  }

  return { coupon, discountAmount };
}

/**
 * Record coupon usage after successful order.
 */
export async function recordCouponUsage(
  couponId: string,
  userId: string
): Promise<void> {
  await Coupon.findByIdAndUpdate(couponId, {
    $inc: { usedCount: 1 },
    $push: { usedBy: { userId, usedAt: new Date() } },
  });
}
