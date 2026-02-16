import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { logActivity } from '@/models/ActivityLog';
import { provisionVpnKey, revokeVpnKey } from '@/lib/xui';
import { getPlan } from '@/lib/vpn-plans';
import { getServer } from '@/lib/vpn-servers';
import User from '@/models/User';
import { createLogger } from '@/lib/logger';
import { expireOverdueOrders } from '@/lib/fraud-detection';
import { isValidObjectId as isValidOid } from 'mongoose';
import { releaseFromQuarantine, deleteFromQuarantine } from '@/lib/quarantine';

const log = createLogger({ route: '/api/admin/orders' });


// GET /api/admin/orders - List all orders (admin)
export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
    await connectDB();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    // Validate status against allowed values
    if (status) {
      const validStatuses = ['pending', 'verifying', 'completed', 'rejected', 'refunded'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { success: false, error: 'Invalid status filter' },
          { status: 400 }
        );
      }
      query.status = status;
    }

    // Support additional filters
    const orderType = searchParams.get('orderType');
    const requiresReview = searchParams.get('requiresReview');
    const hasFraudFlags = searchParams.get('hasFraudFlags');

    if (orderType) query.orderType = orderType;
    if (requiresReview === 'true') query.requiresManualReview = true;
    if (hasFraudFlags === 'true') query.fraudFlags = { $exists: true, $ne: [] };

    // Auto-expire overdue orders on each admin fetch
    try {
      await expireOverdueOrders();
    } catch (e) {
      log.warn('Auto-expire check failed', { error: e instanceof Error ? e.message : String(e) });
    }

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('user', 'name email')
        .populate('product', 'name category price')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        orders,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    console.error('Admin orders GET error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/admin/orders - Update order status & deliver keys / provision VPN
export async function PATCH(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const admin = await requireAdmin();
    await connectDB();

    const { orderId, status, adminNote, rejectReason, verificationChecklist } = await request.json();

    if (!orderId || !status) {
      return NextResponse.json(
        { success: false, error: 'Order ID and status are required' },
        { status: 400 }
      );
    }

    // Validate orderId format
    if (!isValidOid(orderId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid order ID format' },
        { status: 400 }
      );
    }

    // Validate status against allowed values
    const validStatuses = ['pending', 'verifying', 'completed', 'rejected', 'refunded'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid order status' },
        { status: 400 }
      );
    }

    // Require reject reason when rejecting
    if (status === 'rejected' && !rejectReason && !adminNote) {
      return NextResponse.json(
        { success: false, error: 'Reject reason is required when rejecting an order' },
        { status: 400 }
      );
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // If completing the order, deliver keys or provision VPN
    if (status === 'completed' && order.status !== 'completed') {

      // ---- VPN ORDER: provision key via 3xUI ----
      if (order.orderType === 'vpn' && order.vpnPlan) {
        // Idempotency guard: prevent double-provision
        if (order.vpnProvisionStatus === 'provisioned' && order.vpnKey?.clientUUID) {
          log.warn('VPN already provisioned, skipping duplicate', { orderId: order._id });
          order.status = status;
          if (adminNote) order.adminNote = adminNote;
          await order.save();
          return NextResponse.json({ success: true, data: { order }, message: 'Order already provisioned' });
        }

        const vpnPlan = order.vpnPlan;
        const plan = getPlan(vpnPlan.planId);
        const server = await getServer(vpnPlan.serverId);

        if (!plan || !server) {
          return NextResponse.json(
            { success: false, error: 'Invalid VPN plan or server configuration' },
            { status: 400 }
          );
        }

        // Get user info for the client name
        const user = await User.findById(order.user).select('name email').lean() as { name?: string; email?: string } | null;
        const username = user?.name || user?.email?.split('@')[0] || '';

        log.info('Provisioning VPN key', {
          orderId: order._id,
          serverId: vpnPlan.serverId,
          planId: vpnPlan.planId,
        });

        const result = await provisionVpnKey({
          serverId: vpnPlan.serverId,
          username,
          userId: order.user.toString(),
          devices: plan.devices,
          expiryDays: plan.expiryDays,
          dataLimitGB: plan.dataLimitGB,
          protocol: vpnPlan.protocol || 'trojan',
        });

        if (!result) {
          // Provision failed
          order.vpnProvisionStatus = 'failed';
          await order.save();

          try {
            await logActivity({
              admin: admin.userId,
              action: 'vpn_provision_failed',
              target: `VPN Order #${order._id.toString().slice(-8)}`,
              details: `Failed to provision on ${server.name}`,
              metadata: { orderId: order._id, serverId: vpnPlan.serverId },
            });
          } catch { /* don't fail for logging */ }

          return NextResponse.json(
            { success: false, error: 'VPN key provisioning failed. Check server connectivity.' },
            { status: 500 }
          );
        }

        // Save VPN key data
        order.vpnKey = {
          clientEmail: result.clientEmail,
          clientUUID: result.clientUUID,
          subId: result.subId,
          subLink: result.subLink,
          configLink: result.configLink,
          protocol: result.protocol,
          expiryTime: result.expiryTime,
          provisionedAt: new Date(),
        };
        order.vpnProvisionStatus = 'provisioned';

        try {
          await logActivity({
            admin: admin.userId,
            action: 'vpn_provisioned',
            target: `VPN Order #${order._id.toString().slice(-8)} — ${server.name}`,
            details: `${plan.name}, ${plan.devices} device(s)`,
            metadata: { orderId: order._id, serverId: vpnPlan.serverId, clientEmail: result.clientEmail },
          });
        } catch { /* don't fail for logging */ }

      } else {
        // ---- PRODUCT ORDER: deliver keys from stock ----
        const product = await Product.findById(order.product);
        if (!product) {
          return NextResponse.json(
            { success: false, error: 'Product not found' },
            { status: 404 }
          );
        }

        const keysToDeliver = product.details
          .filter((d: { sold: boolean }) => !d.sold)
          .slice(0, order.quantity);

        if (keysToDeliver.length < order.quantity) {
          return NextResponse.json(
            { success: false, error: 'Not enough stock to fulfill this order' },
            { status: 400 }
          );
        }

        // Mark keys as sold
        for (const key of keysToDeliver) {
          key.sold = true;
          key.soldTo = order.user;
          key.soldAt = new Date();
        }
        await product.save();

        // Update product stock
        await Product.findByIdAndUpdate(product._id, {
          stock: product.details.filter((d: { sold: boolean }) => !d.sold).length,
        });

        order.deliveredKeys = keysToDeliver.map((k: { serialKey?: string; loginEmail?: string; loginPassword?: string; additionalInfo?: string }) => ({
          serialKey: k.serialKey,
          loginEmail: k.loginEmail,
          loginPassword: k.loginPassword,
          additionalInfo: k.additionalInfo,
        }));
      }
    }

    // ---- VPN ORDER: revoke key on reject/refund ----
    if (
      (status === 'rejected' || status === 'refunded') &&
      order.orderType === 'vpn' &&
      order.vpnProvisionStatus === 'provisioned' &&
      order.vpnKey?.clientEmail &&
      order.vpnPlan?.serverId
    ) {
      try {
        const revoked = await revokeVpnKey(order.vpnPlan.serverId, order.vpnKey.clientEmail);
        if (revoked) {
          order.vpnProvisionStatus = 'revoked';
          log.info('VPN key revoked on reject/refund', { orderId: order._id, clientEmail: order.vpnKey.clientEmail });
          await logActivity({
            admin: admin.userId,
            action: 'vpn_revoked',
            target: `VPN Order #${order._id.toString().slice(-8)}`,
            details: `Key revoked on ${status}`,
            metadata: { orderId: order._id, serverId: order.vpnPlan.serverId, clientEmail: order.vpnKey.clientEmail },
          });
        } else {
          log.warn('Failed to revoke VPN key', { orderId: order._id });
        }
      } catch (revokeErr) {
        log.error('Error revoking VPN key', { error: revokeErr instanceof Error ? revokeErr.message : String(revokeErr) });
      }
    }

    order.status = status;
    if (adminNote) order.adminNote = adminNote;
    if (rejectReason) order.rejectReason = rejectReason;

    // S7: Release/delete quarantined screenshot based on status
    if (order.paymentScreenshot) {
      const screenshotRelPath = order.paymentScreenshot.startsWith('/')
        ? order.paymentScreenshot.slice(1)
        : order.paymentScreenshot;
      if (status === 'completed') {
        // Release screenshot from quarantine to public directory
        await releaseFromQuarantine(screenshotRelPath);
      } else if (status === 'rejected') {
        // Delete quarantined screenshot on rejection
        await deleteFromQuarantine(screenshotRelPath);
      }
    }

    // Save verification checklist if provided (on approve)
    if (verificationChecklist && status === 'completed') {
      order.verificationChecklist = {
        ...verificationChecklist,
        completedAt: new Date(),
        completedBy: admin.userId,
      };
    }

    await order.save();

    // Log activity for status changes
    try {
      let targetLabel = '';
      if (order.orderType === 'vpn' && order.vpnPlan) {
        const server = await getServer(order.vpnPlan.serverId);
        targetLabel = `VPN Order #${order._id.toString().slice(-8)} — ${server?.name || order.vpnPlan.serverId}`;
      } else {
        const productDoc = await Product.findById(order.product).select('name').lean() as { name?: string } | null;
        targetLabel = `Order #${order._id.toString().slice(-8)} — ${productDoc?.name || 'Product'}`;
      }

      const actionMap: Record<string, 'order_approved' | 'order_rejected' | 'order_refunded'> = {
        completed: 'order_approved',
        rejected: 'order_rejected',
        refunded: 'order_refunded',
      };
      if (actionMap[status]) {
        await logActivity({
          admin: admin.userId,
          action: actionMap[status],
          target: targetLabel,
          details: adminNote || undefined,
          metadata: { orderId: order._id, amount: order.totalAmount },
        });
      }
    } catch { /* don't fail order for logging */ }

    return NextResponse.json({
      success: true,
      data: { order },
      message: `Order ${status} successfully`,
    });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    log.error('Admin order PATCH error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/admin/orders - VPN admin actions (retry provision, revoke key)
export async function PUT(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const admin = await requireAdmin();
    await connectDB();

    const { orderId, action } = await request.json();

    if (!orderId || !['retry_provision', 'revoke_key'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'orderId and valid action (retry_provision | revoke_key) required' },
        { status: 400 }
      );
    }

    if (!isValidOid(orderId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid order ID format' },
        { status: 400 }
      );
    }

    const order = await Order.findById(orderId);
    if (!order || order.orderType !== 'vpn') {
      return NextResponse.json(
        { success: false, error: 'VPN order not found' },
        { status: 404 }
      );
    }

    // ---- RETRY PROVISION ----
    if (action === 'retry_provision') {
      if (order.vpnProvisionStatus === 'provisioned') {
        return NextResponse.json(
          { success: false, error: 'Order already provisioned' },
          { status: 400 }
        );
      }
      if (!order.vpnPlan) {
        return NextResponse.json(
          { success: false, error: 'VPN plan data missing' },
          { status: 400 }
        );
      }

      const vpnPlan = order.vpnPlan;
      const plan = getPlan(vpnPlan.planId);
      const server = await getServer(vpnPlan.serverId);
      if (!plan || !server) {
        return NextResponse.json(
          { success: false, error: 'Invalid VPN plan or server' },
          { status: 400 }
        );
      }

      const user = await User.findById(order.user).select('name email').lean() as { name?: string; email?: string } | null;
      const username = user?.name || user?.email?.split('@')[0] || '';

      log.info('Retrying VPN provision', { orderId: order._id, serverId: vpnPlan.serverId });

      const result = await provisionVpnKey({
        serverId: vpnPlan.serverId,
        username,
        userId: order.user.toString(),
        devices: plan.devices,
        expiryDays: plan.expiryDays,
        dataLimitGB: plan.dataLimitGB,
        protocol: 'trojan',
      });

      if (!result) {
        order.vpnProvisionStatus = 'failed';
        await order.save();
        try {
          await logActivity({
            admin: admin.userId,
            action: 'vpn_provision_failed',
            target: `VPN Order #${order._id.toString().slice(-8)}`,
            details: `Retry failed on ${server.name}`,
            metadata: { orderId: order._id, serverId: vpnPlan.serverId },
          });
        } catch { /* */ }
        return NextResponse.json(
          { success: false, error: 'Provisioning failed. Check server connectivity.' },
          { status: 500 }
        );
      }

      order.vpnKey = {
        clientEmail: result.clientEmail,
        clientUUID: result.clientUUID,
        subId: result.subId,
        subLink: result.subLink,
        configLink: result.configLink,
        protocol: result.protocol,
        expiryTime: result.expiryTime,
        provisionedAt: new Date(),
      };
      order.vpnProvisionStatus = 'provisioned';
      order.status = 'completed';
      await order.save();

      try {
        await logActivity({
          admin: admin.userId,
          action: 'vpn_provisioned',
          target: `VPN Order #${order._id.toString().slice(-8)} — ${server.name}`,
          details: `Retry successful: ${plan.name}`,
          metadata: { orderId: order._id, serverId: vpnPlan.serverId, clientEmail: result.clientEmail },
        });
      } catch { /* */ }

      return NextResponse.json({
        success: true,
        data: { order },
        message: 'VPN key provisioned successfully',
      });
    }

    // ---- REVOKE KEY ----
    if (action === 'revoke_key') {
      if (order.vpnProvisionStatus !== 'provisioned' || !order.vpnKey?.clientEmail) {
        return NextResponse.json(
          { success: false, error: 'No active VPN key to revoke' },
          { status: 400 }
        );
      }

      const revoked = await revokeVpnKey(order.vpnPlan!.serverId, order.vpnKey.clientEmail);
      if (!revoked) {
        return NextResponse.json(
          { success: false, error: 'Failed to revoke key from panel' },
          { status: 500 }
        );
      }

      order.vpnProvisionStatus = 'revoked';
      await order.save();

      try {
        await logActivity({
          admin: admin.userId,
          action: 'vpn_revoked',
          target: `VPN Order #${order._id.toString().slice(-8)}`,
          details: `Manually revoked`,
          metadata: { orderId: order._id, serverId: order.vpnPlan!.serverId, clientEmail: order.vpnKey.clientEmail },
        });
      } catch { /* */ }

      return NextResponse.json({
        success: true,
        data: { order },
        message: 'VPN key revoked successfully',
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    log.error('Admin order PUT error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
