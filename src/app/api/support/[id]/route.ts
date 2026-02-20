import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import SupportTicket from '@/models/SupportTicket';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { sanitizeString, isValidObjectId } from '@/lib/security';

// GET /api/support/[id] - Get ticket details with messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: 'Invalid ticket ID' }, { status: 400 });
    }

    await connectDB();

    const ticket = await SupportTicket.findById(id)
      .populate('messages.sender', 'name avatar role')
      .populate('relatedOrder', 'orderNumber status')
      .lean();

    if (!ticket) {
      return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });
    }

    // Only the ticket owner or admin can view
    if (ticket.user.toString() !== authUser.userId && authUser.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: { ticket } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch ticket' },
      { status: 500 }
    );
  }
}

// POST /api/support/[id] - Add a reply to the ticket
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: 'Invalid ticket ID' }, { status: 400 });
    }

    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
    }

    await connectDB();

    const ticket = await SupportTicket.findById(id);
    if (!ticket) {
      return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });
    }

    // Only the ticket owner or admin can reply
    const isOwner = ticket.user.toString() === authUser.userId;
    const isAdmin = authUser.role === 'admin';
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Can't reply to closed tickets
    if (ticket.status === 'closed') {
      return NextResponse.json({ success: false, error: 'This ticket is closed' }, { status: 400 });
    }

    ticket.messages.push({
      sender: authUser.userId,
      senderRole: isAdmin ? 'admin' : 'user',
      content: sanitizeString(message).slice(0, 2000),
    } as never);

    // If user replies, reopen to 'open'; if admin replies, set to 'in-progress'
    if (isAdmin && ticket.status === 'open') {
      ticket.status = 'in-progress';
    } else if (isOwner && ticket.status === 'resolved') {
      ticket.status = 'open';
    }

    await ticket.save();

    return NextResponse.json({
      success: true,
      data: { ticket },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to reply to ticket' },
      { status: 500 }
    );
  }
}
