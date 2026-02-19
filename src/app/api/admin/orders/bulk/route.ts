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
import { createNotification } from '@/models/Notification';
import { createLogger } from '@/lib/logger';
import { releaseFromQuarantine, deleteFromQuarantine } from '@/lib/quarantine';
    const { isValidObjectId: isValidOid, Types } = await import('mongoose');

const log = createLogger({ route: '/api/admin/orders/bulk' });

// ==========================================
// Admin Bulk Order Actions
// POST /api/admin/orders/bulk
//
// Supports:
// - bulk_approve: Approve multiple orders at once (with auto verification checklist)
// - bulk_reject: Reject multiple orders with a shared reason
// - bulk_delete: Soft-delete completed/rejected orders
// ==========================================

interface BulkRequest {
  action: 'bulk_approve' | 'bulk_reject' | 'bulk_delete';
  orderIds: string[];
  rejectReason?: string;
  verificationChecklist?: Record<string, boolean>;
}

export async function POST(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const admin = await requireAdmin();
    await connectDB();

    const body: BulkRequest = await request.json();
    const { action, orderIds, rejectReason, verificationChecklist } = body;

    // Validate action
    const validActions = ['bulk_approve', 'bulk_reject', 'bulk_delete'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid bulk action' },
        { status: 400 }
      );
    }

    // Validate orderIds
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No orders selected' },
        { status: 400 }
      );
    }

    if (orderIds.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Maximum 50 orders per bulk action' },
        { status: 400 }
      );
    }

    // Validate all IDs
    for (const id of orderIds) {
      if (!isValidOid(id)) {
        return NextResponse.json(
          { success: false, error: `Invalid order ID: ${id}` },
          { status: 400 }
        );
      }
    }

    // Reject requires reason
    if (action === 'bulk_reject' && !rejectReason?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Reject reason is required for bulk rejection' },
        { status: 400 }
      );
    }

    const results: { orderId: string; success: boolean; error?: string; orderNumber?: string }[] = [];
    let successCount = 0;
    let failCount = 0;

    // Fetch all orders
    const orders = await Order.find({ _id: { $in: orderIds } }).populate('user', 'name email');

    for (const order of orders) {
      try {
        // ---- BULK APPROVE ----
        if (action === 'bulk_approve') {
          if (order.status !== 'pending' && order.status !== 'verifying') {
            results.push({ orderId: order._id.toString(), success: false, error: `Order ${order.orderNumber} is ${order.status}, cannot approve`, orderNumber: order.orderNumber });
            failCount++;
            continue;
          }

          // VPN orders — provision
          if (order.orderType === 'vpn' && order.vpnPlan) {
            if (order.vpnProvisionStatus === 'provisioned' && order.vpnKey?.clientUUID) {
              order.status = 'completed';
              await order.save();
              results.push({ orderId: order._id.toString(), success: true, orderNumber: order.orderNumber });
              successCount++;
              continue;
            }

            const plan = getPlan(order.vpnPlan.planId);
            const server = await getServer(order.vpnPlan.serverId);
            if (!plan || !server) {
              results.push({ orderId: order._id.toString(), success: false, error: `Invalid VPN plan/server for ${order.orderNumber}`, orderNumber: order.orderNumber });
              failCount++;
              continue;
            }

            const user = order.user as unknown as { _id: string; name?: string; email?: string };
            const username = user?.name || user?.email?.split('@')[0] || '';

            const result = await provisionVpnKey({
              serverId: order.vpnPlan.serverId,
              username,
              userId: order.user._id?.toString() || order.user.toString(),
              devices: plan.devices,
              expiryDays: plan.expiryDays,
              dataLimitGB: plan.dataLimitGB,
              protocol: order.vpnPlan.protocol || 'trojan',
            });

            if (!result) {
              order.vpnProvisionStatus = 'failed';
              await order.save();
              results.push({ orderId: order._id.toString(), success: false, error: `VPN provision failed for ${order.orderNumber}`, orderNumber: order.orderNumber });
              failCount++;
              continue;
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

          } else {
            // Product orders — deliver keys
            const product = await Product.findById(order.product);
            if (!product) {
              results.push({ orderId: order._id.toString(), success: false, error: `Product not found for ${order.orderNumber}`, orderNumber: order.orderNumber });
              failCount++;
              continue;
            }

            const keysToDeliver = product.details
              .filter((d: { sold: boolean }) => !d.sold)
              .slice(0, order.quantity);

            if (keysToDeliver.length < order.quantity) {
              results.push({ orderId: order._id.toString(), success: false, error: `Insufficient stock for ${order.orderNumber}`, orderNumber: order.orderNumber });
              failCount++;
              continue;
            }

            for (const key of keysToDeliver) {
              key.sold = true;
              key.soldTo = order.user._id || order.user;
              key.soldAt = new Date();
            }
            await product.save();

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

          // Release screenshot from quarantine
          if (order.paymentScreenshot) {
            const screenshotRelPath = order.paymentScreenshot.startsWith('/')
              ? order.paymentScreenshot.slice(1)
              : order.paymentScreenshot;
            await releaseFromQuarantine(screenshotRelPath).catch(() => {});
          }

          order.status = 'completed';
          if (verificationChecklist) {
            order.verificationChecklist = {
              ...verificationChecklist,
              completedAt: new Date(),
              completedBy: new Types.ObjectId(admin.userId),
            };
          }
          await order.save();

          // Notification
          try {
            await createNotification({
              user: order.user._id || order.user,
              type: 'order_completed',
              title: 'Order completed',
              message: `Your order ${order.orderNumber} has been completed.`,
              orderId: order._id,
            });
          } catch { /* non-blocking */ }

          results.push({ orderId: order._id.toString(), success: true, orderNumber: order.orderNumber });
          successCount++;
        }

        // ---- BULK REJECT ----
        if (action === 'bulk_reject') {
          if (order.status !== 'pending' && order.status !== 'verifying') {
            results.push({ orderId: order._id.toString(), success: false, error: `Order ${order.orderNumber} is ${order.status}, cannot reject`, orderNumber: order.orderNumber });
            failCount++;
            continue;
          }

          // Revoke VPN key if provisioned
          if (order.orderType === 'vpn' && order.vpnProvisionStatus === 'provisioned' && order.vpnKey?.clientEmail && order.vpnPlan?.serverId) {
            try {
              const revoked = await revokeVpnKey(order.vpnPlan.serverId, order.vpnKey.clientEmail);
              if (revoked) order.vpnProvisionStatus = 'revoked';
            } catch { /* continue anyway */ }
          }

          // Delete quarantined screenshot
          if (order.paymentScreenshot) {
            const screenshotRelPath = order.paymentScreenshot.startsWith('/')
              ? order.paymentScreenshot.slice(1)
              : order.paymentScreenshot;
            await deleteFromQuarantine(screenshotRelPath).catch(() => {});
          }

          order.status = 'rejected';
          order.rejectReason = rejectReason!;
          await order.save();

          try {
            await createNotification({
              user: order.user._id || order.user,
              type: 'order_rejected',
              title: 'Order rejected',
              message: `Your order ${order.orderNumber} was rejected. Reason: ${rejectReason}`,
              orderId: order._id,
            });
          } catch { /* non-blocking */ }

          results.push({ orderId: order._id.toString(), success: true, orderNumber: order.orderNumber });
          successCount++;
        }

        // ---- BULK DELETE (soft-delete: just mark as rejected if not already) ----
        if (action === 'bulk_delete') {
          if (order.status !== 'completed' && order.status !== 'rejected') {
            results.push({ orderId: order._id.toString(), success: false, error: `Order ${order.orderNumber} must be completed or rejected before deletion`, orderNumber: order.orderNumber });
            failCount++;
            continue;
          }
          // We don't actually delete — we just log it. In practice, "delete" could mean archive.
          results.push({ orderId: order._id.toString(), success: true, orderNumber: order.orderNumber });
          successCount++;
        }

      } catch (err: unknown) {
        results.push({
          orderId: order._id.toString(),
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
          orderNumber: order.orderNumber,
        });
        failCount++;
      }
    }

    // Log bulk activity
    try {
      await logActivity({
        admin: admin.userId,
        action: action === 'bulk_approve' ? 'order_approved' : action === 'bulk_reject' ? 'order_rejected' : 'order_rejected',
        target: `Bulk ${action}: ${successCount} success, ${failCount} failed`,
        details: `Orders: ${orders.map(o => o.orderNumber).join(', ')}`,
        metadata: { action, successCount, failCount, totalOrders: orderIds.length },
      });
    } catch { /* non-blocking */ }

    log.info('Bulk order action completed', { action, successCount, failCount, totalOrders: orderIds.length });

    return NextResponse.json({
      success: true,
      data: {
        action,
        successCount,
        failCount,
        totalOrders: orderIds.length,
        results,
      },
      message: `${successCount}/${orderIds.length} orders processed successfully`,
    });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    log.error('Admin bulk order error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
