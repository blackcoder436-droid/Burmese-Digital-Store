import mongoose, { Schema, Document, Model } from 'mongoose';

// ==========================================
// Site Settings Model - Burmese Digital Store
// Singleton document for site-wide config
// ==========================================

export interface IPaymentAccount {
  method: 'kpay' | 'wave' | 'uabpay' | 'ayapay';
  accountName: string;
  accountNumber: string;
  qrImage?: string; // path to QR code image
  enabled: boolean;
}

export interface ISiteSettingsDocument extends Document {
  ocrEnabled: boolean;
  paymentAccounts: IPaymentAccount[];
  // Payment verification policy
  paymentWindowMinutes: number;
  highAmountThreshold: number;
  requireManualReviewForNewUsers: boolean;
  autoExpireEnabled: boolean;
  updatedAt: Date;
}

const PaymentAccountSchema: Schema = new Schema({
  method: {
    type: String,
    enum: ['kpay', 'wave', 'uabpay', 'ayapay'],
    required: true,
  },
  accountName: {
    type: String,
    trim: true,
    default: '',
  },
  accountNumber: {
    type: String,
    trim: true,
    default: '',
  },
  qrImage: {
    type: String,
    default: null,
  },
  enabled: {
    type: Boolean,
    default: true,
  },
});

const SiteSettingsSchema: Schema = new Schema(
  {
    ocrEnabled: {
      type: Boolean,
      default: true,
    },
    paymentAccounts: {
      type: [PaymentAccountSchema],
      default: [
        { method: 'kpay', accountName: '', accountNumber: '', enabled: true },
        { method: 'wave', accountName: '', accountNumber: '', enabled: true },
        { method: 'uabpay', accountName: '', accountNumber: '', enabled: true },
        { method: 'ayapay', accountName: '', accountNumber: '', enabled: true },
      ],
    },
    // Payment verification policy settings
    paymentWindowMinutes: {
      type: Number,
      default: 30, // 30 minutes payment window
      min: 5,
      max: 120,
    },
    highAmountThreshold: {
      type: Number,
      default: 50000, // 50,000 MMK
      min: 0,
    },
    requireManualReviewForNewUsers: {
      type: Boolean,
      default: true, // First-time users always require manual review
    },
    autoExpireEnabled: {
      type: Boolean,
      default: true, // Auto-expire orders past payment window
    },
  },
  {
    timestamps: true,
  }
);

const SiteSettings: Model<ISiteSettingsDocument> =
  mongoose.models.SiteSettings ||
  mongoose.model<ISiteSettingsDocument>('SiteSettings', SiteSettingsSchema);

export default SiteSettings;

/**
 * Get site settings (creates default if none exist).
 */
export async function getSiteSettings(): Promise<ISiteSettingsDocument> {
  let settings = await SiteSettings.findOne();
  if (!settings) {
    settings = await SiteSettings.create({ ocrEnabled: true });
  }
  return settings;
}
