import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import { createNotification } from '@/models/Notification';
import { getAvailableProductStock, getProductFulfillmentMode } from '@/lib/product-stock';
import { Types } from 'mongoose';

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
      if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(productId)) {
        log.error('Stripe webhook: invalid metadata IDs', { productId, userId });
        return NextResponse.json({ received: true });
      }
      const userObjectId = new Types.ObjectId(userId);

      // Find available product details
      const product = await Product.findById(productId);
      if (!product) {
        log.error('Stripe webhook: product not found', { productId });
        return NextResponse.json({ received: true });
      }

      const fulfillmentMode = getProductFulfillmentMode(product);
      const availableStock = getAvailableProductStock(product);
      if (availableStock < quantity) {
        log.error('Stripe webhook: not enough product stock', { productId, availableStock, quantity });
        return NextResponse.json({ received: true });
      }

      if (fulfillmentMode === 'manual') {
        const order = new Order({
          user: userObjectId,
          product: product._id,
          orderType: 'product',
          quantity,
          totalAmount: parseInt(metadata.originalAmountMmk || '0'),
          paymentMethod: 'stripe',
          paymentScreenshot: `stripe:${session.id}`,
          transactionId: session.payment_intent || session.id,
          status: 'pending',
          deliveredKeys: [],
        });
        await order.save();

        createNotification({
          user: userId,
          type: 'order_status' as any,
          title: 'Order Pending',
          message: `Your order ${order.orderNumber} is pending admin delivery.`,
        }).catch(() => {});

        log.info('Stripe manual product payment queued for admin delivery', {
          orderId: order._id,
          orderNumber: order.orderNumber,
          sessionId: session.id,
        });

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
        detail.soldTo = userObjectId;
        detail.soldAt = new Date();
      }
      product.stock = product.details.filter((d: { sold: boolean }) => !d.sold).length;
      await product.save();

      // Create order
      const order = new Order({
        user: userObjectId,
        product: product._id,
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
