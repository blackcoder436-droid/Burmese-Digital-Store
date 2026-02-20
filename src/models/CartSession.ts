import mongoose, { Schema, Document, Model } from 'mongoose';

export type CartAction =
  | 'cart_updated'
  | 'checkout_started'
  | 'checkout_completed';

interface ICartSnapshot {
  productId: string;
  quantity: number;
  price: number;
}

export interface ICartSessionDocument extends Document {
  sessionId: string;
  user?: mongoose.Types.ObjectId;
  lastAction: CartAction;
  itemCount: number;
  subtotal: number;
  items: ICartSnapshot[];
  checkoutStartedAt?: Date;
  checkoutCompletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CartSessionSchema: Schema = new Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    lastAction: {
      type: String,
      enum: ['cart_updated', 'checkout_started', 'checkout_completed'],
      required: true,
      default: 'cart_updated',
    },
    itemCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    items: [
      {
        productId: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true, min: 0 },
      },
    ],
    checkoutStartedAt: {
      type: Date,
      default: null,
    },
    checkoutCompletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

CartSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
CartSessionSchema.index({ checkoutCompletedAt: 1 });
CartSessionSchema.index({ itemCount: 1, updatedAt: 1 });

const CartSession: Model<ICartSessionDocument> =
  mongoose.models.CartSession || mongoose.model<ICartSessionDocument>('CartSession', CartSessionSchema);

export default CartSession;
