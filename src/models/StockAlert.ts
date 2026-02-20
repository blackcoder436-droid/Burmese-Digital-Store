import mongoose, { Schema, Document, Model } from 'mongoose';

// ==========================================
// StockAlert Model - Burmese Digital Store
// Users subscribe to get notified when out-of-stock products are restocked
// ==========================================

export interface IStockAlertDocument extends Document {
  user: mongoose.Types.ObjectId;
  product: mongoose.Types.ObjectId;
  notified: boolean;
  notifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StockAlertSchema: Schema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    notified: {
      type: Boolean,
      default: false,
    },
    notifiedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// One subscription per user per product
StockAlertSchema.index({ user: 1, product: 1 }, { unique: true });
// For querying all alerts for a product when stock is updated
StockAlertSchema.index({ product: 1, notified: 1 });

const StockAlert: Model<IStockAlertDocument> =
  mongoose.models.StockAlert || mongoose.model<IStockAlertDocument>('StockAlert', StockAlertSchema);

export default StockAlert;
