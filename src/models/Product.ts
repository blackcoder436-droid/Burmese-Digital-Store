import mongoose, { Schema, Document, Model } from 'mongoose';

// ==========================================
// Product Model - Burmese Digital Store
// ==========================================

export interface IProductDetailDocument {
  serialKey?: string;
  loginEmail?: string;
  loginPassword?: string;
  additionalInfo?: string;
  sold: boolean;
  soldTo?: mongoose.Types.ObjectId;
  soldAt?: Date;
}

export interface IProductDocument extends Document {
  name: string;
  slug: string;
  category: 'vpn' | 'streaming' | 'gaming' | 'software' | 'gift-card' | 'other';
  description: string;
  price: number;
  stock: number;
  details: IProductDetailDocument[];
  image?: string;
  featured: boolean;
  active: boolean;
  purchaseDisabled: boolean;
  allowedPaymentGateways: mongoose.Types.ObjectId[];
  // Product type: single, bundle, or subscription
  productType: 'single' | 'bundle' | 'subscription';
  // Bundle fields
  bundleItems?: { product: mongoose.Types.ObjectId; quantity: number }[];
  bundleDiscount?: number; // percentage discount for bundle
  // Subscription fields
  subscriptionDuration?: number; // in days (30 = monthly, 365 = yearly)
  subscriptionPrice?: number; // recurring price
  averageRating: number;
  reviewCount: number;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProductDetailSchema: Schema = new Schema({
  serialKey: {
    type: String,
    trim: true,
  },
  loginEmail: {
    type: String,
    trim: true,
  },
  loginPassword: {
    type: String,
    trim: true,
  },
  additionalInfo: {
    type: String,
    trim: true,
  },
  sold: {
    type: Boolean,
    default: false,
  },
  soldTo: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  soldAt: {
    type: Date,
  },
});

const ProductSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [100, 'Product name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: ['vpn', 'streaming', 'gaming', 'software', 'gift-card', 'other'],
        message: '{VALUE} is not a valid category',
      },
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    stock: {
      type: Number,
      default: 0,
      min: [0, 'Stock cannot be negative'],
    },
    details: [ProductDetailSchema],
    image: {
      type: String,
      default: '/images/default-product.png',
    },
    featured: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: true,
    },
    purchaseDisabled: {
      type: Boolean,
      default: false,
    },
    // Per-product payment gateway selection
    allowedPaymentGateways: [{
      type: Schema.Types.ObjectId,
      ref: 'PaymentGateway',
    }],
    // Product type
    productType: {
      type: String,
      enum: ['single', 'bundle', 'subscription'],
      default: 'single',
    },
    // Bundle: references to other products
    bundleItems: [{
      product: { type: Schema.Types.ObjectId, ref: 'Product' },
      quantity: { type: Number, default: 1, min: 1 },
    }],
    bundleDiscount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    // Subscription: duration and recurring price
    subscriptionDuration: {
      type: Number, // days
      default: null,
    },
    subscriptionPrice: {
      type: Number, // recurring price
      default: null,
    },
    // Soft-delete fields
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Review/Rating aggregates
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Helper: generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

// Auto-generate slug before save
ProductSchema.pre('save', async function (next) {
  if (!this.slug || this.isModified('name')) {
    let base = generateSlug(this.name as string);
    if (!base) base = 'product';
    let slug = base;
    let counter = 0;
    // Ensure uniqueness
    while (true) {
      const existing = await mongoose.models.Product?.findOne({ slug, _id: { $ne: this._id } });
      if (!existing) break;
      counter++;
      slug = `${base}-${counter}`;
    }
    this.slug = slug;
  }
  next();
});

// Virtual: available stock count
ProductSchema.virtual('availableStock').get(function (this: IProductDocument) {
  return this.details.filter((d) => !d.sold).length;
});

// Index for faster queries
ProductSchema.index({ slug: 1 }, { unique: true, sparse: true });
ProductSchema.index({ category: 1, active: 1 });
ProductSchema.index({ featured: 1, active: 1 });
ProductSchema.index({ name: 'text', description: 'text' });
ProductSchema.index({ deletedAt: 1 });
// Database indexing audit (2026-02-19)
ProductSchema.index({ active: 1, price: 1 }); // Shop price range filter
ProductSchema.index({ createdAt: -1 }); // Sort by newest

// Soft-delete: auto-exclude deleted products from normal queries
ProductSchema.pre('find', function () {
  if (!this.getQuery().includeDeleted) {
    this.where({ deletedAt: null });
  } else {
    delete this.getQuery().includeDeleted;
  }
});
ProductSchema.pre('findOne', function () {
  if (!this.getQuery().includeDeleted) {
    this.where({ deletedAt: null });
  } else {
    delete this.getQuery().includeDeleted;
  }
});
ProductSchema.pre('countDocuments', function () {
  if (!this.getQuery().includeDeleted) {
    this.where({ deletedAt: null });
  } else {
    delete this.getQuery().includeDeleted;
  }
});

const Product: Model<IProductDocument> =
  mongoose.models.Product || mongoose.model<IProductDocument>('Product', ProductSchema);

export default Product;
