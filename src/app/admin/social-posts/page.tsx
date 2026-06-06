'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Facebook,
  FileText,
  Image as ImageIcon,
  Loader2,
  Megaphone,
  MessageSquare,
  Plus,
  RefreshCw,
  Save,
  Send,
  Settings,
  Trash2,
} from 'lucide-react';

type SocialPlatform = 'facebook' | 'telegram';
type SocialPostStatus = 'draft' | 'publishing' | 'published' | 'partial_failed' | 'failed';

type SocialChannel = {
  _id: string;
  channelId: string;
  label: string;
  platform: SocialPlatform;
  enabled: boolean;
  facebook: {
    pageId: string;
    pageUrl: string;
    hasPageAccessToken: boolean;
  };
  telegram: {
    chatId: string;
    channelUrl: string;
    hasBotToken: boolean;
  };
  notes?: string;
  updatedAt?: string;
};

type SocialPost = {
  _id: string;
  postId: string;
  title: string;
  message: string;
  linkUrl: string;
  imageUrl: string;
  contentType: 'text' | 'link' | 'image';
  targetChannelIds: string[];
  status: SocialPostStatus;
  results: Array<{
    channelId: string;
    channelLabel: string;
    platform: SocialPlatform;
    status: 'success' | 'error';
    externalPostId?: string;
    externalUrl?: string;
    error?: string;
    publishedAt?: string;
  }>;
  updatedAt?: string;
};

type ChannelDraft = {
  channelId: string;
  label: string;
  platform: SocialPlatform;
  enabled: boolean;
  facebookPageId: string;
  facebookPageAccessToken: string;
  facebookPageUrl: string;
  telegramBotToken: string;
  telegramChatId: string;
  telegramChannelUrl: string;
  notes: string;
};

type PostForm = {
  postId: string;
  title: string;
  message: string;
  linkUrl: string;
  imageUrl: string;
  targetChannelIds: string[];
};

const EMPTY_CHANNEL_DRAFT: ChannelDraft = {
  channelId: '',
  label: '',
  platform: 'facebook',
  enabled: true,
  facebookPageId: '',
  facebookPageAccessToken: '',
  facebookPageUrl: '',
  telegramBotToken: '',
  telegramChatId: '',
  telegramChannelUrl: '',
  notes: '',
};

const EMPTY_POST_FORM: PostForm = {
  postId: '',
  title: '',
  message: '',
  linkUrl: '',
  imageUrl: '',
  targetChannelIds: [],
};

const CONTENT_TEMPLATES = [
  {
    id: 'vpn_service',
    label: 'VPN service',
    title: 'Private VPN Service',
    message:
      'Burmese Digital Store မှ private VPN server service ရပါပြီ။ Family နဲ့ company တွေအတွက် domain, 3xUI panel, subscription link setup အပြီးအစီး ပြင်ဆင်ပေးပါတယ်။\n\nစုံစမ်းရန် inbox / Telegram မှတစ်ဆင့် ဆက်သွယ်နိုင်ပါတယ်။',
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    title: 'Service Maintenance Notice',
    message:
      'Burmese Digital Store service maintenance ပြုလုပ်နေပါတယ်။ သတ်မှတ်ထားတဲ့အချိန်အတွင်း connection ပြတ်တောက်မှု အနည်းငယ်ရှိနိုင်ပါတယ်။\n\nပြီးဆုံးသွားပါက update ထပ်တင်ပေးပါမယ်။',
  },
  {
    id: 'promotion',
    label: 'Promotion',
    title: 'Digital Service Promotion',
    message:
      'Burmese Digital Store မှ digital products နဲ့ VPN services တွေအတွက် promotion ရှိပါတယ်။ လိုအပ်တဲ့ service ကိုရွေးပြီး admin team နဲ့ ဆက်သွယ်နိုင်ပါတယ်။',
  },
  {
    id: 'new_server',
    label: 'New server',
    title: 'New VPN Server Available',
    message:
      'New private VPN server location အသစ် ထပ်တိုးထားပါတယ်။ Stable connection, private domain, 3xUI panel setup နဲ့အသုံးပြုနိုင်ပါတယ်။',
  },
];

