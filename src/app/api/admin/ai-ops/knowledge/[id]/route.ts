import { NextRequest, NextResponse } from 'next/server';
import { isValidObjectId } from 'mongoose';
import connectDB from '@/lib/mongodb';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { sanitizeString } from '@/lib/security';
import AiKnowledgeItem, {
  type AiKnowledgeCategory,
  type AiOpsChannel,
} from '@/modules/ai-ops/models/AiKnowledgeItem';

const CATEGORIES: AiKnowledgeCategory[] = [
  'pricing',
  'service',
  'setup',
  'troubleshooting',
  'payment',
  'policy',
  'faq',
  'announcement',
  'other',
];
const CHANNELS: AiOpsChannel[] = ['website', 'telegram', 'facebook', 'all'];

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((tag) => sanitizeString(String(tag)).toLowerCase().slice(0, 40)).filter(Boolean).slice(0, 20);
  }
  return String(value || '').split(',').map((tag) => sanitizeString(tag).toLowerCase().slice(0, 40)).filter(Boolean).slice(0, 20);
}

function normalizeChannels(value: unknown): AiOpsChannel[] {
  const raw = Array.isArray(value) ? value : [value || 'all'];
  const channels = raw.filter((item): item is AiOpsChannel => CHANNELS.includes(item as AiOpsChannel));
  return channels.length > 0 ? Array.from(new Set(channels)) : ['all'];
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const admin = await requireAdmin();
    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: 'Invalid knowledge item ID' }, { status: 400 });
    }

    await connectDB();
    const body = await request.json();
    const update: Record<string, unknown> = { updatedBy: admin.userId };

    if (typeof body.title === 'string') update.title = sanitizeString(body.title).slice(0, 200);
    if (typeof body.content === 'string') update.content = sanitizeString(body.content).slice(0, 16000);
    if (CATEGORIES.includes(body.category)) update.category = body.category;
    if ('tags' in body) update.tags = normalizeTags(body.tags);
    if ('channels' in body) update.channels = normalizeChannels(body.channels);
    if (typeof body.enabled === 'boolean') update.enabled = body.enabled;
    if (typeof body.priority === 'number') update.priority = Math.max(0, Math.min(body.priority, 100));

    const item = await AiKnowledgeItem.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    if (!item) {
      return NextResponse.json({ success: false, error: 'Knowledge item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { item } });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
    const { id } = await params;
    if (!isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: 'Invalid knowledge item ID' }, { status: 400 });
    }

    await connectDB();
    const item = await AiKnowledgeItem.findByIdAndDelete(id);
    if (!item) {
      return NextResponse.json({ success: false, error: 'Knowledge item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
