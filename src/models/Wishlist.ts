import mongoose, { Schema, Document, Model } from 'mongoose';

// ==========================================
// Wishlist Model - Burmese Digital Store
// Phase 10.4 — Wishlist / Favorites System
// ==========================================

export interface IWishlistDocument extends Document {
  user: mongoose.Types.ObjectId;
  product: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WishlistSchema: Schema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      index: true,
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product is required'],
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index: one entry per user-product pair
WishlistSchema.index({ user: 1, product: 1 }, { unique: true });

const Wishlist: Model<IWishlistDocument> =
  mongoose.models.Wishlist || mongoose.model<IWishlistDocument>('Wishlist', WishlistSchema);

export default Wishlist;
