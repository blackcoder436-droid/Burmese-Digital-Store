import mongoose, { Schema, Document, Model } from 'mongoose';

// ==========================================
// Notification Model - Burmese Digital Store
// ==========================================

export type NotificationType =
  | 'order_placed'
  | 'order_verifying'
  | 'order_completed'
  | 'order_rejected'
  | 'order_refunded'
  | 'admin_new_order';

export interface INotificationDocument extends Document {
  user: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  orderId?: mongoose.Types.ObjectId;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema: Schema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    type: {
      type: String,
      required: [true, 'Notification type is required'],
      enum: [
        'order_placed',
        'order_verifying',
        'order_completed',
        'order_rejected',
        'order_refunded',
        'admin_new_order',
      ],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      maxlength: [200, 'Title too long'],
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      maxlength: [500, 'Message too long'],
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
NotificationSchema.index({ user: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // auto-delete after 30 days

const Notification: Model<INotificationDocument> =
  mongoose.models.Notification ||
  mongoose.model<INotificationDocument>('Notification', NotificationSchema);

export default Notification;

/**
 * Create a notification for a user.
 */
export async function createNotification(data: {
  user: string | mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  orderId?: string | mongoose.Types.ObjectId;
}): Promise<INotificationDocument> {
  return Notification.create(data);
}

/**
 * Notify all admins about an event.
 */
export async function notifyAdmins(data: {
  type: NotificationType;
  title: string;
  message: string;
  orderId?: string | mongoose.Types.ObjectId;
}): Promise<void> {
  const User = mongoose.models.User;
  if (!User) return;

  const admins = await User.find({ role: 'admin' }).select('_id').lean();
  if (admins.length === 0) return;

  const notifications = admins.map((admin: any) => ({
    user: admin._id,
    type: data.type,
    title: data.title,
    message: data.message,
    orderId: data.orderId,
    read: false,
  }));

  await Notification.insertMany(notifications);
}
