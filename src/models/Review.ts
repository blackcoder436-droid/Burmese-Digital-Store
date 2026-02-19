import mongoose, { Schema, Document } from 'mongoose';

// ==========================================
// Review Model — Burmese Digital Store
// Product review/rating system
// ==========================================

export interface IReviewDocument extends Document {
  user: mongoose.Types.ObjectId;
  product: mongoose.Types.ObjectId;
  order: mongoose.Types.ObjectId;
  rating: number; // 1-5 stars
  comment: string;
  helpful: number; // helpful vote count
  verified: boolean; // auto-set: user purchased the product
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReviewDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, minlength: 5, maxlength: 1000 },
    helpful: { type: Number, default: 0 },
    verified: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// One review per user per product
ReviewSchema.index({ user: 1, product: 1 }, { unique: true });
// Quick lookup: all reviews for a product, newest first
ReviewSchema.index({ product: 1, createdAt: -1 });
// Quick lookup by order (to check if already reviewed)
ReviewSchema.index({ order: 1 });

export default mongoose.models.Review ||
  mongoose.model<IReviewDocument>('Review', ReviewSchema);
