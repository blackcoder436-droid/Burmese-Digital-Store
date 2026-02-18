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
export type FraudFlag = 'duplicate_txid' | 'duplicate_screenshot' | 'amount_time_suspicious' | 'first_time_user' | 'high_amount';

export interface IVerificationChecklist {
  amountVerified?: boolean;
  timeVerified?: boolean;
  accountVerified?: boolean;
  txidVerified?: boolean;
  payerVerified?: boolean;
  completedAt?: Date;
  completedBy?: string;
}

export interface IOrder {
  _id: string;
  orderNumber: string;
  user: string | IUser;
  product?: string | IProduct;
  orderType: 'product' | 'vpn';
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
  // VPN-specific
  vpnPlan?: IVpnPlan;
  vpnKey?: IVpnKey;
  vpnProvisionStatus?: VpnProvisionStatus;
  // Coupon
  couponCode?: string;
  discountAmount?: number;
  // Fraud detection
  fraudFlags: FraudFlag[];
  requiresManualReview: boolean;
  reviewReason?: string;
  verificationChecklist?: IVerificationChecklist;
  rejectReason?: string;
  paymentExpiresAt?: Date;
  screenshotHash?: string;
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
  iat?: number;
  exp?: number;
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

// ==========================================
// Coupon Types
// ==========================================

export interface ICoupon {
  _id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  usageLimit?: number;
  usageCount: number;
  perUserLimit?: number;
  categories?: string[];
  startDate?: Date;
  endDate?: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// Notification Types
// ==========================================

export type NotificationType = 'order_status' | 'order_new' | 'system' | 'vpn_provision' | 'vpn_expiry' | 'payment';

export interface INotification {
  _id: string;
  user: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: Date;
}

// ==========================================
// Site Settings Types
// ==========================================

export interface IPaymentAccount {
  method: string;
  accountName: string;
  accountNumber: string;
  qrCode?: string;
}

export interface ISiteSettings {
  _id: string;
  ocrEnabled: boolean;
  paymentAccounts: IPaymentAccount[];
  highAmountThreshold: number;
  paymentWindowMinutes: number;
  requireManualReviewForNewUsers: boolean;
}

// ==========================================
// Activity Log Types
// ==========================================

export type ActivityAction =
  | 'order_approve' | 'order_reject' | 'order_refund'
  | 'user_promote' | 'user_demote' | 'user_delete'
  | 'product_create' | 'product_update' | 'product_delete'
  | 'coupon_create' | 'coupon_update' | 'coupon_delete'
  | 'settings_update' | 'server_create' | 'server_update' | 'server_delete'
  | 'vpn_provisioned' | 'vpn_revoked' | 'vpn_provision_failed'
  | 'export_data';

export interface IActivityLog {
  _id: string;
  admin: string | IUser;
  action: ActivityAction;
  target?: string;
  targetModel?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// ==========================================
// VPN Server Types
// ==========================================

export interface IVpnServer {
  _id: string;
  serverId: string;
  name: string;
  flag: string;
  url: string;
  panelPath: string;
  domain: string;
  subPort: number;
  trojanPort?: number;
  protocols: string[];
  enabled: boolean;
  online: boolean;
  latency?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// Pagination Type
// ==========================================

export interface IPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}
