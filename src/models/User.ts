import mongoose, { Schema, Document, Model } from 'mongoose';

// ==========================================
// User Model - Burmese Digital Store
// ==========================================

export interface IUserDocument extends Document {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: 'user' | 'admin';
  balance: number;
  avatar?: string;
  googleId?: string;
  tokenVersion: number;
  freeVpnTestUsedAt?: Date;
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, 'Phone number cannot exceed 20 characters'],
      default: null,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Don't return password by default
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    avatar: {
      type: String,
      default: null,
    },
    googleId: {
      type: String,
      default: null,
      sparse: true,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    freeVpnTestUsedAt: {
      type: Date,
      default: null,
    },
    // Email verification fields
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      default: null,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      default: null,
      select: false,
    },
    resetPasswordToken: {
      type: String,
      default: null,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
      select: false,
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
  },
  {
    timestamps: true,
  }
);

// Index for faster queries (email index already created by unique: true)
UserSchema.index({ role: 1 });
UserSchema.index({ deletedAt: 1 });
// Database indexing audit (2026-02-19)
UserSchema.index({ name: 'text', email: 'text' }); // Admin user search
UserSchema.index({ createdAt: -1 }); // Analytics user growth sorting

// Soft-delete: auto-exclude deleted users from normal queries
UserSchema.pre('find', function () {
  if (!this.getQuery().includeDeleted) {
    this.where({ deletedAt: null });
  } else {
    delete this.getQuery().includeDeleted;
  }
});
UserSchema.pre('findOne', function () {
  if (!this.getQuery().includeDeleted) {
    this.where({ deletedAt: null });
  } else {
    delete this.getQuery().includeDeleted;
  }
});
UserSchema.pre('countDocuments', function () {
  if (!this.getQuery().includeDeleted) {
    this.where({ deletedAt: null });
  } else {
    delete this.getQuery().includeDeleted;
  }
});

const User: Model<IUserDocument> =
  mongoose.models.User || mongoose.model<IUserDocument>('User', UserSchema);

export default User;
