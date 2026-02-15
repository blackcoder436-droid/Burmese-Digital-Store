import mongoose, { Schema, Document, Model } from 'mongoose';

// ==========================================
// Activity Log Model - Burmese Digital Store
// ==========================================

export type ActivityAction =
  | 'order_approved'
  | 'order_rejected'
  | 'order_refunded'
  | 'product_created'
  | 'product_updated'
  | 'product_deleted'
  | 'user_promoted'
  | 'user_demoted'
  | 'user_deleted'
  | 'settings_updated'
  | 'coupon_created'
  | 'coupon_deleted'
  | 'coupon_activated'
  | 'coupon_deactivated'
  | 'vpn_provisioned'
  | 'vpn_provision_failed'
  | 'vpn_revoked';

export interface IActivityLogDocument extends Document {
  admin: mongoose.Types.ObjectId;
  action: ActivityAction;
  target: string; // e.g. "Order #abc123", "Product: Canva Pro"
  details?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const ActivityLogSchema: Schema = new Schema(
  {
    admin: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'order_approved',
        'order_rejected',
        'order_refunded',
        'product_created',
        'product_updated',
        'product_deleted',
        'user_promoted',
        'user_demoted',
        'user_deleted',
        'settings_updated',
        'coupon_created',
        'coupon_deleted',
        'coupon_activated',
        'coupon_deactivated',
        'vpn_provisioned',
        'vpn_provision_failed',
        'vpn_revoked',
      ],
    },
    target: {
      type: String,
      required: true,
      trim: true,
    },
    details: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ admin: 1, createdAt: -1 });
ActivityLogSchema.index({ action: 1 });
// Auto-delete logs after 90 days
ActivityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const ActivityLog: Model<IActivityLogDocument> =
  mongoose.models.ActivityLog ||
  mongoose.model<IActivityLogDocument>('ActivityLog', ActivityLogSchema);

export default ActivityLog;

/**
 * Helper to create an activity log entry.
 */
export async function logActivity(data: {
  admin: string;
  action: ActivityAction;
  target: string;
  details?: string;
  metadata?: Record<string, unknown>;
}): Promise<IActivityLogDocument> {
  return ActivityLog.create(data);
}
