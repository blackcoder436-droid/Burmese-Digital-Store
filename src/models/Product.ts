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
  category: 'vpn' | 'streaming' | 'gaming' | 'software' | 'gift-card' | 'other';
  description: string;
  price: number;
  stock: number;
  details: IProductDetailDocument[];
  image?: string;
  featured: boolean;
  active: boolean;
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
  },
  {
    timestamps: true,
  }
);

// Virtual: available stock count
ProductSchema.virtual('availableStock').get(function (this: IProductDocument) {
  return this.details.filter((d) => !d.sold).length;
});

// Index for faster queries
ProductSchema.index({ category: 1, active: 1 });
ProductSchema.index({ featured: 1, active: 1 });
ProductSchema.index({ name: 'text', description: 'text' });

const Product: Model<IProductDocument> =
  mongoose.models.Product || mongoose.model<IProductDocument>('Product', ProductSchema);

export default Product;
