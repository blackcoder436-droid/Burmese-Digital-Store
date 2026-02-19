import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import User from '@/models/User';
import { createNotification } from '@/models/Notification';
import { sendVpnExpiryReminderEmail } from '@/lib/email';
import { sendOrderNotification } from '@/lib/telegram';
import { createLogger } from '@/lib/logger';

const log = createLogger({ route: '/api/cron/vpn-expiry-reminders' });

// ==========================================
// Cron: VPN Expiry Reminders
// Sends notifications to users whose VPN keys are expiring soon.
//
// Schedule: Run daily (e.g., cron-job.org, PM2 cron)
// Reminders: 7 days, 3 days, 1 day before expiry
// Protected by CRON_SECRET header
// ==========================================

const REMINDER_DAYS = [7, 3, 1]; // days before expiry to send reminders

export async function GET(request: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    await connectDB();

    const now = Date.now();
    let totalReminders = 0;
    const results: { days: number; count: number }[] = [];

    for (const days of REMINDER_DAYS) {
      const windowStart = now + (days - 0.5) * 24 * 60 * 60 * 1000; // half-day buffer before
      const windowEnd = now + (days + 0.5) * 24 * 60 * 60 * 1000;   // half-day buffer after

      // Find VPN orders expiring within this window that haven't been reminded yet
      const expiringOrders = await Order.find({
        orderType: 'vpn',
        status: 'completed',
        vpnProvisionStatus: 'provisioned',
        'vpnKey.expiryTime': { $gte: windowStart, $lte: windowEnd },
        // Avoid duplicate reminders: check that we haven't already sent for this day window
        [`vpnExpiryReminders.${days}d`]: { $ne: true },
      })
        .populate('user', 'name email')
        .lean();

      for (const order of expiringOrders) {
        const user = order.user as unknown as { _id: string; name: string; email: string };
        if (!user?.email) continue;

        const expiryDate = new Date(order.vpnKey!.expiryTime);
        const planDesc = order.vpnPlan
          ? `${order.vpnPlan.devices} Device(s) - ${order.vpnPlan.months} Month(s)`
          : 'VPN Plan';

        // 1. In-app notification
        try {
          await createNotification({
            user: user._id,
            type: 'order_completed', // reuse closest type
            title: `VPN Expiring in ${days} Day${days > 1 ? 's' : ''}`,
            message: `Your VPN key for order ${order.orderNumber} (${planDesc}) expires on ${expiryDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}. Renew now to stay connected!`,
            orderId: order._id,
          });
        } catch (e) {
          log.warn('Failed to create expiry notification', {
            orderId: order._id,
            error: e instanceof Error ? e.message : String(e),
          });
        }

        // 2. Email reminder
        try {
          await sendVpnExpiryReminderEmail(user.email, {
            userName: user.name,
            orderNumber: order.orderNumber,
            planDescription: planDesc,
            expiryDate,
            daysRemaining: days,
          });
        } catch (e) {
          log.warn('Failed to send expiry email', {
            orderId: order._id,
            error: e instanceof Error ? e.message : String(e),
          });
        }

        // 3. Telegram notification (non-blocking)
        try {
          await sendOrderNotification(
            `⏰ <b>VPN Expiry Reminder</b>\n` +
            `👤 ${user.name} (${user.email})\n` +
            `📦 Order: ${order.orderNumber}\n` +
            `📋 ${planDesc}\n` +
            `⏳ Expires in <b>${days} day${days > 1 ? 's' : ''}</b>\n` +
            `📅 ${expiryDate.toISOString().slice(0, 10)}`
          );
        } catch { /* non-blocking */ }

        // 4. Mark as reminded so we don't send again
        await Order.updateOne(
          { _id: order._id },
          { $set: { [`vpnExpiryReminders.${days}d`]: true } }
        );

        totalReminders++;
      }

      results.push({ days, count: expiringOrders.length });
    }

    log.info('Cron: vpn-expiry-reminders completed', { totalReminders, results });

    return NextResponse.json({
      success: true,
      data: { totalReminders, results },
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    log.error('Cron: vpn-expiry-reminders failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
