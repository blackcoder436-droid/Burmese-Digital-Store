// ==========================================
// 3x-UI Panel API Service - Burmese Digital Store
// ==========================================
// TypeScript port of vpn bot xui_api.py

import { randomUUID } from 'crypto';
import { Agent } from 'undici';
import { createLogger } from '@/lib/logger';
import { getServer, type VpnServer } from '@/lib/vpn-servers';
import { validateExternalHttpUrl, validatePanelPath } from '@/lib/security';

const log = createLogger({ module: 'xui' });

const XUI_USERNAME = process.env.XUI_USERNAME || '';
const XUI_PASSWORD = process.env.XUI_PASSWORD || '';
const XUI_ALLOW_INSECURE_TLS = process.env.XUI_ALLOW_INSECURE_TLS === 'true';
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 1000;
const REQUEST_TIMEOUT_MS = 30_000;

// SSL verification is enabled by default. Only disable via env in controlled environments.
const tlsAgent = XUI_ALLOW_INSECURE_TLS
  ? new Agent({ connect: { rejectUnauthorized: false } })
  : null;

// ==========================================
// Types
// ==========================================

interface XuiLoginResult {
  success: boolean;
  msg?: string;
}

interface XuiInbound {
  id: number;
  protocol: string;
  port: number;
  remark: string;
  settings: string; // JSON string
  streamSettings: string; // JSON string — contains network, security, wsSettings, etc.
  [key: string]: unknown;
}

interface XuiApiResponse {
  success: boolean;
  msg?: string;
  obj?: unknown;
}

export interface CreateClientResult {
  success: true;
  clientEmail: string;
  clientUUID: string;
  subId: string;
  subLink: string;
  configLink: string;
  protocol: string;
  expiryTime: number; // unix ms
  devices: number;
}

interface ClientStats {
  email: string;
  up: number;
  down: number;
  total: number;
  expiryTime: number;
  enable: boolean;
  [key: string]: unknown;
}

// ==========================================
// XUI Session Class
// ==========================================

class XuiSession {
  private server: VpnServer;
  private baseUrl: string;
  private cookies: string = '';
  private loggedIn: boolean = false;

  constructor(server: VpnServer) {
    this.server = server;

    const urlCheck = validateExternalHttpUrl(server.url, { requiredAllowlistEnv: 'VPN_SERVER_ALLOWED_HOSTS' });
    if (!urlCheck.ok || !validatePanelPath(server.panelPath)) {
      // Defensive: prevent SSRF even if server record was tampered
      throw new Error('Blocked VPN panel endpoint');
    }

    this.baseUrl = `${server.url}${server.panelPath}`;
  }

