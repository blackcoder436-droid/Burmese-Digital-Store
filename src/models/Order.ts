import mongoose, { Schema, Document, Model } from 'mongoose';

// ==========================================
// Order Model - Burmese Digital Store
// ==========================================

export interface IDeliveredKey {
  serialKey?: string;
  loginEmail?: string;
  loginPassword?: string;
  additionalInfo?: string;
}

export interface IVpnPlanData {
  serverId: string;
  planId: string;
  devices: number;
  months: number;
  protocol?: string;
}

export interface IVpnKeyData {
  clientEmail: string;
  clientUUID: string;
  subId: string;
  subLink: string;
  configLink: string;
  protocol: string;
  expiryTime: number; // unix ms
  provisionedAt?: Date;
}

export type VpnProvisionStatus = 'pending' | 'provisioned' | 'failed' | 'revoked';

export type FraudFlag = 'duplicate_txid' | 'duplicate_screenshot' | 'amount_time_suspicious' | 'first_time_user' | 'high_amount';

export interface IVerificationChecklist {
  amountVerified?: boolean;
  timeVerified?: boolean;
  accountVerified?: boolean;
  txidVerified?: boolean;
  payerVerified?: boolean;
  completedAt?: Date;
  completedBy?: mongoose.Types.ObjectId;
}

export interface IOrderDocument extends Document {
  orderNumber: string; // Human-readable: BD-000001
  user: mongoose.Types.ObjectId;
  product?: mongoose.Types.ObjectId; // optional for VPN orders
  orderType: 'product' | 'vpn';
  quantity: number;
  totalAmount: number;
  paymentMethod: 'kpay' | 'wavemoney' | 'uabpay' | 'ayapay';
  paymentScreenshot: string;
  transactionId: string;
  ocrVerified: boolean;
  ocrExtractedData?: {
    amount?: string;
    transactionId?: string;
    confidence: number;
  };
  status: 'pending' | 'verifying' | 'completed' | 'rejected' | 'refunded';
  deliveredKeys: IDeliveredKey[];
  // VPN-specific fields
  vpnPlan?: IVpnPlanData;
  vpnKey?: IVpnKeyData;
  vpnProvisionStatus?: VpnProvisionStatus;
  adminNote?: string;
  couponCode?: string;
  discountAmount?: number;
  // Telegram screenshot storage
  telegramFileId?: string;
  telegramMessageId?: number;
  // Payment verification & fraud detection fields
  paymentExpiresAt?: Date;
  screenshotHash?: string;
  fraudFlags: FraudFlag[];
  requiresManualReview: boolean;
  reviewReason?: string;
  verificationChecklist?: IVerificationChecklist;
  rejectReason?: string;
  vpnExpiryReminders?: Record<string, boolean>;
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema: Schema = new Schema(
  {
    orderNumber: {
      type: String,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: false, // optional for VPN orders
    },
    orderType: {
      type: String,
      enum: ['product', 'vpn'],
      default: 'product',
    },
    quantity: {
      type: Number,
      required: true,
      default: 1,
      min: [1, 'Quantity must be at least 1'],
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    paymentMethod: {
      type: String,
      required: [true, 'Payment method is required'],
      trim: true,
    },
    paymentScreenshot: {
      type: String,
      required: [true, 'Payment screenshot is required'],
    },
    transactionId: {
      type: String,
      trim: true,
    },
    ocrVerified: {
      type: Boolean,
      default: false,
    },
    ocrExtractedData: {
      amount: String,
      transactionId: String,
      confidence: {
        type: Number,
        default: 0,
      },
    },
    status: {
      type: String,
      enum: ['pending', 'verifying', 'completed', 'rejected', 'refunded'],
      default: 'pending',
    },
    deliveredKeys: [
      {
        serialKey: String,
        loginEmail: String,
        loginPassword: String,
        additionalInfo: String,
      },
    ],
    // VPN-specific fields
    vpnPlan: {
      serverId: String,
      planId: String,
      devices: Number,
      months: Number,
      protocol: String,
    },
    vpnKey: {
      clientEmail: String,
      clientUUID: String,
      subId: String,
      subLink: String,
      configLink: String,
      protocol: String,
      expiryTime: Number,
      provisionedAt: Date,
    },
    vpnProvisionStatus: {
      type: String,
      enum: ['pending', 'provisioned', 'failed', 'revoked'],
    },
    adminNote: {
      type: String,
      maxlength: [500, 'Admin note cannot exceed 500 characters'],
    },
    telegramFileId: {
      type: String,
      default: null,
    },
    telegramMessageId: {
      type: Number,
      default: null,
    },
    couponCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Payment verification & fraud detection fields
    paymentExpiresAt: {
      type: Date,
    },
    screenshotHash: {
      type: String,
    },
    fraudFlags: {
      type: [String],
      enum: ['duplicate_txid', 'duplicate_screenshot', 'amount_time_suspicious', 'first_time_user', 'high_amount'],
      default: [],
    },
    requiresManualReview: {
      type: Boolean,
      default: false,
    },
    reviewReason: {
      type: String,
      trim: true,
    },
    verificationChecklist: {
      amountVerified: Boolean,
      timeVerified: Boolean,
      accountVerified: Boolean,
      txidVerified: Boolean,
      payerVerified: Boolean,
      completedAt: Date,
      completedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    rejectReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Reject reason cannot exceed 500 characters'],
    },
    vpnExpiryReminders: {
      type: Map,
      of: Boolean,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate orderNumber before save
OrderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    try {
      const lastOrder = await mongoose.models.Order
        .findOne({ orderNumber: { $exists: true, $ne: null } })
        .sort({ orderNumber: -1 })
        .select('orderNumber')
        .lean() as { orderNumber?: string } | null;

      let nextNum = 1;
      if (lastOrder?.orderNumber) {
        const match = lastOrder.orderNumber.match(/BD-(\d+)/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }
      this.orderNumber = `BD-${String(nextNum).padStart(6, '0')}`;
    } catch {
      // Fallback: timestamp-based
      this.orderNumber = `BD-${Date.now().toString(36).toUpperCase()}`;
    }
  }
  next();
});

// Indexes
OrderSchema.index({ orderNumber: 1 }, { unique: true, sparse: true });
OrderSchema.index({ user: 1, status: 1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ transactionId: 1 });
OrderSchema.index({ orderType: 1, status: 1 });
OrderSchema.index({ paymentExpiresAt: 1 }, { sparse: true });
OrderSchema.index({ screenshotHash: 1 }, { sparse: true });
OrderSchema.index({ fraudFlags: 1 }, { sparse: true });
OrderSchema.index({ requiresManualReview: 1, status: 1 });
// Database indexing audit (2026-02-19)
OrderSchema.index({ orderType: 1, vpnProvisionStatus: 1 }); // VPN keys admin page
OrderSchema.index({ 'vpnPlan.serverId': 1 }, { sparse: true }); // VPN keys server filter
OrderSchema.index({ orderType: 1, status: 1, vpnProvisionStatus: 1, 'vpnKey.expiryTime': 1 }); // VPN expiry reminders cron
OrderSchema.index({ status: 1, paymentExpiresAt: 1 }); // expireOverdueOrders batch
OrderSchema.index({ createdAt: -1 }); // Analytics date-range aggregations
OrderSchema.index({ user: 1, totalAmount: 1, createdAt: -1 }); // Fraud: isSuspiciousAmountTime

const Order: Model<IOrderDocument> =
  mongoose.models.Order || mongoose.model<IOrderDocument>('Order', OrderSchema);

export default Order;
