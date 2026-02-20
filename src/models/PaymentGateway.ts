import mongoose, { Schema, Document, Model } from 'mongoose';

// ==========================================
// Payment Gateway Model - Burmese Digital Store
// Dynamic Payment Method Management
// ==========================================

export interface IPaymentGatewayDocument extends Document {
  name: string;          // Display name: "KBZ Pay", "Wave Money", "USDT"
  code: string;          // Unique code: "kpay", "wave", "usdt", "usdc"
  type: 'manual' | 'online'; // manual = screenshot upload, online = API-based (future)
  category: 'myanmar' | 'crypto'; // myanmar = always show, crypto = per-product toggle
  accountName: string;   // For manual: account holder name
  accountNumber: string; // For manual: phone/account number
  qrImage?: string;      // QR code image path
  instructions?: string; // Payment instructions
  enabled: boolean;
  displayOrder: number;  // Sort order for UI
  createdAt: Date;
  updatedAt: Date;
}

const PaymentGatewaySchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Gateway name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    code: {
      type: String,
      required: [true, 'Gateway code is required'],
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: [50, 'Code cannot exceed 50 characters'],
      match: [/^[a-z0-9_-]+$/, 'Code can only contain lowercase letters, numbers, hyphens and underscores'],
    },
    type: {
      type: String,
      enum: ['manual', 'online'],
      default: 'manual',
    },
    category: {
      type: String,
      enum: ['myanmar', 'crypto'],
      default: 'myanmar',
    },
    accountName: {
      type: String,
      trim: true,
      default: '',
    },
    accountNumber: {
      type: String,
      trim: true,
      default: '',
    },
    qrImage: {
      type: String,
      default: null,
    },
    instructions: {
      type: String,
      trim: true,
      maxlength: [500, 'Instructions cannot exceed 500 characters'],
      default: '',
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
PaymentGatewaySchema.index({ enabled: 1, displayOrder: 1 });

const PaymentGateway: Model<IPaymentGatewayDocument> =
  mongoose.models.PaymentGateway ||
  mongoose.model<IPaymentGatewayDocument>('PaymentGateway', PaymentGatewaySchema);

export default PaymentGateway;

/**
 * Get all enabled payment gateways, sorted by displayOrder.
 */
export async function getEnabledGateways() {
  return PaymentGateway.find({ enabled: true }).sort({ displayOrder: 1 }).lean<IPaymentGatewayDocument[]>();
}

/**
 * Seed default payment gateways if none exist.
 * Call this on app startup or first access.
 */
export async function seedDefaultGateways(): Promise<void> {
  const count = await PaymentGateway.countDocuments();
  if (count > 0) return;

  const defaults = [
    { name: 'KBZ Pay', code: 'kpay', type: 'manual', category: 'myanmar', displayOrder: 1 },
    { name: 'Wave Money', code: 'wave', type: 'manual', category: 'myanmar', displayOrder: 2 },
    { name: 'UAB Pay', code: 'uabpay', type: 'manual', category: 'myanmar', displayOrder: 3 },
    { name: 'AYA Pay', code: 'ayapay', type: 'manual', category: 'myanmar', displayOrder: 4 },
    { name: 'USDT (Tether)', code: 'usdt', type: 'manual', category: 'crypto', displayOrder: 10 },
    { name: 'USDC', code: 'usdc', type: 'manual', category: 'crypto', displayOrder: 11 },
  ];

  await PaymentGateway.insertMany(defaults);
}
