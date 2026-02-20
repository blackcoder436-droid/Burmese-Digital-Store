import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import SupportTicket from '@/models/SupportTicket';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { sanitizeString, isValidObjectId } from '@/lib/security';
import { createNotification } from '@/models/Notification';
import type { NotificationType } from '@/models/Notification';

// GET /api/admin/support/[id] - Get ticket detail (admin)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const authUser = await getAuthUser();
    if (!authUser || authUser.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: 'Invalid ticket ID' }, { status: 400 });
    }

    await connectDB();

    const ticket = await SupportTicket.findById(id)
      .populate('user', 'name email avatar')
      .populate('messages.sender', 'name avatar role')
      .populate('relatedOrder', 'orderNumber status totalAmount')
      .populate('assignedTo', 'name email')
      .lean();

    if (!ticket) {
      return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { ticket } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch ticket' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/support/[id] - Update ticket (status, priority, assign, reply)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const authUser = await getAuthUser();
    if (!authUser || authUser.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: 'Invalid ticket ID' }, { status: 400 });
    }

    const body = await request.json();
    const { status, priority, assignedTo, message } = body;

    await connectDB();

    const ticket = await SupportTicket.findById(id);
    if (!ticket) {
      return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });
    }

    // Update fields
    if (status && ['open', 'in-progress', 'resolved', 'closed'].includes(status)) {
      ticket.status = status;
      if (status === 'closed') {
        ticket.closedAt = new Date();
        ticket.closedBy = authUser.userId as never;
      }
      if (status === 'resolved' || status === 'closed') {
        // Notify user
        createNotification({
          user: ticket.user,
          type: 'system' as any,
          title: status === 'resolved' ? 'Ticket Resolved' : 'Ticket Closed',
          message: `Your support ticket ${ticket.ticketNumber} has been ${status}.`,
          link: `/account/support/${ticket._id}`,
        }).catch(() => {});
      }
    }

    if (priority && ['low', 'medium', 'high'].includes(priority)) {
      ticket.priority = priority;
    }

    if (assignedTo) {
      ticket.assignedTo = assignedTo;
    }

    // Admin reply
    if (message && typeof message === 'string' && message.trim().length > 0) {
      ticket.messages.push({
        sender: authUser.userId,
        senderRole: 'admin',
        content: sanitizeString(message).slice(0, 2000),
      } as never);

      if (ticket.status === 'open') {
        ticket.status = 'in-progress';
      }

      // Notify user about admin reply
      createNotification({
        user: ticket.user,
        type: 'system' as any,
        title: 'Support Reply',
        message: `Admin replied to your ticket ${ticket.ticketNumber}`,
        link: `/account/support/${ticket._id}`,
      }).catch(() => {});
    }

    await ticket.save();

    return NextResponse.json({
      success: true,
      data: { ticket },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update ticket' },
      { status: 500 }
    );
  }
}
