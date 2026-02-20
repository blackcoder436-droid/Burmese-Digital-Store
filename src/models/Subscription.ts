import mongoose, { Schema, Document, Model } from 'mongoose';

// ==========================================
// Subscription Model - Burmese Digital Store
// ==========================================

export interface ISubscriptionDocument extends Document {
  user: mongoose.Types.ObjectId;
  product: mongoose.Types.ObjectId;
  order: mongoose.Types.ObjectId; // Original order
  status: 'active' | 'expired' | 'cancelled';
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
  lastRenewalDate?: Date;
  nextRenewalDate?: Date;
  renewalCount: number;
  cancelledAt?: Date;
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema: Schema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product is required'],
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order is required'],
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled'],
      default: 'active',
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    autoRenew: {
      type: Boolean,
      default: true,
    },
    lastRenewalDate: {
      type: Date,
      default: null,
    },
    nextRenewalDate: {
      type: Date,
      default: null,
    },
    renewalCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelReason: {
      type: String,
      maxlength: [500, 'Cancel reason cannot exceed 500 characters'],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
SubscriptionSchema.index({ user: 1, status: 1 });
SubscriptionSchema.index({ status: 1, endDate: 1 });
SubscriptionSchema.index({ product: 1 });
SubscriptionSchema.index({ nextRenewalDate: 1, status: 1 });

const Subscription: Model<ISubscriptionDocument> =
  mongoose.models.Subscription || mongoose.model<ISubscriptionDocument>('Subscription', SubscriptionSchema);

export default Subscription;
