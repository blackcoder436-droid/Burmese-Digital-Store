// ==========================================
// 3x-UI Panel API Service - Burmese Digital Store
// ==========================================
// TypeScript port of vpn bot xui_api.py

import { randomUUID } from 'crypto';
import { Agent } from 'undici';
import { createLogger } from '@/lib/logger';
import { getServer, type VpnServer } from '@/lib/vpn-servers';

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

      // Client name format: username - {devices}D / Web ({protocol})
      const deviceLabel = `${devices}D`;
      const clientName = username
        ? `${username} - ${deviceLabel} / Web (${protoCode})`
        : `User_${userId} - ${deviceLabel} / Web (${protoCode})`;

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

      // Extract shadowsocks method from inbound settings if needed
      let ssMethod = 'chacha20-ietf-poly1305'; // default
      if (inboundProtocol === 'shadowsocks') {
        try {
          const inboundSettings = JSON.parse(inbound.settings || '{}');
          if (inboundSettings.method) {
            ssMethod = inboundSettings.method;
          }
        } catch {
          // Use default
        }
      }

      // Generate links
      const subLink = `https://${this.server.domain}:${this.server.subPort}/sub/${subId}`;
      const configLink = buildConfigLink({
        protocol: inboundProtocol,
        clientUUID,
        clientName,
        server: this.server,
        port: inbound.port,
        remark: inbound.remark || 'VPN',
        expiryDays,
        ssMethod,
      });

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

function buildConfigLink(opts: {
  protocol: string;
  clientUUID: string;
  clientName: string;
  server: VpnServer;
  port: number;
  remark: string;
  expiryDays: number;
  ssMethod?: string;
}): string {
  const { protocol, clientUUID, clientName, server, port, remark, expiryDays, ssMethod = 'chacha20-ietf-poly1305' } = opts;
  const encodedRemark = encodeURIComponent(`${remark}-${clientName}-${expiryDays}D`);

  if (protocol === 'trojan') {
    const trojanPort = server.trojanPort || port;
    return `trojan://${clientUUID}@${server.domain}:${trojanPort}?security=none&type=tcp#${encodedRemark}`;
  }
  if (protocol === 'vless') {
    return `vless://${clientUUID}@${server.domain}:${port}?type=tcp&security=none#${encodedRemark}`;
  }
  if (protocol === 'vmess') {
    const vmessConfig = {
      v: '2',
      ps: `${remark}-${clientName}`,
      add: server.domain,
      port: String(port),
      id: clientUUID,
      aid: '0',
      net: 'tcp',
      type: 'none',
      tls: '',
    };
    return `vmess://${Buffer.from(JSON.stringify(vmessConfig)).toString('base64')}`;
  }
  if (protocol === 'shadowsocks') {
    // ss://BASE64(method:password)@server:port?type=tcp#remark
    const userInfo = Buffer.from(`${ssMethod}:${clientUUID}`).toString('base64');
    return `ss://${userInfo}@${server.domain}:${port}?type=tcp#${encodedRemark}`;
  }
  // Fallback: subscription link
  return `https://${server.domain}:${server.subPort}/sub/${opts.clientUUID}`;
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

  const session = new XuiSession(server);
  sessionCache.set(serverId, session);
  return session;
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
