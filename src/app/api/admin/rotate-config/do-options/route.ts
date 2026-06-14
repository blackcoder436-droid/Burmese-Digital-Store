import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { getRotateConfig } from '@/models/RotateConfig';
import { requireAdmin } from '@/lib/auth';
import { apiLimiter } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DO_API = 'https://api.digitalocean.com/v2';

type HeaderMap = Record<string, string>;
type JsonObject = Record<string, any>;

function cleanSecret(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^Authorization:\s*Bearer\s+/i, '')
    .trim();
}

function normalizeKey(value?: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function getDoTokens(config: any) {
  const configuredTokens = (Array.isArray(config.doTokens) ? config.doTokens : [])
    .map((entry: any, index: number) => ({
      id: normalizeKey(entry.id || `do-token-${index + 1}`),
      label: String(entry.label || `Token ${index + 1}`).trim(),
      token: cleanSecret(entry.token),
      enabled: entry.enabled !== false,
    }))
    .filter((entry: any) => entry.token && entry.enabled);

  const legacyTokens = [
    { id: 'do-token-1', label: 'DigitalOcean 1', token: cleanSecret(config.doToken1), enabled: Boolean(config.doToken1) },
    { id: 'do-token-2', label: 'DigitalOcean 2', token: cleanSecret(config.doToken2), enabled: Boolean(config.doToken2) },
    { id: 'do-token-3', label: 'DigitalOcean 3', token: cleanSecret(config.doToken3), enabled: Boolean(config.doToken3) },
    { id: 'do-token-4', label: 'DigitalOcean 4', token: cleanSecret(config.doToken4), enabled: Boolean(config.doToken4) },
  ].filter((entry) => entry.token && entry.enabled);

  return configuredTokens.length > 0 ? configuredTokens : legacyTokens;
}

function selectDoToken(config: any, serverId?: string | null, tokenId?: string | null): string {
  const tokenPool = getDoTokens(config);
  const normalizedTokenId = normalizeKey(tokenId);
  if (normalizedTokenId) {
    const directToken = tokenPool.find((entry: any) => normalizeKey(entry.id) === normalizedTokenId);
    if (directToken?.token) return directToken.token;
  }

  const normalizedServerId = normalizeKey(serverId);
  const linkedServer = Array.isArray(config.serverLinks)
    ? config.serverLinks.find((entry: any) => normalizeKey(entry.serverName) === normalizedServerId && entry.enabled !== false)
    : null;

  if (linkedServer?.tokenId) {
    const linkedToken = tokenPool.find((entry: any) => normalizeKey(entry.id) === normalizeKey(linkedServer.tokenId));
    if (linkedToken?.token) return linkedToken.token;
  }

  return tokenPool[0]?.token || '';
}

async function readDoJson(res: Response, label: string): Promise<JsonObject> {
  const text = await res.text();
  let data: JsonObject = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label}: DigitalOcean returned non-JSON HTTP ${res.status}`);
  }

  if (!res.ok) {
    const message = data.message || data.error || `HTTP ${res.status} ${res.statusText || 'request failed'}`;
    throw new Error(`${label}: ${message}`);
  }

  return data;
}

async function fetchDoCollection(pathOrUrl: string, key: string, headers: HeaderMap) {
  const items: any[] = [];
  let nextUrl: string | null = pathOrUrl.startsWith('http') ? pathOrUrl : `${DO_API}${pathOrUrl}`;

  while (nextUrl) {
    const res = await fetch(nextUrl, { headers, cache: 'no-store' });
    const data = await readDoJson(res, key);
    items.push(...(Array.isArray(data[key]) ? data[key] : []));
    nextUrl = data.links?.pages?.next || null;
  }

  return items;
}

async function safeCollection(pathOrUrl: string, key: string, headers: HeaderMap) {
  try {
    return { items: await fetchDoCollection(pathOrUrl, key, headers), error: '' };
  } catch (error) {
    return { items: [], error: error instanceof Error ? error.message : String(error) };
  }
}

async function fetchDoObject(pathOrUrl: string, headers: HeaderMap) {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${DO_API}${pathOrUrl}`;
  const res = await fetch(url, { headers, cache: 'no-store' });
  return readDoJson(res, pathOrUrl);
}

async function safeObject(pathOrUrl: string, headers: HeaderMap) {
  try {
    return { data: await fetchDoObject(pathOrUrl, headers), error: '' };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

function uniqueByValue<T extends { value: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.value || seen.has(item.value)) return false;
    seen.add(item.value);
    return true;
  });
}

