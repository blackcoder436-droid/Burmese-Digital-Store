import mongoose, { Schema, Document, Model } from 'mongoose';

// ==========================================
// Referral Model - Burmese Digital Store
// Tracks referral relationships and rewards
// ==========================================

export interface IReferralDocument extends Document {
  referrer: mongoose.Types.ObjectId; // user who shared the link
  referred: mongoose.Types.ObjectId; // user who joined via link
  referrerTelegramId?: number;
  referredTelegramId?: number;
  isPaid: boolean; // referred user has completed a purchase
  paidAt?: Date;
  orderId?: mongoose.Types.ObjectId; // the order that triggered the reward
  createdAt: Date;
  updatedAt: Date;
}

const ReferralSchema: Schema = new Schema(
  {
    referrer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    referred: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    referrerTelegramId: {
      type: Number,
      default: null,
    },
    referredTelegramId: {
      type: Number,
      default: null,
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
ReferralSchema.index({ referrer: 1 });
ReferralSchema.index({ referred: 1 }, { unique: true }); // one referrer per user
ReferralSchema.index({ referrerTelegramId: 1 });
ReferralSchema.index({ referredTelegramId: 1 });
ReferralSchema.index({ isPaid: 1 });

const Referral: Model<IReferralDocument> =
  mongoose.models.Referral || mongoose.model<IReferralDocument>('Referral', ReferralSchema);

export default Referral;

// ---- Helper Functions ----

/**
 * Add a referral relationship (prevents self-referral and duplicates)
 */
export async function addReferral(
  referrerId: mongoose.Types.ObjectId,
  referredId: mongoose.Types.ObjectId,
  referrerTelegramId?: number,
  referredTelegramId?: number
): Promise<boolean> {
  // Prevent self-referral
  if (referrerId.toString() === referredId.toString()) return false;

  // Check duplicate
  const existing = await Referral.findOne({ referred: referredId });
  if (existing) return false;

  await Referral.create({
    referrer: referrerId,
    referred: referredId,
    referrerTelegramId,
    referredTelegramId,
  });
  return true;
}

/**
 * Mark a referral as paid when the referred user makes a purchase
 */
export async function markReferralPaid(
  referredId: mongoose.Types.ObjectId,
  orderId: mongoose.Types.ObjectId
): Promise<IReferralDocument | null> {
  return Referral.findOneAndUpdate(
    { referred: referredId, isPaid: false },
    {
      $set: {
        isPaid: true,
        paidAt: new Date(),
        orderId,
      },
    },
    { new: true }
  );
}

/**
 * Get referral stats for a user
 */
export async function getReferralStats(referrerId: mongoose.Types.ObjectId): Promise<{
  totalReferred: number;
  paidReferrals: number;
}> {
  const [totalReferred, paidReferrals] = await Promise.all([
    Referral.countDocuments({ referrer: referrerId }),
    Referral.countDocuments({ referrer: referrerId, isPaid: true }),
  ]);

  return { totalReferred, paidReferrals };
}

/**
 * Get the referrer of a user (if any)
 */
export async function getReferrer(
  referredId: mongoose.Types.ObjectId
): Promise<IReferralDocument | null> {
  return Referral.findOne({ referred: referredId });
}

/**
 * Get the referrer by telegramId
 */
export async function getReferrerByTelegramId(
  referredTelegramId: number
): Promise<IReferralDocument | null> {
  return Referral.findOne({ referredTelegramId });
}
