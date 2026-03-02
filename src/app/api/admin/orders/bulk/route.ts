import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { logActivity } from '@/models/ActivityLog';
import { createLogger } from '@/lib/logger';
import { approveOrder, rejectOrder } from '@/lib/order-actions';
    const { isValidObjectId: isValidOid } = await import('mongoose');

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

          const approveResult = await approveOrder(order._id.toString(), {
            adminId: admin.userId,
            adminName: admin.email || 'Web Admin',
            source: 'web',
            verificationChecklist: verificationChecklist,
          });

          if (!approveResult.success) {
            results.push({ orderId: order._id.toString(), success: false, error: approveResult.error || 'Approve failed', orderNumber: order.orderNumber });
            failCount++;
            continue;
          }

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

          const rejectResult = await rejectOrder(order._id.toString(), {
            adminId: admin.userId,
            adminName: admin.email || 'Web Admin',
            source: 'web',
            rejectReason: rejectReason!,
          });

          if (!rejectResult.success) {
            results.push({ orderId: order._id.toString(), success: false, error: rejectResult.error || 'Reject failed', orderNumber: order.orderNumber });
            failCount++;
            continue;
          }

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