export async function GET(request: NextRequest) {
  const limited = await apiLimiter(request);
  if (limited) return limited;

  try {
    await requireAdmin();
    await connectDB();

    const config = await getRotateConfig();
    const token = selectDoToken(
      config,
      request.nextUrl.searchParams.get('serverId'),
      request.nextUrl.searchParams.get('tokenId')
    );

    const enabledTokens = getDoTokens(config);
    if (!token || enabledTokens.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No enabled DigitalOcean token is saved for this server.' },
        { status: 400 }
      );
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const [regionsRes, sizesRes, distroImagesRes, privateImagesRes, snapshotsRes, keysRes, vpcsRes, volumesRes] =
      await Promise.all([
        safeCollection('/regions?per_page=200', 'regions', headers),
        safeCollection('/sizes?per_page=200', 'sizes', headers),
        safeCollection('/images?type=distribution&per_page=200', 'images', headers),
        safeCollection('/images?private=true&per_page=200', 'images', headers),
        safeCollection('/snapshots?resource_type=droplet&per_page=200', 'snapshots', headers),
        safeCollection('/account/keys?per_page=200', 'ssh_keys', headers),
        safeCollection('/vpcs?per_page=200', 'vpcs', headers),
        safeCollection('/volumes?per_page=200', 'volumes', headers),
      ]);

    const accountResults = await Promise.all(
      enabledTokens.map(async (tokenEntry: any) => {
        const accountHeaders = {
          Authorization: `Bearer ${tokenEntry.token}`,
          'Content-Type': 'application/json',
        };

        const [accountRes, balanceRes] = await Promise.all([
          safeObject('/account', accountHeaders),
          safeObject('/customers/my/balance', accountHeaders),
        ]);

        const accountData = accountRes.data?.account || accountRes.data || {};
        const balanceData = balanceRes.data || {};

        return {
          id: tokenEntry.id,
          label: tokenEntry.label,
          email: accountData.email || tokenEntry.label || 'Unknown',
          status: accountData.status || 'unknown',
          floatingIpLimit: accountData.floating_ip_limit || 0,
          dropletLimit: accountData.droplet_limit || 0,
          volumeLimit: accountData.volume_limit || 0,
          balance:
            balanceData.month_to_date_balance ??
            balanceData.balance?.amount ??
            balanceData.balance ??
            0,
          monthToDateCharges:
            balanceData.month_to_date_charges ||
            balanceData.month_to_date_balance ||
            balanceData.balance?.amount ||
            '$0.00',
          error: [accountRes.error, balanceRes.error].filter(Boolean).join(' | '),
        };
      })
    );

    const images = uniqueByValue([
      ...distroImagesRes.items.map((image: any) => ({
        value: String(image.slug || image.id || ''),
        label: `${image.distribution || 'Image'} ${image.name || image.slug || image.id}`,
        description: image.public ? 'Distribution' : 'Private image',
        regions: Array.isArray(image.regions) ? image.regions : [],
      })),
      ...privateImagesRes.items.map((image: any) => ({
        value: String(image.slug || image.id || ''),
        label: `${image.distribution || 'Private'} ${image.name || image.slug || image.id}`,
        description: 'Private image',
        regions: Array.isArray(image.regions) ? image.regions : [],
      })),
      ...snapshotsRes.items.map((snapshot: any) => ({
        value: String(snapshot.id || ''),
        label: snapshot.name || `Snapshot ${snapshot.id}`,
        description: 'Droplet snapshot',
        regions: Array.isArray(snapshot.regions) ? snapshot.regions : [],
      })),
    ]);

    const errors = [
      regionsRes.error,
      sizesRes.error,
      distroImagesRes.error,
      privateImagesRes.error,
      snapshotsRes.error,
      keysRes.error,
      vpcsRes.error,
      volumesRes.error,
      accountRes.error,
      balanceRes.error,
    ].filter(Boolean);

    const accountData = accountRes.data?.account || accountRes.data || {};

    return NextResponse.json({
      success: true,
      data: {
        regions: regionsRes.items.map((region: any) => ({
          value: region.slug,
          label: region.name,
          description: region.available === false ? 'Unavailable' : region.slug,
          available: region.available !== false,
        })),
        sizes: sizesRes.items.map((size: any) => ({
          value: size.slug,
          label: `${size.slug} - $${size.price_monthly}/mo`,
          description: `${size.vcpus} vCPU / ${Math.round(size.memory / 1024)} GB RAM / ${size.disk} GB SSD / ${size.transfer} TB transfer`,
          regions: Array.isArray(size.regions) ? size.regions : [],
        })),
        images,
        sshKeys: keysRes.items.map((key: any) => ({
          value: String(key.id || key.fingerprint || ''),
          label: key.name || key.fingerprint || `Key ${key.id}`,
          description: key.fingerprint || '',
        })),
        vpcs: vpcsRes.items.map((vpc: any) => ({
          value: vpc.id || vpc.uuid,
          label: vpc.name || vpc.id || vpc.uuid,
          description: vpc.region_slug || '',
          region: vpc.region_slug || '',
        })),
        volumes: volumesRes.items.map((volume: any) => ({
          value: volume.id,
          label: volume.name || volume.id,
          description: `${volume.size_gigabytes || '?'} GB${volume.region?.slug ? ` / ${volume.region.slug}` : ''}`,
          region: volume.region?.slug || '',
        })),
        account: {
          email: accountData?.email || 'Unknown',
          status: accountData?.status || 'active',
          floatingIpLimit: accountData?.floating_ip_limit || 0,
          dropletLimit: accountData?.droplet_limit || 0,
          volumeLimit: accountData?.volume_limit || 0,
          balance:
            balanceRes.data?.month_to_date_balance ??
            balanceRes.data?.balance?.amount ??
            balanceRes.data?.balance ??
            0,
          monthToDateCharges:
            balanceRes.data?.month_to_date_charges ||
            balanceRes.data?.month_to_date_balance ||
            balanceRes.data?.balance?.amount ||
            '$0.00',
        },
        accounts: accountResults,
        errors,
      },
    });
  } catch (error: any) {
    if (error.message === 'Admin access required') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load DigitalOcean options' },
      { status: 500 }
    );
  }
}
