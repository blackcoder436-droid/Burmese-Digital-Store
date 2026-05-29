import { NextRequest, NextResponse } from 'next/server';
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
    return value
      .map((tag) => sanitizeString(String(tag)).toLowerCase().slice(0, 40))
      .filter(Boolean)
      .slice(0, 20);
  }
  return String(value || '')
    .split(',')
    .map((tag) => sanitizeString(tag).toLowerCase().slice(0, 40))
    .filter(Boolean)
    .slice(0, 20);
}

function normalizeChannels(value: unknown): AiOpsChannel[] {
  const raw = Array.isArray(value) ? value : [value || 'all'];
  const channels = raw.filter((item): item is AiOpsChannel => CHANNELS.includes(item as AiOpsChannel));
  return channels.length > 0 ? Array.from(new Set(channels)) : ['all'];
}

export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '30', 10)), 100);
    const skip = (page - 1) * limit;
    const search = sanitizeString(searchParams.get('search') || '');
    const category = searchParams.get('category') as AiKnowledgeCategory | null;
    const channel = searchParams.get('channel') as AiOpsChannel | null;
    const enabled = searchParams.get('enabled');

    const query: Record<string, unknown> = {};
    if (category && CATEGORIES.includes(category)) query.category = category;
    if (channel && CHANNELS.includes(channel)) query.channels = channel;
    if (enabled === 'true') query.enabled = true;
    if (enabled === 'false') query.enabled = false;
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ title: regex }, { content: regex }, { tags: regex }];
    }

    const [items, total] = await Promise.all([
      AiKnowledgeItem.find(query)
        .sort({ priority: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AiKnowledgeItem.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const admin = await requireAdmin();
    await connectDB();

    const body = await request.json();
    const title = sanitizeString(body.title || '').slice(0, 200);
    const content = sanitizeString(body.content || '').slice(0, 16000);
    const category = CATEGORIES.includes(body.category) ? body.category : 'faq';

    if (!title || !content) {
      return NextResponse.json(
        { success: false, error: 'Title and content are required' },
        { status: 400 }
      );
    }

    const item = await AiKnowledgeItem.create({
      title,
      content,
      category,
      tags: normalizeTags(body.tags),
      channels: normalizeChannels(body.channels),
      enabled: body.enabled !== false,
      priority: Math.max(0, Math.min(Number(body.priority) || 0, 100)),
      createdBy: admin.userId,
      updatedBy: admin.userId,
    });

    return NextResponse.json({ success: true, data: { item } }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Admin access required' || error.message === 'Authentication required') {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
