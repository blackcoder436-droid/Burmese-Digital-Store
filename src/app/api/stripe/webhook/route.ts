import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import { createNotification } from '@/models/Notification';
import type { NotificationType } from '@/models/Notification';

const log = createLogger({ route: '/api/stripe/webhook' });

// POST /api/stripe/webhook - Handle Stripe webhook events
export async function POST(request: NextRequest) {
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore -- stripe is an optional dependency
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-04-30.basil' });

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      log.error('Stripe webhook signature verification failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const metadata = session.metadata;

      if (!metadata?.userId || !metadata?.productId) {
        log.error('Stripe webhook missing metadata', { sessionId: session.id });
        return NextResponse.json({ received: true });
      }

      await connectDB();

      const quantity = parseInt(metadata.quantity || '1');
      const productId = metadata.productId;
      const userId = metadata.userId;

      // Find available product details
      const product = await Product.findById(productId);
      if (!product) {
        log.error('Stripe webhook: product not found', { productId });
        return NextResponse.json({ received: true });
      }

      const availableDetails = product.details.filter((d: { sold: boolean }) => !d.sold).slice(0, quantity);
      const deliveredKeys = availableDetails.map((d: { serialKey?: string; loginEmail?: string; loginPassword?: string; additionalInfo?: string }) => ({
        serialKey: d.serialKey,
        loginEmail: d.loginEmail,
        loginPassword: d.loginPassword,
        additionalInfo: d.additionalInfo,
      }));

      // Mark details as sold
      for (const detail of availableDetails) {
        detail.sold = true;
        detail.soldTo = userId;
        detail.soldAt = new Date();
      }
      product.stock = product.details.filter((d: { sold: boolean }) => !d.sold).length;
      await product.save();

      // Create order
      const order = new Order({
        user: userId,
        product: productId,
        orderType: 'product',
        quantity,
        totalAmount: parseInt(metadata.originalAmountMmk || '0'),
        paymentMethod: 'stripe',
        paymentScreenshot: `stripe:${session.id}`,
        transactionId: session.payment_intent || session.id,
        status: 'completed',
        deliveredKeys,
      });
      await order.save();

      // Notify user
      createNotification({
        user: userId,
        type: 'order_status' as any,
        title: 'Order Completed',
        message: `Your order ${order.orderNumber} has been completed via Stripe payment.`,
        link: `/account/orders/${order._id}`,
      }).catch(() => {});

      log.info('Stripe payment completed', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        sessionId: session.id,
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    log.error('Stripe webhook error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
