import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { sanitizeString } from '@/lib/security';
import AiCommandItem, {
  type AiCommandItemType,
} from '@/modules/ai-ops/models/AiCommandItem';
import type { AiOpsChannel } from '@/modules/ai-ops/models/AiKnowledgeItem';

const TYPES: AiCommandItemType[] = ['notice', 'rule', 'promotion', 'maintenance', 'escalation'];
const CHANNELS: AiOpsChannel[] = ['website', 'telegram', 'facebook', 'all'];

function normalizeChannels(value: unknown): AiOpsChannel[] {
  const raw = Array.isArray(value) ? value : [value || 'all'];
  const channels = raw.filter((item): item is AiOpsChannel => CHANNELS.includes(item as AiOpsChannel));
  return channels.length > 0 ? Array.from(new Set(channels)) : ['all'];
}

function normalizeDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
    await connectDB();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as AiCommandItemType | null;
    const channel = searchParams.get('channel') as AiOpsChannel | null;
    const enabled = searchParams.get('enabled');

    const query: Record<string, unknown> = {};
    if (type && TYPES.includes(type)) query.type = type;
    if (channel && CHANNELS.includes(channel)) query.channels = channel;
    if (enabled === 'true') query.enabled = true;
    if (enabled === 'false') query.enabled = false;

    const items = await AiCommandItem.find(query)
      .sort({ priority: -1, updatedAt: -1 })
      .limit(100)
      .lean();

    return NextResponse.json({ success: true, data: { items } });
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
    const content = sanitizeString(body.content || '').slice(0, 8000);
    const type = TYPES.includes(body.type) ? body.type : 'notice';

    if (!title || !content) {
      return NextResponse.json(
        { success: false, error: 'Title and content are required' },
        { status: 400 }
      );
    }

    const item = await AiCommandItem.create({
      title,
      content,
      type,
      channels: normalizeChannels(body.channels),
      enabled: body.enabled !== false,
      priority: Math.max(0, Math.min(Number(body.priority) || 0, 100)),
      startsAt: normalizeDate(body.startsAt),
      endsAt: normalizeDate(body.endsAt),
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