  // ---- fetch wrapper with retry + SSL skip ----
  private async request(
    urlPath: string,
    options: RequestInit = {},
    retries = MAX_RETRIES
  ): Promise<Response> {
    const url = `${this.baseUrl}${urlPath}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };
    if (this.cookies) {
      headers['Cookie'] = this.cookies;
    }

    try {
      const requestOptions: RequestInit & { dispatcher?: Agent } = {
        ...options,
        headers,
        signal: controller.signal,
      };

      if (tlsAgent) {
        requestOptions.dispatcher = tlsAgent;
      }

      const response = await fetch(url, requestOptions);
      clearTimeout(timeout);

      if (response.status >= 500 && retries > 0) {
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS * (MAX_RETRIES - retries + 1)));
        return this.request(urlPath, options, retries - 1);
      }

      return response;
    } catch (error: unknown) {
      clearTimeout(timeout);
      if (retries > 0) {
        log.warn('XUI request failed, retrying', {
          url,
          error: error instanceof Error ? error.message : String(error),
          retriesLeft: retries - 1,
        });
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS * (MAX_RETRIES - retries + 1)));
        return this.request(urlPath, options, retries - 1);
      }
      throw error;
    }
  }

  // ---- Login ----
  async login(): Promise<boolean> {
    if (this.loggedIn) return true;
    if (!XUI_USERNAME || !XUI_PASSWORD) {
      log.error('XUI credentials missing');
      return false;
    }

    try {
      const body = new URLSearchParams({
        username: XUI_USERNAME,
        password: XUI_PASSWORD,
      });

      const res = await this.request('/login', {
        method: 'POST',
        body: body.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      // Capture session cookies
      const setCookie = res.headers.getSetCookie?.() || [];
      if (setCookie.length > 0) {
        this.cookies = setCookie.map((c) => c.split(';')[0]).join('; ');
      }

      const result: XuiLoginResult = await res.json();
      if (result.success) {
        this.loggedIn = true;
        log.info('Logged in to XUI panel', { server: this.server.id });
        return true;
      } else {
        log.error('XUI login failed', { server: this.server.id, msg: result.msg });
        return false;
      }
    } catch (error: unknown) {
      log.error('XUI login error', {
        server: this.server.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  // ---- Get inbounds ----
  async getInbounds(): Promise<XuiInbound[]> {
    if (!this.loggedIn && !(await this.login())) return [];

    try {
      const res = await this.request('/panel/api/inbounds/list');
      const result: XuiApiResponse = await res.json();
      return result.success ? (result.obj as XuiInbound[]) || [] : [];
    } catch (error: unknown) {
      log.error('Error getting inbounds', { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  // ---- Find inbound by protocol ----
  async getInboundByProtocol(protocol = 'trojan'): Promise<XuiInbound | null> {
    const inbounds = await this.getInbounds();
    return inbounds.find((ib) => ib.protocol === protocol) || null;
  }

  // ---- Create client ----
  async createClient(opts: {
    username: string;
    userId: string;
    devices: number;
    expiryDays: number;
    dataLimitGB?: number;
    protocol?: string;
  }): Promise<CreateClientResult | null> {
    if (!this.loggedIn && !(await this.login())) return null;

    const { username, userId, devices, expiryDays, dataLimitGB = 0, protocol = 'trojan' } = opts;

    try {
      // Find inbound by protocol
      let inbound = await this.getInboundByProtocol(protocol);
      if (!inbound) {
        // fallback to first inbound
        const inbounds = await this.getInbounds();
        if (inbounds.length === 0) {
          log.error('No inbounds found', { server: this.server.id });
          return null;
        }
        inbound = inbounds[0];
      }

      const inboundId = inbound.id;
      const inboundProtocol = inbound.protocol;

      // Protocol codes
      const protoCodes: Record<string, string> = {
        trojan: 'TR', vless: 'VL', vmess: 'VM', shadowsocks: 'SS',
      };
      const protoCode = protoCodes[inboundProtocol] || 'VPN';

      // Client name format: username - {devices}D / Web ({protocol}) Key{N}
      // Append Key number to avoid 3xUI duplicate email errors
      const deviceLabel = `${devices}D`;
      const baseName = username
        ? `${username} - ${deviceLabel} / Web (${protoCode})`
        : `User_${userId} - ${deviceLabel} / Web (${protoCode})`;

      // Count existing clients with same base name across all inbounds
      const allInbounds = await this.getInbounds();
      let keyNum = 1;
      for (const ib of allInbounds) {
        try {
          const ibSettings = JSON.parse(ib.settings || '{}');
          const clients = ibSettings.clients || [];
          for (const c of clients) {
            const email = c.email || '';
            // Match exact base name or base name + " Key{N}" suffix
            if (email === baseName || email.startsWith(`${baseName} Key`)) {
              const match = email.match(/ Key(\d+)$/);
              const num = match ? parseInt(match[1], 10) : 1;
              if (num >= keyNum) keyNum = num + 1;
            }
          }
        } catch { /* skip parse errors */ }
      }

      const clientName = `${baseName} Key${keyNum}`;

      const clientUUID = randomUUID();
      const subId = generateSubId();
      const expiryTime = Date.now() + expiryDays * 24 * 60 * 60 * 1000;
      const totalBytes = dataLimitGB > 0 ? Math.floor(dataLimitGB * 1024 * 1024 * 1024) : 0;

      // Build client settings
      const clientSettings = buildClientSettings({
        protocol: inboundProtocol,
        clientUUID,
        clientName,
        devices,
        totalBytes,
        expiryTime,
        userId,
        subId,
      });

      // POST addClient
      const body = new URLSearchParams({
        id: String(inboundId),
        settings: JSON.stringify({ clients: [clientSettings] }),
      });

      const res = await this.request('/panel/api/inbounds/addClient', {
        method: 'POST',
        body: body.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const result: XuiApiResponse = await res.json();
      if (!result.success) {
        log.error('Failed to create client', { server: this.server.id, msg: result.msg });
        return null;
      }

      log.info('VPN client created', { server: this.server.id, clientName });

      // Generate subscription link (3X-UI built-in)
      const subLink = `https://${this.server.domain}:${this.server.subPort}/sub/${subId}`;

      // Fetch actual config key (trojan://, vmess://, etc.) from 3X-UI subscription endpoint.
      // Wait briefly for 3X-UI to register the new client before fetching.
      let configLink = subLink; // fallback to sub link if all retries fail
      const SUB_FETCH_RETRIES = 3;
      const SUB_FETCH_DELAY_MS = 2000; // 2 seconds between attempts

      for (let attempt = 1; attempt <= SUB_FETCH_RETRIES; attempt++) {
        // Wait before fetching — gives 3X-UI time to register the client
        await new Promise((resolve) => setTimeout(resolve, SUB_FETCH_DELAY_MS));

        try {
          const subRes = await this.fetchSubscription(subLink);
          if (subRes) {
            configLink = subRes;
            log.info('Fetched config link from 3X-UI sub endpoint', {
              server: this.server.id,
              attempt,
            });
            break; // success — stop retrying
          }
          log.warn('Sub endpoint returned empty', { server: this.server.id, attempt });
        } catch (err: unknown) {
          log.warn('Failed to fetch from sub endpoint', {
            server: this.server.id,
            attempt,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (configLink === subLink) {
        log.error('All sub fetch attempts failed — configLink set to subLink as fallback', {
          server: this.server.id,
          subLink,
        });
      }

      return {
        success: true,
        clientEmail: clientName,
        clientUUID,
        subId,
        subLink,
        configLink,
        protocol: inboundProtocol,
        expiryTime,
        devices,
      };
    } catch (error: unknown) {
      log.error('Error creating client', {
        server: this.server.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  // ---- Delete client ----
  async deleteClient(inboundId: number, clientEmail: string): Promise<boolean> {
    if (!this.loggedIn && !(await this.login())) return false;

    try {
      const encoded = encodeURIComponent(clientEmail);
      const res = await this.request(`/panel/api/inbounds/${inboundId}/delClient/${encoded}`, {
        method: 'POST',
      });
      const result: XuiApiResponse = await res.json();
      return result.success;
    } catch (error: unknown) {
      log.error('Error deleting client', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  // ---- Get client stats ----
  async getClientStats(clientEmail: string): Promise<ClientStats | null> {
    if (!this.loggedIn && !(await this.login())) return null;

    try {
      const encoded = encodeURIComponent(clientEmail);
      const res = await this.request(`/panel/api/inbounds/getClientTraffics/${encoded}`);
      const result: XuiApiResponse = await res.json();
      return result.success ? (result.obj as ClientStats) : null;
    } catch (error: unknown) {
      log.error('Error getting client stats', { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  // ---- Find client by email across all inbounds ----
  async findClient(clientEmail: string): Promise<{ inboundId: number; protocol: string } | null> {
    const inbounds = await this.getInbounds();
    for (const ib of inbounds) {
      try {
        const settings = JSON.parse(ib.settings || '{}');
        const clients = settings.clients || [];
        for (const client of clients) {
          if (client.email === clientEmail) {
            return { inboundId: ib.id, protocol: ib.protocol };
          }
        }
      } catch { /* skip parse errors */ }
    }
    return null;
  }

  // ---- Fetch config link from 3X-UI subscription endpoint ----
  // 3X-UI /sub/{subId} returns base64-encoded config URI(s)
  async fetchSubscription(subUrl: string): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const requestOptions: RequestInit & { dispatcher?: Agent } = {
        signal: controller.signal,
      };
      if (tlsAgent) {
        requestOptions.dispatcher = tlsAgent;
      }

      const res = await fetch(subUrl, requestOptions);
      clearTimeout(timeout);

      if (!res.ok) {
        log.warn('Sub endpoint returned non-OK status', { status: res.status, subUrl });
        return null;
      }

      const body = await res.text();
      if (!body.trim()) return null;

      // 3X-UI returns base64-encoded config URIs (one per line after decoding)
      const decoded = Buffer.from(body.trim(), 'base64').toString('utf-8');
      const lines = decoded.split('\n').map((l) => l.trim()).filter(Boolean);

      // Return first config URI (trojan://, vless://, vmess://, ss://)
      return lines[0] || null;
    } catch (error: unknown) {
      log.warn('fetchSubscription error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}

// ==========================================
// Helper functions
// ==========================================

function generateSubId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function buildClientSettings(opts: {
  protocol: string;
  clientUUID: string;
  clientName: string;
  devices: number;
  totalBytes: number;
  expiryTime: number;
  userId: string;
  subId: string;
}): Record<string, unknown> {
  const { protocol, clientUUID, clientName, devices, totalBytes, expiryTime, userId, subId } = opts;

  const base = {
    email: clientName,
    limitIp: devices,
    totalGB: totalBytes,
    expiryTime,
    enable: true,
    tgId: userId,
    subId,
    reset: 0,
  };

  if (protocol === 'trojan' || protocol === 'shadowsocks') {
    return { ...base, password: clientUUID };
  }
  // vless, vmess
  return { ...base, id: clientUUID, flow: protocol === 'vless' ? '' : undefined };
}

// ==========================================
// Exported facade functions
// ==========================================

/** Session cache: reuse sessions per server to keep login cookies alive */
const sessionCache = new Map<string, XuiSession>();

async function getSession(serverId: string): Promise<XuiSession | null> {
  const cached = sessionCache.get(serverId);
  if (cached) return cached;

  const server = await getServer(serverId);
  if (!server) {
    log.error('Unknown server ID', { serverId });
    return null;
  }

  try {
    const session = new XuiSession(server);
    sessionCache.set(serverId, session);
    return session;
  } catch (err: unknown) {
    log.error('Failed to create XUI session (blocked endpoint)', {
      serverId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Provision a new VPN client on a 3xUI panel.
 */
export async function provisionVpnKey(opts: {
  serverId: string;
  username: string;
  userId: string;
  devices: number;
  expiryDays: number;
  dataLimitGB?: number;
  protocol?: string;
}): Promise<CreateClientResult | null> {
  const session = await getSession(opts.serverId);
  if (!session) return null;
  return session.createClient(opts);
}

/**
 * Revoke (delete) a VPN client from the panel.
 */
export async function revokeVpnKey(serverId: string, clientEmail: string): Promise<boolean> {
  const session = await getSession(serverId);
  if (!session) return false;

  const info = await session.findClient(clientEmail);
  if (!info) {
    log.warn('Client not found for revoke', { serverId, clientEmail });
    return false;
  }

  return session.deleteClient(info.inboundId, clientEmail);
}

/**
 * Get traffic stats for a VPN client.
 */
export async function getVpnClientStats(serverId: string, clientEmail: string) {
  const session = await getSession(serverId);
  if (!session) return null;
  return session.getClientStats(clientEmail);
}