const STATUS_STYLES: Record<SocialPostStatus, string> = {
  draft: 'border-slate-500/30 bg-slate-500/10 text-slate-200',
  publishing: 'border-sky-400/30 bg-sky-400/10 text-sky-200',
  published: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  partial_failed: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  failed: 'border-red-400/30 bg-red-400/10 text-red-200',
};

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function platformIcon(platform: SocialPlatform) {
  return platform === 'facebook' ? Facebook : Send;
}

function formatDate(value?: string) {
  if (!value) return 'unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

async function readApiJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  return JSON.parse(text);
}

export default function SocialPostsPage() {
  const [channels, setChannels] = useState<SocialChannel[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [postForm, setPostForm] = useState<PostForm>(EMPTY_POST_FORM);
  const [channelDraft, setChannelDraft] = useState<ChannelDraft>(EMPTY_CHANNEL_DRAFT);
  const [editingChannelId, setEditingChannelId] = useState('');
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingPost, setSavingPost] = useState(false);
  const [savingChannel, setSavingChannel] = useState(false);

  const enabledChannels = useMemo(() => channels.filter((channel) => channel.enabled), [channels]);
  const publishedCount = counts.published || posts.filter((post) => post.status === 'published').length;
  const draftCount = counts.draft || posts.filter((post) => post.status === 'draft').length;
  const errorCount = posts.filter((post) => post.status === 'failed' || post.status === 'partial_failed').length;

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [channelsResponse, postsResponse] = await Promise.all([
        fetch('/api/admin/social-channels', { cache: 'no-store' }),
        fetch('/api/admin/social-posts?limit=50', { cache: 'no-store' }),
      ]);
      const channelsData = await readApiJson(channelsResponse);
      const postsData = await readApiJson(postsResponse);

      if (channelsData?.success) {
        const loadedChannels = channelsData.data.channels || [];
        setChannels(loadedChannels);
        setPostForm((current) => ({
          ...current,
          targetChannelIds: current.targetChannelIds.length > 0
            ? current.targetChannelIds
            : loadedChannels.filter((channel: SocialChannel) => channel.enabled).map((channel: SocialChannel) => channel.channelId),
        }));
      } else {
        toast.error(channelsData?.error || 'Failed to load social channels');
      }

      if (postsData?.success) {
        setPosts(postsData.data.posts || []);
        setCounts(postsData.data.counts || {});
      } else {
        toast.error(postsData?.error || 'Failed to load social posts');
      }
    } catch {
      toast.error('Failed to load social marketing data');
    } finally {
      setLoading(false);
    }
  }

  function resetChannelDraft() {
    setEditingChannelId('');
    setChannelDraft(EMPTY_CHANNEL_DRAFT);
    setShowChannelForm(false);
  }

  function openPresetChannel(platform: SocialPlatform) {
    setEditingChannelId('');
    setShowChannelForm(true);
    setChannelDraft({
      ...EMPTY_CHANNEL_DRAFT,
      platform,
      channelId: platform === 'facebook' ? 'burmese_digital_store_facebook' : 'burmese_digital_store_telegram',
      label: platform === 'facebook' ? 'Burmese Digital Store Facebook' : 'Burmese Digital Store Telegram',
      telegramChatId: platform === 'telegram' ? '@burmesedigitalstore' : '',
      telegramChannelUrl: platform === 'telegram' ? 'https://t.me/burmesedigitalstore' : '',
    });
  }

  function editChannel(channel: SocialChannel) {
    setEditingChannelId(channel.channelId);
    setShowChannelForm(true);
    setChannelDraft({
      channelId: channel.channelId,
      label: channel.label,
      platform: channel.platform,
      enabled: channel.enabled,
      facebookPageId: channel.facebook.pageId || '',
      facebookPageAccessToken: '',
      facebookPageUrl: channel.facebook.pageUrl || '',
      telegramBotToken: '',
      telegramChatId: channel.telegram.chatId || '',
      telegramChannelUrl: channel.telegram.channelUrl || '',
      notes: channel.notes || '',
    });
  }

  function updateChannelDraft(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const target = event.target;
    const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;
    setChannelDraft((current) => ({
      ...current,
      [target.name]: value,
      channelId: target.name === 'label' && !editingChannelId ? slugify(String(value)) : current.channelId,
    }));
  }

  async function saveChannel() {
    const channelId = slugify(channelDraft.channelId || channelDraft.label);
    if (!channelId || !channelDraft.label.trim()) {
      toast.error('Channel ID and label are required');
      return;
    }

    setSavingChannel(true);
    try {
      const payload: any = {
        channelId: editingChannelId || channelId,
        label: channelDraft.label,
        platform: channelDraft.platform,
        enabled: channelDraft.enabled,
        notes: channelDraft.notes,
        facebook: {
          pageId: channelDraft.facebookPageId,
          pageAccessToken: channelDraft.facebookPageAccessToken,
          pageUrl: channelDraft.facebookPageUrl,
        },
        telegram: {
          botToken: channelDraft.telegramBotToken,
          chatId: channelDraft.telegramChatId,
          channelUrl: channelDraft.telegramChannelUrl,
        },
      };
      if (editingChannelId && channelId !== editingChannelId) payload.newChannelId = channelId;

      const response = await fetch('/api/admin/social-channels', {
        method: editingChannelId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await readApiJson(response);
      if (data?.success) {
        toast.success(editingChannelId ? 'Channel updated' : 'Channel added');
        resetChannelDraft();
        await loadData();
      } else {
        toast.error(data?.error || 'Failed to save channel');
      }
    } catch {
      toast.error('Failed to save channel');
    } finally {
      setSavingChannel(false);
    }
  }

  async function deleteChannel(channelId: string) {
    if (!window.confirm(`Delete social channel "${channelId}"? Remote posts will not be deleted.`)) return;

    setSavingChannel(true);
    try {
      const response = await fetch(`/api/admin/social-channels?channelId=${encodeURIComponent(channelId)}`, {
        method: 'DELETE',
      });
      const data = await readApiJson(response);
      if (data?.success) {
        toast.success('Channel deleted');
        await loadData();
      } else {
        toast.error(data?.error || 'Failed to delete channel');
      }
    } catch {
      toast.error('Failed to delete channel');
    } finally {
      setSavingChannel(false);
    }
  }

  function updatePostForm(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const target = event.target;
    setPostForm((current) => ({ ...current, [target.name]: target.value }));
  }

  function toggleTarget(channelId: string, checked: boolean) {
    setPostForm((current) => {
      const next = new Set(current.targetChannelIds);
      if (checked) next.add(channelId);
      else next.delete(channelId);
      return { ...current, targetChannelIds: Array.from(next) };
    });
  }

  function applyTemplate(template: typeof CONTENT_TEMPLATES[number]) {
    setPostForm((current) => ({
      ...current,
      title: template.title,
      message: template.message,
    }));
  }

  function loadPostIntoComposer(post: SocialPost) {
    setPostForm({
      postId: post.status === 'draft' ? post.postId : '',
      title: post.title,
      message: post.message,
      linkUrl: post.linkUrl,
      imageUrl: post.imageUrl,
      targetChannelIds: post.targetChannelIds || [],
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submitPost(action: 'draft' | 'publish', form: PostForm) {
    if (!form.message.trim() && !form.linkUrl.trim() && !form.imageUrl.trim()) {
      toast.error('Message, link, or image is required');
      return;
    }
    if (action === 'publish' && form.targetChannelIds.length === 0) {
      toast.error('Choose at least one social channel');
      return;
    }

    setSavingPost(true);
    try {
      const method = form.postId ? 'PATCH' : 'POST';
      const response = await fetch('/api/admin/social-posts', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, action }),
      });
      const data = await readApiJson(response);
      if (data?.success) {
        toast.success(action === 'publish' ? `Post ${data.data.post.status}` : 'Draft saved');
        setPostForm(EMPTY_POST_FORM);
        await loadData();
      } else {
        toast.error(data?.error || 'Failed to save post');
      }
    } catch {
      toast.error('Failed to save post');
    } finally {
      setSavingPost(false);
    }
  }

  async function savePost(action: 'draft' | 'publish') {
    await submitPost(action, postForm);
  }

  async function publishHistoryPost(post: SocialPost) {
    const form = {
      postId: post.postId,
      title: post.title,
      message: post.message,
      linkUrl: post.linkUrl,
      imageUrl: post.imageUrl,
      targetChannelIds: post.targetChannelIds || [],
    };
    setPostForm(form);
    await submitPost('publish', form);
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-sky-300" />
        Loading social posts...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-300/80">Marketing</p>
          <h1 className="mt-2 text-2xl font-bold text-white">Social Posts</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Compose Burmese Digital Store content and publish it to Facebook Page and Telegram channel from one clean workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => openPresetChannel('facebook')}
            className="inline-flex items-center gap-2 rounded-lg border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-400/20"
          >
            <Plus className="h-4 w-4" />
            Facebook
          </button>
          <button
            type="button"
            onClick={() => openPresetChannel('telegram')}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/20"
          >
            <Plus className="h-4 w-4" />
            Telegram
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard icon={MessageSquare} label="Channels" value={channels.length} />
        <SummaryCard icon={CheckCircle2} label="Enabled" value={enabledChannels.length} tone="emerald" />
        <SummaryCard icon={FileText} label="Drafts" value={draftCount} tone="sky" />
        <SummaryCard icon={Send} label="Published" value={publishedCount} tone="emerald" />
        <SummaryCard icon={AlertTriangle} label="Needs check" value={errorCount} tone="amber" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="space-y-5">
          <Section title="Content composer" icon={Megaphone}>
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Title" name="title" value={postForm.title} onChange={updatePostForm} placeholder="Internal title" />
              <Field label="Link URL" name="linkUrl" value={postForm.linkUrl} onChange={updatePostForm} placeholder="https://burmesedigital.store/..." />
            </div>
            <div className="mt-4">
              <label className="block">
                <span className="text-sm text-slate-300">Post message</span>
                <textarea
                  name="message"
                  value={postForm.message}
                  onChange={updatePostForm}
                  rows={8}
                  placeholder="Write the Facebook / Telegram post..."
                  className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
                />
              </label>
            </div>
            <div className="mt-4">
              <Field label="Image URL" name="imageUrl" value={postForm.imageUrl} onChange={updatePostForm} placeholder="Optional image URL for photo post" />
            </div>

            <div className="mt-4">
              <p className="text-sm text-slate-300">Templates</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {CONTENT_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                  >
                    {template.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="text-sm text-slate-300">Targets</p>
              {enabledChannels.length === 0 ? (
                <div className="mt-2 rounded-lg border border-dashed border-white/10 bg-slate-950/40 px-4 py-5 text-sm text-slate-500">
                  Add and enable a Facebook Page or Telegram channel first.
                </div>
              ) : (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {enabledChannels.map((channel) => {
                    const Icon = platformIcon(channel.platform);
                    const checked = postForm.targetChannelIds.includes(channel.channelId);
                    return (
                      <label
                        key={channel.channelId}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-sm transition ${
                          checked
                            ? 'border-sky-400/60 bg-sky-400/10 text-white'
                            : 'border-white/10 bg-slate-950/45 text-slate-300 hover:border-white/20'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => toggleTarget(channel.channelId, event.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-slate-500 bg-slate-900 text-sky-500 focus:ring-sky-500"
                        />
                        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{channel.label}</span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">{channel.channelId}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => void savePost('draft')}
                disabled={savingPost}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingPost ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save draft
              </button>
              <button
                type="button"
                onClick={() => void savePost('publish')}
                disabled={savingPost || enabledChannels.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingPost ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Publish now
              </button>
            </div>
          </Section>

          <Section title="Post history" icon={FileText}>
            {posts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 bg-slate-950/40 px-4 py-8 text-center text-sm text-slate-500">
                No social posts yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[860px] w-full text-left text-sm">
                  <thead className="border-b border-white/10 text-xs uppercase tracking-[0.16em] text-slate-500">
                    <tr>
                      <th className="py-3 pr-4 font-semibold">Post</th>
                      <th className="py-3 pr-4 font-semibold">Type</th>
                      <th className="py-3 pr-4 font-semibold">Targets</th>
                      <th className="py-3 pr-4 font-semibold">Status</th>
                      <th className="py-3 pr-4 font-semibold">Updated</th>
                      <th className="py-3 pr-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.map((post) => (
                      <tr key={post.postId} className="border-b border-white/5 text-slate-300 last:border-0">
                        <td className="max-w-[300px] py-3 pr-4">
                          <p className="truncate font-semibold text-white">{post.title || post.postId}</p>
                          <p className="mt-1 truncate text-xs text-slate-500">{post.message || post.linkUrl || post.imageUrl}</p>
                          {post.results?.some((result) => result.error) ? (
                            <p className="mt-1 truncate text-xs text-red-300">{post.results.find((result) => result.error)?.error}</p>
                          ) : null}
                        </td>
                        <td className="py-3 pr-4 text-xs uppercase text-slate-400">{post.contentType}</td>
                        <td className="py-3 pr-4 text-xs text-slate-400">{post.targetChannelIds.length}</td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex rounded-lg border px-2 py-1 text-xs font-semibold ${STATUS_STYLES[post.status]}`}>
                            {post.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-xs text-slate-500">{formatDate(post.updatedAt)}</td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => loadPostIntoComposer(post)}
                              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              Load
                            </button>
                            <button
                              type="button"
                              onClick={() => void publishHistoryPost(post)}
                              disabled={savingPost || post.targetChannelIds.length === 0}
                              className="inline-flex items-center gap-1 rounded-lg border border-sky-400/20 bg-sky-400/10 px-2.5 py-1.5 text-xs font-semibold text-sky-100 transition hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Send className="h-3.5 w-3.5" />
                              Publish
                            </button>
                            {post.results?.find((result) => result.externalUrl)?.externalUrl ? (
                              <a
                                href={post.results.find((result) => result.externalUrl)?.externalUrl}
                                target="_blank"
                                className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Open
                              </a>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>

        <aside className="space-y-5">
          <Section
            title="Channels"
            icon={Settings}
            action={
              showChannelForm ? (
                <button
                  type="button"
                  onClick={resetChannelDraft}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  Close
                </button>
              ) : null
            }
          >
            {showChannelForm ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Label" name="label" value={channelDraft.label} onChange={updateChannelDraft} />
                  <Field label="Channel ID" name="channelId" value={channelDraft.channelId} onChange={updateChannelDraft} />
                  <Select
                    label="Platform"
                    name="platform"
                    value={channelDraft.platform}
                    onChange={updateChannelDraft}
                    options={[
                      { value: 'facebook', label: 'Facebook Page' },
                      { value: 'telegram', label: 'Telegram Channel' },
                    ]}
                  />
                  <Toggle label="Enabled" checked={channelDraft.enabled} onChange={(checked) => setChannelDraft((current) => ({ ...current, enabled: checked }))} />
                </div>

                {channelDraft.platform === 'facebook' ? (
                  <div className="grid gap-4">
                    <Field label="Page ID" name="facebookPageId" value={channelDraft.facebookPageId} onChange={updateChannelDraft} />
                    <Field
                      label="Page access token"
                      name="facebookPageAccessToken"
                      value={channelDraft.facebookPageAccessToken}
                      onChange={updateChannelDraft}
                      type="password"
                      placeholder={editingChannelId ? 'Leave blank to keep existing token' : ''}
                    />
                    <Field label="Page URL" name="facebookPageUrl" value={channelDraft.facebookPageUrl} onChange={updateChannelDraft} />
                  </div>
                ) : (
                  <div className="grid gap-4">
                    <Field
                      label="Bot token"
                      name="telegramBotToken"
                      value={channelDraft.telegramBotToken}
                      onChange={updateChannelDraft}
                      type="password"
                      placeholder={editingChannelId ? 'Leave blank to keep existing token' : ''}
                    />
                    <Field label="Chat ID / @channel" name="telegramChatId" value={channelDraft.telegramChatId} onChange={updateChannelDraft} />
                    <Field label="Channel URL" name="telegramChannelUrl" value={channelDraft.telegramChannelUrl} onChange={updateChannelDraft} />
                  </div>
                )}

                <label className="block">
                  <span className="text-sm text-slate-300">Notes</span>
                  <textarea
                    name="notes"
                    value={channelDraft.notes}
                    onChange={updateChannelDraft}
                    rows={3}
                    className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void saveChannel()}
                  disabled={savingChannel}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingChannel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {editingChannelId ? 'Update channel' : 'Add channel'}
                </button>
              </div>
            ) : null}

            <div className={showChannelForm ? 'mt-5 border-t border-white/10 pt-4' : ''}>
              {channels.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 bg-slate-950/40 px-4 py-8 text-center text-sm text-slate-500">
                  Add Facebook and Telegram channels before publishing.
                </div>
              ) : (
                <div className="space-y-2">
                  {channels.map((channel) => {
                    const Icon = platformIcon(channel.platform);
                    const tokenReady = channel.platform === 'facebook'
                      ? channel.facebook.hasPageAccessToken
                      : channel.telegram.hasBotToken;
                    return (
                      <div key={channel.channelId} className="rounded-lg border border-white/10 bg-slate-950/40 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300">
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate font-semibold text-white">{channel.label}</p>
                                {channel.enabled ? null : (
                                  <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">Disabled</span>
                                )}
                              </div>
                              <p className="mt-1 truncate text-xs text-slate-500">{channel.channelId}</p>
                              <p className="mt-1 text-xs text-slate-500">{tokenReady ? 'Token saved' : 'Token missing'}</p>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => editChannel(channel)}
                            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteChannel(channel.channelId)}
                            disabled={savingChannel}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-400/20 bg-red-400/10 px-2.5 py-1.5 text-xs font-semibold text-red-100 transition hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Section>

          <Section title="Post preview" icon={ImageIcon}>
            <div className="space-y-3 text-sm">
              <PreviewRow label="Title" value={postForm.title || 'not set'} />
              <PreviewRow label="Targets" value={String(postForm.targetChannelIds.length)} />
              <PreviewRow label="Type" value={postForm.imageUrl ? 'image' : postForm.linkUrl ? 'link' : 'text'} />
              <PreviewRow label="Length" value={`${postForm.message.length} chars`} />
            </div>
            <div className="mt-4 rounded-lg border border-white/10 bg-slate-950/50 px-4 py-3 text-xs leading-5 text-slate-400">
              Facebook publishing requires a Page access token with Page posting permission. Telegram requires the bot to be admin in the channel.
            </div>
          </Section>
        </aside>
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon: any;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sky-400/20 bg-sky-400/10 text-sky-200">
            <Icon className="h-4 w-4" />
          </div>
          <h2 className="truncate text-sm font-semibold text-white">{title}</h2>
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm text-slate-300">{label}</span>
      <input
        name={name}
        value={value}
        onChange={onChange}
        type={type}
        placeholder={placeholder}
        className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
      />
    </label>
  );
}

function Select({
  label,
  name,
  value,
  onChange,
  options,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="text-sm text-slate-300">{label}</span>
      <select
        name={name}
        value={value}
        onChange={onChange}
        className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
      >
        {options.map((option) => (
          <option key={`${name}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex h-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-slate-200">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-sky-500 focus:ring-sky-500"
      />
    </label>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone = 'slate',
}: {
  icon: any;
  label: string;
  value: number;
  tone?: 'slate' | 'emerald' | 'sky' | 'amber';
}) {
  const tones = {
    slate: 'border-white/10 bg-white/5 text-slate-200',
    emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    sky: 'border-sky-400/20 bg-sky-400/10 text-sky-200',
    amber: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  };

  return (
    <div className={`rounded-lg border p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">{label}</p>
          <p className="mt-2 text-2xl font-bold text-white">{value}</p>
        </div>
        <Icon className="h-5 w-5 opacity-80" />
      </div>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3 last:border-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-100">{value}</span>
    </div>
  );
}
