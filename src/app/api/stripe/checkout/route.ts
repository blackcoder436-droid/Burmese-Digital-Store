import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { createLogger } from '@/lib/logger';
import { isValidObjectId } from '@/lib/security';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';

const log = createLogger({ route: '/api/stripe/checkout' });

// POST /api/stripe/checkout - Create Stripe Checkout Session
export async function POST(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    if (!STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { success: false, error: 'Stripe is not configured. Please contact support.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { productId, quantity = 1 } = body;

    if (!productId || !isValidObjectId(productId)) {
      return NextResponse.json({ success: false, error: 'Invalid product ID' }, { status: 400 });
    }

    await connectDB();

    const product = await Product.findById(productId);
    if (!product || !product.active || product.purchaseDisabled) {
      return NextResponse.json({ success: false, error: 'Product not available' }, { status: 404 });
    }

    const availableStock = product.details.filter((d: { sold: boolean }) => !d.sold).length;
    if (availableStock < quantity) {
      return NextResponse.json({ success: false, error: 'Not enough stock' }, { status: 400 });
    }

    // Dynamic import stripe to avoid loading it when not configured
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore -- stripe is an optional dependency
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-04-30.basil' });

    const baseUrl = process.env.NEXT_PUBLIC_URL || request.headers.get('origin') || 'http://localhost:3000';

    // Convert MMK to USD (approximate rate, should be configured)
    const mmkToUsdRate = parseFloat(process.env.MMK_TO_USD_RATE || '0.00048');
    const amountUsd = Math.max(50, Math.round(product.price * quantity * mmkToUsdRate * 100)); // in cents, minimum $0.50

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: product.name,
              description: product.description?.slice(0, 200),
            },
            unit_amount: amountUsd,
          },
          quantity,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/shop/${product.slug}`,
      metadata: {
        userId: authUser.userId,
        productId: productId,
        quantity: String(quantity),
        originalAmountMmk: String(product.price * quantity),
      },
      customer_email: authUser.email,
    });

    log.info('Stripe checkout session created', {
      sessionId: session.id,
      userId: authUser.userId,
      productId,
    });

    return NextResponse.json({
      success: true,
      data: { url: session.url, sessionId: session.id },
    });
  } catch (error) {
    log.error('Stripe checkout error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
