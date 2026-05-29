import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { sanitizeString } from '@/lib/security';
import { getAiOpsSettings } from '@/modules/ai-ops/service';
import AiKnowledgeItem from '@/modules/ai-ops/models/AiKnowledgeItem';
import AiCommandItem from '@/modules/ai-ops/models/AiCommandItem';
import AiBotLog from '@/modules/ai-ops/models/AiBotLog';

export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
    await connectDB();

    const [settings, knowledgeCount, commandCount, logCount, recentLogs] = await Promise.all([
      getAiOpsSettings(),
      AiKnowledgeItem.countDocuments(),
      AiCommandItem.countDocuments(),
      AiBotLog.countDocuments(),
      AiBotLog.find()
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        settings,
        stats: {
          knowledgeCount,
          commandCount,
          logCount,
        },
        recentLogs,
      },
    });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const admin = await requireAdmin();
    await connectDB();

    const body = await request.json();
    const settings = await getAiOpsSettings();

    if (typeof body.enabled === 'boolean') settings.enabled = body.enabled;
    if (typeof body.customerSystemPrompt === 'string') {
      settings.customerSystemPrompt = sanitizeString(body.customerSystemPrompt).slice(0, 12000);
    }
    if (typeof body.responseStyle === 'string') {
      settings.responseStyle = sanitizeString(body.responseStyle).slice(0, 4000);
    }
    if (typeof body.fallbackReply === 'string') {
      settings.fallbackReply = sanitizeString(body.fallbackReply).slice(0, 2000);
    }
    if (typeof body.paymentAttachmentReply === 'string') {
      settings.paymentAttachmentReply = sanitizeString(body.paymentAttachmentReply).slice(0, 2000);
    }
    if (typeof body.escalationReply === 'string') {
      settings.escalationReply = sanitizeString(body.escalationReply).slice(0, 2000);
    }
    if (typeof body.maxKnowledgeItems === 'number') {
      settings.maxKnowledgeItems = Math.max(0, Math.min(Math.round(body.maxKnowledgeItems), 20));
    }
    if (typeof body.allowCustomerOrderLookup === 'boolean') {
      settings.allowCustomerOrderLookup = body.allowCustomerOrderLookup;
    }
    if (typeof body.allowAiOrderActions === 'boolean') {
      settings.allowAiOrderActions = body.allowAiOrderActions;
    }
    settings.updatedBy = admin.userId as any;

    await settings.save();

    return NextResponse.json({
      success: true,
      data: { settings },
    });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
