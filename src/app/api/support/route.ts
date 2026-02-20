import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import SupportTicket from '@/models/SupportTicket';
import { getAuthUser } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { sendSupportTicketNotification } from '@/lib/telegram';
import { sanitizeString } from '@/lib/security';

// GET /api/support - List user's tickets
export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);

    const query: Record<string, unknown> = { user: authUser.userId };
    if (status && ['open', 'in-progress', 'resolved', 'closed'].includes(status)) {
      query.status = status;
    }

    const [tickets, total] = await Promise.all([
      SupportTicket.find(query)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-messages')
        .lean(),
      SupportTicket.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        tickets,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch tickets' },
      { status: 500 }
    );
  }
}

// POST /api/support - Create a new ticket
export async function POST(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    await connectDB();

    // Limit open tickets per user
    const openCount = await SupportTicket.countDocuments({
      user: authUser.userId,
      status: { $in: ['open', 'in-progress'] },
    });
    if (openCount >= 5) {
      return NextResponse.json(
        { success: false, error: 'You have too many open tickets. Please wait for existing tickets to be resolved.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { subject, category, message, relatedOrder } = body;

    if (!subject || !category || !message) {
      return NextResponse.json(
        { success: false, error: 'Subject, category, and message are required' },
        { status: 400 }
      );
    }

    const validCategories = ['order', 'payment', 'vpn', 'account', 'other'];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { success: false, error: 'Invalid category' },
        { status: 400 }
      );
    }

    const ticket = new SupportTicket({
      user: authUser.userId,
      subject: sanitizeString(subject).slice(0, 200),
      category,
      messages: [{
        sender: authUser.userId,
        senderRole: 'user',
        content: sanitizeString(message).slice(0, 2000),
      }],
      ...(relatedOrder ? { relatedOrder } : {}),
    });

    await ticket.save();

    // Send Telegram notification
    sendSupportTicketNotification({
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      category: ticket.category,
      userName: authUser.email,
      message: sanitizeString(message).slice(0, 500),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: { ticket },
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create ticket' },
      { status: 500 }
    );
  }
}
