import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { logActivity } from '@/models/ActivityLog';
import SocialChannel from '@/models/SocialChannel';
import SocialPost, { type ISocialPostResult } from '@/models/SocialPost';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PublishablePost = {
  title: string;
  message: string;
  linkUrl: string;
  imageUrl: string;
  contentType: 'text' | 'link' | 'image';
};

function cleanText(value: unknown, maxLength = 500): string {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanSlug(value: unknown): string {
  return cleanText(value, 100).toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

function cleanUrl(value: unknown): string {
  const raw = cleanText(value, 1000);
  if (!raw) return '';

  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function createPostId() {
  const stamp = new Date().toISOString().replace(/[-:.tz]/gi, '').slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `social_${stamp}_${suffix}`;
}

function getContentType(linkUrl: string, imageUrl: string): 'text' | 'link' | 'image' {
  if (imageUrl) return 'image';
  if (linkUrl) return 'link';
  return 'text';
}

function buildShareText(post: PublishablePost, maxLength = 4096) {
  const parts = [post.message];
  if (post.linkUrl && post.contentType !== 'link') parts.push(post.linkUrl);
  return parts.filter(Boolean).join('\n\n').slice(0, maxLength);
}

async function readJsonResponse(response: Response, label: string) {
  const text = await response.text();
  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label}: non-JSON response`);
  }

  if (!response.ok || data?.error || data?.ok === false) {
    const message =
      data?.error?.message ||
      data?.description ||
      data?.message ||
      `HTTP ${response.status}`;
    throw new Error(`${label}: ${message}`);
  }

  return data;
}

function facebookGraphPath(path: string) {
  const version = cleanText(process.env.META_GRAPH_VERSION, 20);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return version
    ? `https://graph.facebook.com/${version}${normalizedPath}`
    : `https://graph.facebook.com${normalizedPath}`;
}

async function publishFacebook(channel: any, post: PublishablePost) {
  const pageId = cleanText(channel.facebook?.pageId, 120);
  const pageAccessToken = cleanText(channel.facebook?.pageAccessToken, 1000);
  if (!pageId || !pageAccessToken) {
    throw new Error('Facebook Page ID or access token is missing');
  }

  const body = new URLSearchParams();
  body.set('access_token', pageAccessToken);

  let endpoint = facebookGraphPath(`/${encodeURIComponent(pageId)}/feed`);
  if (post.imageUrl) {
    endpoint = facebookGraphPath(`/${encodeURIComponent(pageId)}/photos`);
    body.set('url', post.imageUrl);
    body.set('caption', buildShareText(post, 2000));
  } else {
    body.set('message', post.message);
    if (post.linkUrl) body.set('link', post.linkUrl);
  }

  const response = await fetch(endpoint, { method: 'POST', body });
  const data = await readJsonResponse(response, 'Facebook publish');
  const externalPostId = String(data.post_id || data.id || '');
  return {
    externalPostId,
    externalUrl: externalPostId ? `https://www.facebook.com/${externalPostId}` : channel.facebook?.pageUrl || '',
  };
}

function telegramPostUrl(channel: any, messageId: string) {
  const configuredUrl = cleanText(channel.telegram?.channelUrl, 300).replace(/\/$/, '');
  if (configuredUrl && messageId) return `${configuredUrl}/${messageId}`;

  const chatId = cleanText(channel.telegram?.chatId, 160);
  if (chatId.startsWith('@') && messageId) {
    return `https://t.me/${chatId.slice(1)}/${messageId}`;
  }

  return configuredUrl;
}

async function publishTelegram(channel: any, post: PublishablePost) {
  const botToken = cleanText(channel.telegram?.botToken, 1000);
  const chatId = cleanText(channel.telegram?.chatId, 160);
  if (!botToken || !chatId) {
    throw new Error('Telegram bot token or chat ID is missing');
  }

  const method = post.imageUrl ? 'sendPhoto' : 'sendMessage';
  const body: Record<string, string> = {
    chat_id: chatId,
  };

  if (post.imageUrl) {
    body.photo = post.imageUrl;
    body.caption = buildShareText(post, 1024);
  } else {
    body.text = buildShareText(post, 4096);
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await readJsonResponse(response, 'Telegram publish');
  const messageId = String(data.result?.message_id || '');
  return {
    externalPostId: messageId,
    externalUrl: telegramPostUrl(channel, messageId),
  };
}

async function publishToChannels(channels: any[], post: PublishablePost): Promise<ISocialPostResult[]> {
  const results: ISocialPostResult[] = [];

  for (const channel of channels) {
    try {
      const published = channel.platform === 'facebook'
        ? await publishFacebook(channel, post)
        : await publishTelegram(channel, post);

      results.push({
        channelId: channel.channelId,
        channelLabel: channel.label,
        platform: channel.platform,
        status: 'success',
        externalPostId: published.externalPostId,
        externalUrl: published.externalUrl,
        publishedAt: new Date(),
      });
    } catch (error) {
      results.push({
        channelId: channel.channelId,
        channelLabel: channel.label,
        platform: channel.platform,
        status: 'error',
        error: error instanceof Error ? error.message : 'Publish failed',
      });
    }
  }

  return results;
}

function statusFromResults(results: ISocialPostResult[]): 'published' | 'partial_failed' | 'failed' {
  const successCount = results.filter((result) => result.status === 'success').length;
  if (successCount === results.length && results.length > 0) return 'published';
  if (successCount > 0) return 'partial_failed';
  return 'failed';
}

function toClientPost(post: any) {
  return {
    _id: String(post._id || ''),
    postId: post.postId,
    title: post.title || '',
    message: post.message || '',
    linkUrl: post.linkUrl || '',
    imageUrl: post.imageUrl || '',
    contentType: post.contentType || 'text',
    targetChannelIds: post.targetChannelIds || [],
    status: post.status,
    results: post.results || [],
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

function postPayload(body: any, existing?: any) {
  const linkUrl = cleanUrl(body.linkUrl ?? existing?.linkUrl);
  const imageUrl = cleanUrl(body.imageUrl ?? existing?.imageUrl);
  const targetChannelIds = Array.isArray(body.targetChannelIds)
    ? body.targetChannelIds.map(cleanSlug).filter(Boolean)
    : existing?.targetChannelIds || [];

  return {
    title: cleanText(body.title ?? existing?.title, 160),
    message: cleanText(body.message ?? existing?.message, 6000),
    linkUrl,
    imageUrl,
    contentType: getContentType(linkUrl, imageUrl),
    targetChannelIds,
  };
}

function validatePost(payload: ReturnType<typeof postPayload>, publishing = false) {
  if (!payload.message && !payload.linkUrl && !payload.imageUrl) return 'Message, link, or image is required';
  if (publishing && payload.targetChannelIds.length === 0) return 'Choose at least one social channel';
  return '';
}

export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
    await connectDB();

    const limit = Math.max(1, Math.min(100, Number(request.nextUrl.searchParams.get('limit') || 50)));
    const posts = await SocialPost.find().sort({ updatedAt: -1 }).limit(limit).lean();
    const counts = await SocialPost.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);

    return NextResponse.json({
      success: true,
      data: {
        posts: posts.map(toClientPost),
        counts: Object.fromEntries(counts.map((item) => [item._id, item.count])),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load social posts' },
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
    const action = cleanText(body.action, 20) === 'publish' ? 'publish' : 'draft';
    const payload = postPayload(body);
    const validationError = validatePost(payload, action === 'publish');
    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 400 });
    }

    const post = await SocialPost.create({
      postId: cleanSlug(body.postId) || createPostId(),
      ...payload,
      status: action === 'publish' ? 'publishing' : 'draft',
      createdBy: mongoose.Types.ObjectId.isValid(admin.userId) ? new mongoose.Types.ObjectId(admin.userId) : undefined,
      results: [],
    });

    if (action === 'publish') {
      const channels = await SocialChannel.find({
        channelId: { $in: payload.targetChannelIds },
        enabled: true,
      }).lean();

      if (channels.length === 0) {
        post.status = 'failed';
        post.results = payload.targetChannelIds.map((channelId: string) => ({
          channelId,
          channelLabel: channelId,
          platform: 'telegram' as const,
          status: 'error' as const,
          error: 'No enabled matching social channel was found',
        }));
      } else {
        const results = await publishToChannels(channels, payload);
        post.results = results;
        post.status = statusFromResults(results);
      }
      await post.save();
    }

    await logActivity({
      admin: admin.userId,
      action: 'settings_updated',
      target: `Social Post: ${post.title || post.postId}`,
      details: action === 'publish' ? `Published social post with status ${post.status}` : 'Saved social post draft',
    });

    return NextResponse.json({ success: true, data: { post: toClientPost(post) } }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save social post' },
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
    const postId = cleanSlug(body.postId);
    if (!postId) {
      return NextResponse.json({ success: false, error: 'Post ID is required' }, { status: 400 });
    }

    const post = await SocialPost.findOne({ postId });
    if (!post) {
      return NextResponse.json({ success: false, error: 'Social post not found' }, { status: 404 });
    }

    const action = cleanText(body.action, 20);
    const payload = postPayload(body, post);
    const validationError = validatePost(payload, action === 'publish');
    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 400 });
    }

    post.set(payload);

    if (action === 'publish') {
      post.status = 'publishing';
      const channels = await SocialChannel.find({
        channelId: { $in: payload.targetChannelIds },
        enabled: true,
      }).lean();
      const results = channels.length > 0
        ? await publishToChannels(channels, payload)
        : payload.targetChannelIds.map((channelId: string) => ({
            channelId,
            channelLabel: channelId,
            platform: 'telegram' as const,
            status: 'error' as const,
            error: 'No enabled matching social channel was found',
          }));
      post.results = results;
      post.status = statusFromResults(results);
    } else {
      post.status = 'draft';
    }

    await post.save();

    await logActivity({
      admin: admin.userId,
      action: 'settings_updated',
      target: `Social Post: ${post.title || post.postId}`,
      details: action === 'publish' ? `Published social post with status ${post.status}` : 'Updated social post draft',
    });

    return NextResponse.json({ success: true, data: { post: toClientPost(post) } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update social post' },
      { status: error.message === 'Admin access required' ? 403 : 500 }
    );
  }
}
