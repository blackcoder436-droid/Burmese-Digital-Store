import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';
import { logActivity } from '@/models/ActivityLog';
import { getRotateConfig } from '@/models/RotateConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CF_API = 'https://api.cloudflare.com/client/v4';
const RECORD_TYPES = new Set(['A', 'AAAA', 'CNAME', 'TXT', 'MX']);

type HeaderMap = Record<string, string>;
type CfAccount = {
  id: string;
  label: string;
  token: string;
  email?: string;
  enabled?: boolean;
};

function cleanSecret(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^Authorization:\s*Bearer\s+/i, '')
    .trim();
}

function cleanText(value: unknown, maxLength = 500): string {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanDomain(value: unknown): string {
  return cleanText(value, 253)
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .replace(/[^a-z0-9._*-]/g, '');
}

function cleanRecordType(value: unknown) {
  const type = cleanText(value || 'A', 12).toUpperCase();
  return RECORD_TYPES.has(type) ? type : 'A';
}

function cleanTtl(value: unknown) {
  const ttl = Number(value);
  if (!Number.isFinite(ttl)) return 60;
  if (ttl === 1) return 1;
  return Math.max(60, Math.min(86400, Math.round(ttl)));
}

function cleanPriority(value: unknown) {
  const priority = Number(value);
  if (!Number.isFinite(priority)) return undefined;
  return Math.max(0, Math.min(65535, Math.round(priority)));
}

function looksLikeGlobalApiKey(value: string) {
  return /^[a-f0-9]{32,64}$/i.test(value);
}

function authCandidates(account: CfAccount): Array<{ label: string; headers: HeaderMap }> {
  const token = cleanSecret(account.token);
  const email = cleanText(account.email, 160).toLowerCase();

  if (!token) {
    throw new Error('Cloudflare token is missing');
  }

  const apiToken = {
    label: 'API Token',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (!email) return [apiToken];

  const globalKey = {
    label: 'Global API Key',
    headers: {
      'X-Auth-Email': email,
      'X-Auth-Key': token,
      'Content-Type': 'application/json',
    },
  };

  return looksLikeGlobalApiKey(token) ? [globalKey, apiToken] : [apiToken, globalKey];
}

async function readCloudflareJson(response: Response, label: string) {
  const text = await response.text();
  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label}: Cloudflare returned a non-JSON response`);
  }

  if (!response.ok || data?.success === false) {
    const message =
      data?.errors?.[0]?.message ||
      data?.messages?.[0]?.message ||
      data?.message ||
      `HTTP ${response.status}`;
    throw new Error(`${label}: ${message}`);
  }

  return data;
}

async function fetchCloudflare(account: CfAccount, path: string, init: RequestInit, label: string) {
  const errors: string[] = [];

  for (const candidate of authCandidates(account)) {
    try {
      const response = await fetch(`${CF_API}${path}`, {
        ...init,
        headers: {
          ...candidate.headers,
          ...(init.headers || {}),
        },
      });
      return {
        authLabel: candidate.label,
        data: await readCloudflareJson(response, `${label} (${candidate.label})`),
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(errors.join(' | ') || `${label}: Cloudflare request failed`);
}

function safeAccount(account: CfAccount) {
  return {
    id: account.id,
    label: account.label,
    email: account.email || '',
    enabled: account.enabled !== false,
  };
}

function normalizeAccounts(config: any): CfAccount[] {
  const arrayAccounts = Array.isArray(config.cfAccounts) ? config.cfAccounts : [];
  const accounts = arrayAccounts.length > 0
    ? arrayAccounts
    : config.cfToken
      ? [{ id: 'cf-account-1', label: 'Cloudflare 1', token: config.cfToken, email: config.cfEmail, enabled: true }]
      : [];

  return accounts
    .map((row: any, index: number) => ({
      id: cleanText(row.id || `cf-account-${index + 1}`, 120),
      label: cleanText(row.label || `Cloudflare ${index + 1}`, 120),
      token: cleanSecret(row.token),
      email: cleanText(row.email || '', 160).toLowerCase(),
      enabled: row.enabled !== false,
    }))
    .filter((row: CfAccount) => row.token);
}

function selectAccount(accounts: CfAccount[], accountId: string | null) {
  const enabledAccounts = accounts.filter((account) => account.enabled !== false);
  const account = accountId
    ? enabledAccounts.find((item) => item.id === accountId)
    : enabledAccounts[0];

  if (!account) {
    throw new Error('Cloudflare account token was not found. Save a Cloudflare token first.');
  }

  return account;
}

function mapZone(zone: any) {
  return {
    id: String(zone.id || ''),
    name: String(zone.name || ''),
    status: String(zone.status || ''),
    type: String(zone.type || ''),
    paused: !!zone.paused,
  };
}

function mapRecord(record: any) {
  return {
    id: String(record.id || ''),
    type: String(record.type || ''),
    name: String(record.name || ''),
    content: String(record.content || ''),
    proxied: !!record.proxied,
    ttl: Number(record.ttl || 1),
    priority: record.priority ?? null,
    comment: String(record.comment || ''),
    tags: Array.isArray(record.tags) ? record.tags : [],
    createdOn: record.created_on || null,
    modifiedOn: record.modified_on || null,
  };
}

async function loadAccount(request: NextRequest) {
  await connectDB();
  const config = await getRotateConfig();
  const accounts = normalizeAccounts(config);
  const account = selectAccount(accounts, request.nextUrl.searchParams.get('accountId'));
  return { account, accounts };
}

export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
    const { account, accounts } = await loadAccount(request);
    const zoneId = cleanText(request.nextUrl.searchParams.get('zoneId'), 120);

    if (!zoneId) {
      const { data } = await fetchCloudflare(
        account,
        '/zones?per_page=100',
        { method: 'GET' },
        'Cloudflare zones'
      );

      return NextResponse.json({
        success: true,
        data: {
          account: safeAccount(account),
          accounts: accounts.map(safeAccount),
          zones: Array.isArray(data.result) ? data.result.map(mapZone) : [],
        },
      });
    }

    const params = new URLSearchParams({ per_page: '100' });
    const type = request.nextUrl.searchParams.get('type');
    const name = request.nextUrl.searchParams.get('name');
    if (type) params.set('type', cleanRecordType(type));
    if (name) params.set('name', cleanDomain(name));

    const { data } = await fetchCloudflare(
      account,
      `/zones/${encodeURIComponent(zoneId)}/dns_records?${params.toString()}`,
      { method: 'GET' },
      'Cloudflare DNS records'
    );

    return NextResponse.json({
      success: true,
      data: {
        account: safeAccount(account),
        accounts: accounts.map(safeAccount),
        records: Array.isArray(data.result) ? data.result.map(mapRecord) : [],
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load Cloudflare DNS' },
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
    const config = await getRotateConfig();
    const accounts = normalizeAccounts(config);
    const body = await request.json();
    const account = selectAccount(accounts, cleanText(body.accountId, 120));
    const zoneId = cleanText(body.zoneId, 120);
    const type = cleanRecordType(body.type);
    const name = cleanDomain(body.name);
    const content = cleanText(body.content, 1000);

    if (!zoneId || !name || !content) {
      return NextResponse.json({ success: false, error: 'Zone, record name, and content are required' }, { status: 400 });
    }

    const payload: Record<string, any> = {
      type,
      name,
      content,
      ttl: cleanTtl(body.ttl),
      proxied: type === 'A' || type === 'AAAA' || type === 'CNAME' ? !!body.proxied : false,
    };
    const priority = cleanPriority(body.priority);
    if (type === 'MX' && priority !== undefined) payload.priority = priority;

    const { authLabel, data } = await fetchCloudflare(
      account,
      `/zones/${encodeURIComponent(zoneId)}/dns_records`,
      { method: 'POST', body: JSON.stringify(payload) },
      'Create Cloudflare DNS record'
    );

    await logActivity({
      admin: admin.userId,
      action: 'settings_updated',
      target: `Cloudflare DNS: ${name}`,
      details: `Created ${type} record under ${account.label} via ${authLabel}`,
    });

    return NextResponse.json({ success: true, data: { record: mapRecord(data.result), account: safeAccount(account) } }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create DNS record' },
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
    const config = await getRotateConfig();
    const accounts = normalizeAccounts(config);
    const body = await request.json();
    const account = selectAccount(accounts, cleanText(body.accountId, 120));
    const zoneId = cleanText(body.zoneId, 120);
    const recordId = cleanText(body.recordId, 120);

    if (!zoneId || !recordId) {
      return NextResponse.json({ success: false, error: 'Zone and record ID are required' }, { status: 400 });
    }

    const { data: existingData } = await fetchCloudflare(
      account,
      `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`,
      { method: 'GET' },
      'Load Cloudflare DNS record'
    );
    const existing = existingData.result || {};
    const type = cleanRecordType(body.type ?? existing.type);
    const name = cleanDomain(body.name ?? existing.name);
    const content = cleanText(body.content ?? existing.content, 1000);

    if (!name || !content) {
      return NextResponse.json({ success: false, error: 'Record name and content are required' }, { status: 400 });
    }

    const payload: Record<string, any> = {
      type,
      name,
      content,
      ttl: cleanTtl(body.ttl ?? existing.ttl),
      proxied: type === 'A' || type === 'AAAA' || type === 'CNAME' ? !!(body.proxied ?? existing.proxied) : false,
    };
    const priority = cleanPriority(body.priority ?? existing.priority);
    if (type === 'MX' && priority !== undefined) payload.priority = priority;

    const { authLabel, data } = await fetchCloudflare(
      account,
      `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`,
      { method: 'PUT', body: JSON.stringify(payload) },
      'Update Cloudflare DNS record'
    );

    await logActivity({
      admin: admin.userId,
      action: 'settings_updated',
      target: `Cloudflare DNS: ${name}`,
      details: `Updated ${type} record under ${account.label} via ${authLabel}`,
    });

    return NextResponse.json({ success: true, data: { record: mapRecord(data.result), account: safeAccount(account) } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update DNS record' },
      { status: error.message === 'Admin access required' ? 403 : 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    const admin = await requireAdmin();
    const { account } = await loadAccount(request);
    const zoneId = cleanText(request.nextUrl.searchParams.get('zoneId'), 120);
    const recordId = cleanText(request.nextUrl.searchParams.get('recordId'), 120);
    const name = cleanDomain(request.nextUrl.searchParams.get('name'));

    if (!zoneId || !recordId) {
      return NextResponse.json({ success: false, error: 'Zone and record ID are required' }, { status: 400 });
    }

    await fetchCloudflare(
      account,
      `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`,
      { method: 'DELETE' },
      'Delete Cloudflare DNS record'
    );

    await logActivity({
      admin: admin.userId,
      action: 'settings_updated',
      target: `Cloudflare DNS: ${name || recordId}`,
      details: `Deleted DNS record under ${account.label}`,
    });

    return NextResponse.json({ success: true, message: 'DNS record deleted' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete DNS record' },
      { status: error.message === 'Admin access required' ? 403 : 500 }
    );
  }
}
