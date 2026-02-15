// ==========================================
// Burmese Digital Store - Type Definitions
// ==========================================

export interface IUser {
  _id: string;
  name: string;
  email: string;
  password: string;
  role: 'user' | 'admin';
  balance: number;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProduct {
  _id: string;
  name: string;
  category: 'vpn' | 'streaming' | 'gaming' | 'software' | 'gift-card' | 'other';
  description: string;
  price: number;
  stock: number;
  details: IProductDetail[];
  image?: string;
  featured: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProductDetail {
  _id?: string;
  serialKey?: string;
  loginEmail?: string;
  loginPassword?: string;
  additionalInfo?: string;
  sold: boolean;
  soldTo?: string;
  soldAt?: Date;
}

export type OrderStatus = 'pending' | 'verifying' | 'completed' | 'rejected' | 'refunded';
export type PaymentMethod = 'kpay' | 'wavemoney' | 'cbpay' | 'ayapay';

export interface IOrder {
  _id: string;
  user: string | IUser;
  product: string | IProduct;
  quantity: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentScreenshot: string;
  transactionId: string;
  ocrVerified: boolean;
  ocrExtractedData?: {
    amount?: string;
    transactionId?: string;
    confidence: number;
  };
  status: OrderStatus;
  deliveredKeys: IProductDetail[];
  adminNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'user' | 'admin';
  tokenVersion?: number;
}

export interface OCRResult {
  transactionId: string | null;
  amount: string | null;
  confidence: number;
  rawText: string;
}

// ==========================================
// VPN Types
// ==========================================

export interface IVpnPlan {
  serverId: string;
  planId: string;
  devices: number;
  months: number;
  protocol?: string;
}

export interface IVpnKey {
  clientEmail: string; // client name in 3xUI panel
  clientUUID: string; // trojan password / vless-vmess id
  subId: string; // subscription ID (random 16 chars)
  subLink: string; // subscription URL
  configLink: string; // trojan:// or vless:// URI
  protocol: string; // trojan, vless, vmess, etc.
  expiryTime: number; // unix timestamp in ms
  provisionedAt: Date;
}

export type VpnProvisionStatus = 'pending' | 'provisioned' | 'failed' | 'revoked';
