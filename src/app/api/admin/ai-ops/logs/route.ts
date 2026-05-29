import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import AiBotLog from '@/modules/ai-ops/models/AiBotLog';
import type { AiOpsChannel } from '@/modules/ai-ops/models/AiKnowledgeItem';

const CHANNELS: AiOpsChannel[] = ['website', 'telegram', 'facebook', 'all'];
const DIRECTIONS = ['inbound', 'outbound', 'action', 'error'];
const SOURCES = ['ai', 'faq', 'fixed', 'knowledge', 'command', 'error', 'system'];

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
    const channel = searchParams.get('channel') as AiOpsChannel | null;
    const direction = searchParams.get('direction');
    const source = searchParams.get('source');
    const status = searchParams.get('status');

    const query: Record<string, unknown> = {};
    if (channel && CHANNELS.includes(channel)) query.channel = channel;
    if (direction && DIRECTIONS.includes(direction)) query.direction = direction;
    if (source && SOURCES.includes(source)) query.source = source;
    if (status === 'success' || status === 'failed' || status === 'skipped') query.status = status;

    const [logs, total, sourceStats, channelStats] = await Promise.all([
      AiBotLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AiBotLog.countDocuments(query),
      AiBotLog.aggregate([
        { $match: query },
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      AiBotLog.aggregate([
        { $match: query },
        { $group: { _id: '$channel', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        logs,
        sourceStats,
        channelStats,
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
