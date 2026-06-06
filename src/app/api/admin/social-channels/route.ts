import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { logActivity } from '@/models/ActivityLog';
import SocialChannel from '@/models/SocialChannel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLATFORMS = ['facebook', 'telegram'];

function cleanText(value: unknown, maxLength = 500): string {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanSecret(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^Authorization:\s*Bearer\s+/i, '')
    .trim();
}

function cleanSlug(value: unknown): string {
  return cleanText(value, 80).toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

function cleanUrl(value: unknown): string {
  const raw = cleanText(value, 500);
  if (!raw) return '';

  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function pickPlatform(value: unknown) {
  const platform = cleanText(value, 20).toLowerCase();
  return PLATFORMS.includes(platform) ? platform : 'facebook';
}

function toClientChannel(channel: any) {
  return {
    _id: String(channel._id || ''),
    channelId: channel.channelId,
    label: channel.label,
    platform: channel.platform,
    enabled: channel.enabled !== false,
    facebook: {
      pageId: channel.facebook?.pageId || '',
      pageUrl: channel.facebook?.pageUrl || '',
      hasPageAccessToken: !!channel.facebook?.pageAccessToken,
    },
    telegram: {
      chatId: channel.telegram?.chatId || '',
      channelUrl: channel.telegram?.channelUrl || '',
      hasBotToken: !!channel.telegram?.botToken,
    },
    notes: channel.notes || '',
    updatedAt: channel.updatedAt,
  };
}

function channelPayload(body: any, existing?: any) {
  const platform = pickPlatform(body.platform ?? existing?.platform);
  const facebook = body.facebook || {};
  const telegram = body.telegram || {};
  const channelId = cleanSlug(body.channelId ?? existing?.channelId);
  const label = cleanText(body.label ?? existing?.label, 120);

  const payload: any = {
    channelId,
    label,
    platform,
    enabled: body.enabled === undefined ? existing?.enabled !== false : body.enabled !== false,
    notes: cleanText(body.notes ?? existing?.notes, 600),
    facebook: {
      pageId: cleanText(facebook.pageId ?? existing?.facebook?.pageId, 120),
      pageAccessToken: existing?.facebook?.pageAccessToken || '',
      pageUrl: cleanUrl(facebook.pageUrl ?? existing?.facebook?.pageUrl),
    },
    telegram: {
      botToken: existing?.telegram?.botToken || '',
      chatId: cleanText(telegram.chatId ?? existing?.telegram?.chatId, 160),
      channelUrl: cleanUrl(telegram.channelUrl ?? existing?.telegram?.channelUrl),
    },
  };

  const pageAccessToken = cleanSecret(facebook.pageAccessToken);
  if (pageAccessToken) payload.facebook.pageAccessToken = pageAccessToken;

  const botToken = cleanSecret(telegram.botToken);
  if (botToken) payload.telegram.botToken = botToken;

  return payload;
}

function validateChannel(payload: any) {
  if (!payload.channelId) return 'Channel ID is required';
  if (!payload.label) return 'Label is required';
  if (payload.platform === 'facebook') {
    if (!payload.facebook.pageId) return 'Facebook Page ID is required';
    if (!payload.facebook.pageAccessToken) return 'Facebook Page access token is required';
  }
  if (payload.platform === 'telegram') {
    if (!payload.telegram.botToken) return 'Telegram bot token is required';
    if (!payload.telegram.chatId) return 'Telegram chat ID or channel username is required';
  }
  return '';
}

export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
    await connectDB();

    const channels = await SocialChannel.find().sort({ platform: 1, label: 1 }).lean();
    return NextResponse.json({
      success: true,
      data: {
        channels: channels.map(toClientChannel),
        total: channels.length,
        enabled: channels.filter((channel) => channel.enabled !== false).length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load social channels' },
      { status: error.message === 'Admin access required' ? 403 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const admin = await requireAdmin();
    await connectDB();

    const body = await request.json();
    const payload = channelPayload(body);
    const validationError = validateChannel(payload);
    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 400 });
    }

    const existing = await SocialChannel.findOne({ channelId: payload.channelId }).lean();
    if (existing) {
      return NextResponse.json({ success: false, error: 'Channel ID already exists' }, { status: 409 });
    }

    const channel = await SocialChannel.create(payload);
    await logActivity({
      admin: admin.userId,
      action: 'settings_updated',
      target: `Social Channel: ${channel.label}`,
      details: `Created ${channel.platform} channel config`,
    });

    return NextResponse.json({ success: true, data: { channel: toClientChannel(channel) } }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create social channel' },
      { status: error.message === 'Admin access required' ? 403 : 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const admin = await requireAdmin();
    await connectDB();

    const body = await request.json();
    const channelId = cleanSlug(body.channelId);
    if (!channelId) {
      return NextResponse.json({ success: false, error: 'Channel ID is required' }, { status: 400 });
    }

    const channel = await SocialChannel.findOne({ channelId });
    if (!channel) {
      return NextResponse.json({ success: false, error: 'Social channel not found' }, { status: 404 });
    }

    const payload = channelPayload(body, channel);
    const newChannelId = cleanSlug(body.newChannelId || payload.channelId);
    if (newChannelId && newChannelId !== channelId) {
      const conflict = await SocialChannel.findOne({ channelId: newChannelId }).lean();
      if (conflict) {
        return NextResponse.json({ success: false, error: 'New channel ID already exists' }, { status: 409 });
      }
      payload.channelId = newChannelId;
    }

    const validationError = validateChannel(payload);
    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 400 });
    }

    channel.set(payload);
    await channel.save();

    await logActivity({
      admin: admin.userId,
      action: 'settings_updated',
      target: `Social Channel: ${channel.label}`,
      details: `Updated ${channel.platform} channel config`,
    });

    return NextResponse.json({ success: true, data: { channel: toClientChannel(channel) } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update social channel' },
      { status: error.message === 'Admin access required' ? 403 : 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const admin = await requireAdmin();
    await connectDB();

    const channelId = cleanSlug(request.nextUrl.searchParams.get('channelId'));
    if (!channelId) {
      return NextResponse.json({ success: false, error: 'Channel ID is required' }, { status: 400 });
    }

    const channel = await SocialChannel.findOneAndDelete({ channelId });
    if (!channel) {
      return NextResponse.json({ success: false, error: 'Social channel not found' }, { status: 404 });
    }

    await logActivity({
      admin: admin.userId,
      action: 'settings_updated',
      target: `Social Channel: ${channel.label}`,
      details: 'Deleted social channel config only. No remote posts were deleted.',
    });

    return NextResponse.json({ success: true, message: 'Social channel deleted' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete social channel' },
      { status: error.message === 'Admin access required' ? 403 : 500 }
    );
  }
}
