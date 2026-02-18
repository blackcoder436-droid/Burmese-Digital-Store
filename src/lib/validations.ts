import { z } from 'zod';

// ==========================================
// Zod Validation Schemas - Burmese Digital Store
// ==========================================
// Centralized request validation for all API routes

// ---- Auth ----

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email format')
    .max(254, 'Email too long'),
  password: z
    .string()
    .min(1, 'Password is required')
    .max(128, 'Password too long'),
});

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be at most 50 characters'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email address')
    .max(254, 'Email too long'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

export const googleAuthSchema = z.object({
  credential: z
    .string()
    .min(1, 'Google credential is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name too long')
    .optional(),
  phone: z
    .string()
    .trim()
    .max(20, 'Phone number too long')
    .optional(),
});

export const deleteAccountSchema = z.object({
  password: z.string().optional(),
  confirmation: z.literal('DELETE'),
});

// ---- Orders ----

export const createOrderSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().min(1).max(100).default(1),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  transactionId: z.string().max(100).optional(),
  couponCode: z.string().max(50).optional(),
});

// ---- Coupons ----

export const applyCouponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Coupon code is required')
    .max(50, 'Code too long'),
  orderTotal: z
    .number()
    .positive('Order total must be positive'),
  productId: z.string().optional(),
});

// ---- Admin ----

export const updateOrderStatusSchema = z.object({
  status: z.enum(['pending', 'verifying', 'completed', 'rejected', 'refunded']),
  deliveryKeys: z.array(z.string()).optional(),
  adminNote: z.string().max(500).optional(),
  rejectReason: z.string().max(500).optional(),
});

// ---- VPN Orders ----

export const createVpnOrderSchema = z.object({
  serverId: z.string().min(1, 'Server ID is required'),
  planId: z.string().min(1, 'Plan ID is required'),
  devices: z
    .number()
    .int('Devices must be a whole number')
    .min(1, 'Minimum 1 device')
    .max(5, 'Maximum 5 devices'),
  months: z
    .number()
    .int('Months must be a whole number')
    .refine(
      (v) => [1, 3, 5, 7, 9, 12].includes(v),
      'Invalid plan duration — must be 1, 3, 5, 7, 9, or 12 months'
    ),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  transactionId: z.string().max(100).optional(),
  couponCode: z.string().max(50).optional(),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required').max(200),
  description: z.string().trim().max(5000).optional(),
  price: z.number().positive('Price must be positive'),
  originalPrice: z.number().positive().optional(),
  category: z.string().min(1, 'Category is required'),
  image: z.string().optional(),
  stock: z.number().int().min(0).default(0),
  deliveryKeys: z.array(z.string()).optional(),
  features: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
});

// ---- Helper: Format errors ----

export function formatZodErrors(error: z.ZodError): string {
  return error.issues.map((e) => e.message).join(', ');
}

/**
 * Safely parse request body with a Zod schema.
 * Returns { success: true, data } or { success: false, error }.
 */
export function parseBody<T extends z.ZodType>(
  schema: T,
  body: unknown
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return { success: false, error: formatZodErrors(result.error) };
  }
  return { success: true, data: result.data };
}
