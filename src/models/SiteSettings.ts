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

export interface IFeatureFlag {
  name: string;
  enabled: boolean;
  updatedBy?: string;
}

export interface ISiteSettingsDocument extends Document {
  ocrEnabled: boolean;
  paymentAccounts: IPaymentAccount[];
  // Payment verification policy
  paymentWindowMinutes: number;
  highAmountThreshold: number;
  requireManualReviewForNewUsers: boolean;
  autoExpireEnabled: boolean;
  // Bot feature flags
  featureFlags: IFeatureFlag[];
  // Auto-approve settings
  autoApproveEnabled: boolean;
  autoApproveDelaySeconds: number;
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
    // Bot feature flags
    featureFlags: {
      type: [
        {
          name: { type: String, required: true },
          enabled: { type: Boolean, default: true },
          updatedBy: { type: String, default: null },
        },
      ],
      default: [
        { name: 'referral_system', enabled: true },
        { name: 'free_test_key', enabled: true },
        { name: 'protocol_change', enabled: true },
        { name: 'auto_approve', enabled: true },
      ],
    },
    // Auto-approve settings
    autoApproveEnabled: {
      type: Boolean,
      default: true,
    },
    autoApproveDelaySeconds: {
      type: Number,
      default: 100,
      min: 30,
      max: 600,
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

/**
 * Get a specific feature flag value.
 */
export async function getFeatureFlag(name: string): Promise<boolean> {
  const settings = await getSiteSettings();
  const flag = settings.featureFlags?.find((f) => f.name === name);
  return flag?.enabled ?? true; // default to enabled if not found
}

/**
 * Set a feature flag value.
 */
export async function setFeatureFlag(
  name: string,
  enabled: boolean,
  updatedBy?: string
): Promise<void> {
  const settings = await getSiteSettings();
  const flag = settings.featureFlags?.find((f) => f.name === name);
  if (flag) {
    flag.enabled = enabled;
    flag.updatedBy = updatedBy;
  } else {
    settings.featureFlags.push({ name, enabled, updatedBy });
  }
  await settings.save();
}

/**
 * Get all feature flags.
 */
export async function getAllFeatureFlags(): Promise<IFeatureFlag[]> {
  const settings = await getSiteSettings();
  return settings.featureFlags || [];
}
