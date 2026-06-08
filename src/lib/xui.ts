// ==========================================
// 3x-UI Panel API Service - Burmese Digital Store
// ==========================================
// TypeScript port of vpn bot xui_api.py

import { randomUUID } from 'crypto';
import { Agent } from 'undici';
import { createLogger } from '@/lib/logger';
import { getServer, getEnabledServers, getAllServers, type VpnServer } from '@/lib/vpn-servers';
import { hostnameMatchesAllowlist, validateExternalHttpUrl, validatePanelPath } from '@/lib/security';
import {
  buildSafeClientEmail,
  clientEmailNeedsRename,
  isInvalidClientEmailMessage,
  sanitizeClientLabel,
  toClientsApiPayload,
} from '@/lib/xui-client-email';

export {
  buildSafeClientEmail,
  clientEmailNeedsRename,
  isInvalidClientEmailMessage,
  sanitizeClientLabel,
  toClientsApiPayload,
} from '@/lib/xui-client-email';

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
  enable: boolean;
  settings: string; // JSON string
  streamSettings: string; // JSON string — contains network, security, wsSettings, etc.
  [key: string]: unknown;
}

interface XuiApiResponse {
  success: boolean;
  msg?: string;
  obj?: unknown;
}

type ProtocolName = 'trojan' | 'vless' | 'vmess' | 'shadowsocks';

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

function normalizeJsonField(value: unknown, fallback = '{}'): string {
  if (typeof value === 'string') return value || fallback;
  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function normalizeInbound(raw: XuiInbound): XuiInbound {
  return {
    ...raw,
    settings: normalizeJsonField(raw.settings),
    streamSettings: normalizeJsonField(raw.streamSettings),
    sniffing: normalizeJsonField(raw.sniffing),
  };
}

// ==========================================
// XUI Session Class
// ==========================================

class XuiSession {
  private server: VpnServer;
  private baseUrl: string;
  private apiKey: string;
  private cookies: string = '';
  private loggedIn: boolean = false;
  private csrfToken: string | null = null;

  constructor(server: VpnServer) {
    this.server = server;

    const urlCheck = validateExternalHttpUrl(server.url, { requiredAllowlistEnv: 'VPN_SERVER_ALLOWED_HOSTS' });
    const parsedUrl = new URL(server.url);
    const trustedHosts = [server.domain, parsedUrl.hostname].filter((value): value is string => Boolean(value));
    const trustedHostAllowed = hostnameMatchesAllowlist(parsedUrl.hostname, trustedHosts);

    if ((!urlCheck.ok && !trustedHostAllowed) || !validatePanelPath(server.panelPath)) {
      // Defensive: prevent SSRF even if server record was tampered
      const reason = (!urlCheck.ok && !trustedHostAllowed ? urlCheck.error : 'invalid panelPath');
      throw new Error(`Blocked VPN panel endpoint: ${reason}`);
    }

    this.baseUrl = `${server.url}${server.panelPath}`;
    this.apiKey = server.apiKey?.trim() || '';
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
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    if (this.cookies) {
      headers['Cookie'] = this.cookies;
    }

    const method = (options.method || 'GET').toUpperCase();
    headers['X-Requested-With'] = 'XMLHttpRequest';

    const sendRequest = async (csrfToken: string | null): Promise<Response> => {
      const requestHeaders: Record<string, string> = { ...headers };
      if (csrfToken) {
        requestHeaders['X-CSRF-Token'] = csrfToken;
      } else {
        delete requestHeaders['X-CSRF-Token'];
      }

      const requestOptions: RequestInit & { dispatcher?: Agent } = {
        ...options,
        headers: requestHeaders,
        signal: controller.signal,
      };

      if (tlsAgent) {
        requestOptions.dispatcher = tlsAgent;
      }

      return fetch(url, requestOptions);
    };

    try {
      let response = await sendRequest(null);

      if (
        response.status === 403 &&
        retries > 0 &&
        method !== 'GET' &&
        method !== 'HEAD' &&
        !this.apiKey
      ) {
        this.csrfToken = null;
        const csrfToken = await this.getCsrfToken();
        if (csrfToken) {
          response = await sendRequest(csrfToken);
        }
      }

      clearTimeout(timeout);

      // Automatically capture and store session cookies from any request
      const setCookie = typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie()
        : response.headers.get('set-cookie')
          ? [response.headers.get('set-cookie') as string]
          : [];
      if (setCookie.length > 0) {
        // Simple cookie extraction, dropping attributes for ease
        const newCookies = setCookie.map((c) => c.split(';')[0]).join('; ');
        this.cookies = newCookies;
      }

      if (response.status === 403 && retries > 0 && method !== 'GET' && method !== 'HEAD') {
        this.csrfToken = null;
        return this.request(urlPath, options, retries - 1);
      }

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

  private async getCsrfToken(): Promise<string | null> {
    if (this.csrfToken) return this.csrfToken;

    try {
      const res = await this.request('/csrf-token', { method: 'GET' });
      const result = (await res.json()) as { success?: boolean; obj?: string };
      if (result.success && typeof result.obj === 'string' && result.obj) {
        this.csrfToken = result.obj;
        return this.csrfToken;
      }
    } catch (error: unknown) {
      log.warn('Failed to load XUI CSRF token', {
        server: this.server.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return null;
  }

  // ---- Login ----
  async login(): Promise<boolean> {
    if (this.loggedIn) return true;
    if (this.apiKey) {
      this.loggedIn = true;
      return true;
    }
    if (!XUI_USERNAME || !XUI_PASSWORD) {
      log.error('XUI credentials missing');
      return false;
    }

    try {
      const body = {
        username: XUI_USERNAME,
        password: XUI_PASSWORD,
        twoFactorCode: '' // Optional for most setups
      };

      const url = `${this.baseUrl}/login`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const reqHeaders: Record<string, string> = {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      };

      const sendLogin = async (csrfToken: string | null): Promise<Response> => {
        const headers = { ...reqHeaders };
        if (this.cookies) {
          headers['Cookie'] = this.cookies;
        }
        if (csrfToken) {
          headers['X-CSRF-Token'] = csrfToken;
        }

        const requestOptions: RequestInit & { dispatcher?: Agent } = {
          method: 'POST',
          body: JSON.stringify(body),
          headers,
          signal: controller.signal,
        };

        if (tlsAgent) {
          requestOptions.dispatcher = tlsAgent;
        }

        return fetch(url, requestOptions);
      };

      let res = await sendLogin(null);
      if (res.status === 403) {
        this.csrfToken = null;
        const csrfToken = await this.getCsrfToken();
        if (csrfToken) {
          res = await sendLogin(csrfToken);
        }
      }

      clearTimeout(timeout);

      // Cookies are now captured automatically by getCsrfToken and this.request()
      // Or we capture it here directly since we bypassed this.request for login
      const setCookie = typeof res.headers.getSetCookie === 'function'
        ? res.headers.getSetCookie()
        : res.headers.get('set-cookie')
          ? [res.headers.get('set-cookie') as string]
          : [];
      if (setCookie.length > 0) {
        this.cookies = setCookie.map((c) => c.split(';')[0]).join('; ');
      }

      const text = await res.text();
      if (!text) {
        log.error('XUI login returned empty response', {
          server: this.server.id,
          status: res.status,
        });
        return false;
      }

      let result: XuiLoginResult;
      try {
        result = JSON.parse(text) as XuiLoginResult;
      } catch (error: unknown) {
        log.error('XUI login returned non-JSON response', {
          server: this.server.id,
          status: res.status,
          bodyPreview: text.slice(0, 200),
          error: error instanceof Error ? error.message : String(error),
        });
        return false;
      }

      if (result.success) {
        this.loggedIn = true;
        log.info('Logged in to XUI panel', { server: this.server.id });
        return true;
      } else {
        log.error('XUI login failed', { server: this.server.id, status: res.status, msg: result.msg });
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
      const text = await res.text();
      if (!text) {
        log.error('XUI getInbounds returned empty response', {
          server: this.server.id,
          status: res.status,
        });
        return [];
      }

      let result: XuiApiResponse;
      try {
        result = JSON.parse(text) as XuiApiResponse;
      } catch (error: unknown) {
        log.error('Error parsing inbounds response', {
          server: this.server.id,
          status: res.status,
          bodyPreview: text.slice(0, 200),
          error: error instanceof Error ? error.message : String(error),
        });
        return [];
      }

      const inbounds = result.success && Array.isArray(result.obj)
        ? result.obj as XuiInbound[]
        : [];
      return inbounds.map(normalizeInbound);
    } catch (error: unknown) {
      log.error('Error getting inbounds', { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  // ---- Find inbound by protocol (only enabled inbounds) ----
  async getInboundByProtocol(protocol = 'trojan'): Promise<XuiInbound | null> {
    const normalizedProtocol = String(protocol || 'trojan').toLowerCase() as ProtocolName;
    const configuredPort = this.getConfiguredPortForProtocol(normalizedProtocol);
    if (!configuredPort) return null;
    return this.getInboundByProtocolAndPort(normalizedProtocol, configuredPort);
  }

  private getConfiguredPortForProtocol(protocol: ProtocolName): number | null {
    const ports = this.server.protocolPorts || {};
    const legacyTrojanPort = this.server.trojanPort ?? undefined;
    const configured = protocol === 'trojan'
      ? (ports.trojan ?? legacyTrojanPort)
      : ports[protocol];

    if (typeof configured === 'number' && Number.isFinite(configured) && configured > 0) {
      return configured;
    }

    return null;
  }

  private async readApiResponse(res: Response, action: string): Promise<{ status: number; result: XuiApiResponse }> {
    const text = await res.text();
    if (!text.trim()) {
      return {
        status: res.status,
        result: {
          success: false,
          msg: `${action} returned an empty response with HTTP ${res.status}`,
        },
      };
    }

    try {
      return { status: res.status, result: JSON.parse(text) as XuiApiResponse };
    } catch {
      return {
        status: res.status,
        result: {
          success: false,
          msg: `${action} returned non-JSON response with HTTP ${res.status}: ${text.slice(0, 200)}`,
        },
      };
    }
  }

  private async getInboundByProtocolAndPort(protocol: ProtocolName, port: number): Promise<XuiInbound | null> {
    const inbounds = await this.getInbounds();
    const matches = inbounds.filter((ib) => {
      const inboundProtocol = String(ib.protocol || '').toLowerCase();
      return ib.enable !== false && inboundProtocol === protocol && Number(ib.port) === Number(port);
    });

    if (matches.length === 0) return null;

    if (matches.length > 1) {
      log.warn('Multiple enabled inbounds matched configured protocol port; using first match', {
        server: this.server.id,
        protocol,
        port,
        inboundIds: matches.map((ib) => ib.id),
      });
    }

    return matches[0] || null;
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
    const normalizedProtocol = String(protocol || 'trojan').toLowerCase() as ProtocolName;

    try {
      const configuredPort = this.getConfiguredPortForProtocol(normalizedProtocol);
      if (!configuredPort) {
        log.error('No configured protocol port found for server', {
          server: this.server.id,
          protocol: normalizedProtocol,
          protocolPorts: this.server.protocolPorts,
          trojanPort: this.server.trojanPort ?? null,
        });
        return null;
      }

      // Find the exact enabled inbound matching the configured protocol + port.
      const inbound = await this.getInboundByProtocolAndPort(normalizedProtocol, configuredPort);
      if (!inbound) {
        log.error('Configured protocol inbound not found on 3xUI', {
          server: this.server.id,
          requestedProtocol: normalizedProtocol,
          configuredPort,
        });
        return null;
      }

      const inboundId = inbound.id;
      const inboundProtocol = inbound.protocol;
      const inboundPort = inbound.port;

      // Final guard: if the panel inbound and configured port differ, refuse to provision.
      if (configuredPort !== inboundPort) {
        log.error('Protocol port mismatch: refusing to provision against wrong 3xUI inbound', {
          server: this.server.id,
          protocol: inboundProtocol,
          configuredPort,
          inboundPort,
        });
        return null;
      }

      // Protocol codes
      // Client names are intentionally compact because recent 3x-ui versions
      // reject spaces and many punctuation characters in client emails.
      const deviceLabel = `${devices}D`;
      const safeUsername = username ? sanitizeClientLabel(username) : '';
      const safeUserId = sanitizeClientLabel(userId);
      const baseName = safeUsername
        ? `${safeUsername}-${deviceLabel}`
        : `User_${safeUserId || 'vpn'}-${deviceLabel}`;

      // Count existing clients with same base name across all inbounds
      const allInbounds = await this.getInbounds();
      let keyNum = 1;
      for (const ib of allInbounds) {
        try {
          const ibSettings = JSON.parse(ib.settings || '{}');
          const clients = ibSettings.clients || [];
          for (const c of clients) {
            const email = c.email || '';
            // Match exact base name or base name + "-Key{N}" suffix.
            if (email === baseName || email.startsWith(`${baseName}-Key`)) {
              const match = email.match(/-Key(\d+)$/);
              const num = match ? parseInt(match[1], 10) : 1;
              if (num >= keyNum) keyNum = num + 1;
            }
          }
        } catch { /* skip parse errors */ }
      }

      const clientName = keyNum === 1 ? baseName : `${baseName}-Key${keyNum}`;

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

      // 3x-ui v3.2+ stores clients as first-class rows and exposes /clients/*.
      // Older panels still use the inbound-scoped endpoint, so keep it as fallback.
      const legacyBody = new URLSearchParams({
        id: String(inboundId),
        settings: JSON.stringify({ clients: [clientSettings] }),
      });

      let res = await this.request('/panel/api/clients/add', {
        method: 'POST',
        body: JSON.stringify({ client: toClientsApiPayload(clientSettings), inboundIds: [inboundId] }),
        headers: { 'Content-Type': 'application/json' },
      });

      const clientsCreate = await this.readApiResponse(res, 'create client via clients API');
      let result = clientsCreate.result;
      const status = clientsCreate.status;
      if (!result.success && status === 404) {
        res = await this.request('/panel/api/inbounds/addClient', {
          method: 'POST',
          body: legacyBody,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        ({ result } = await this.readApiResponse(res, 'create client via legacy inbound API'));
      }

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
      const SUB_FETCH_RETRIES = 1;
      const SUB_FETCH_DELAY_MS = 500; // 2 seconds between attempts

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
  async deleteClient(inboundId: number, clientEmail: string, clientIdentifier?: string): Promise<boolean> {
    if (!this.loggedIn && !(await this.login())) return false;

    try {
      const encoded = encodeURIComponent(clientEmail);
      const res = await this.request(`/panel/api/clients/del/${encoded}`, {
        method: 'POST',
      });
      const clientsDelete = await this.readApiResponse(res, 'delete client via clients API');
      let result = clientsDelete.result;
      const status = clientsDelete.status;

      if (!result.success && clientEmailNeedsRename(clientEmail)) {
        const found = await this.getClientFull(clientEmail);
        if (found?.client) {
          const safeEmail = buildSafeClientEmail(found.client);
          const renamedClient = toClientsApiPayload({ ...found.client, email: safeEmail });
          const renameRes = await this.request(`/panel/api/clients/update/${encoded}`, {
            method: 'POST',
            body: JSON.stringify(renamedClient),
            headers: { 'Content-Type': 'application/json' },
          });
          const renameUpdate = await this.readApiResponse(renameRes, 'rename invalid-email client before delete');
          if (renameUpdate.result.success) {
            const renamedDeleteRes = await this.request(`/panel/api/clients/del/${encodeURIComponent(safeEmail)}`, {
              method: 'POST',
            });
            ({ result } = await this.readApiResponse(renamedDeleteRes, 'delete renamed client via clients API'));
          }
        }
      }

      const shouldTryLegacyDelete =
        !result.success &&
        (Boolean(clientIdentifier) ||
          status === 404 ||
          clientEmailNeedsRename(clientEmail) ||
          isInvalidClientEmailMessage(result.msg));

      if (shouldTryLegacyDelete) {
        const legacyId = encodeURIComponent(clientIdentifier || clientEmail);
        const nextRes = await this.request(`/panel/api/inbounds/${inboundId}/delClient/${legacyId}`, {
          method: 'POST',
        });
        ({ result } = await this.readApiResponse(nextRes, 'delete client via legacy inbound API'));
      }
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
      const res = await this.request(`/panel/api/clients/traffic/${encoded}`);
      const clientsTraffic = await this.readApiResponse(res, 'get client traffic via clients API');
      let result = clientsTraffic.result;
      const status = clientsTraffic.status;
      if (!result.success && status === 404) {
        const nextRes = await this.request(`/panel/api/inbounds/getClientTraffics/${encoded}`);
        ({ result } = await this.readApiResponse(nextRes, 'get client traffic via legacy inbound API'));
      }
      return result.success ? (result.obj as ClientStats) : null;
    } catch (error: unknown) {
      log.error('Error getting client stats', { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  // ---- Find client by email across all inbounds ----
  async findClient(clientEmail: string): Promise<{
    inboundId: number;
    protocol: string;
    clientId?: string;
    clientPassword?: string;
  } | null> {
    if (!this.loggedIn && !(await this.login())) return null;

    try {
      const encoded = encodeURIComponent(clientEmail);
      const res = await this.request(`/panel/api/clients/get/${encoded}`);
      const { result } = await this.readApiResponse(res, 'get client via clients API');
      const obj = result.obj as { client?: Record<string, unknown>; inboundIds?: number[] } | undefined;
      const client = obj?.client;
      const inboundId = Array.isArray(obj?.inboundIds) ? Number(obj?.inboundIds[0]) : 0;
      if (result.success && client && inboundId) {
        const inbounds = await this.getInbounds();
        const inbound = inbounds.find((ib) => Number(ib.id) === inboundId);
        return {
          inboundId,
          protocol: String(inbound?.protocol || ''),
          clientId: String(client.uuid || client.id || ''),
          clientPassword: String(client.password || ''),
        };
      }
    } catch {
      // Fall back to inbound-scoped parsing below.
    }

    const inbounds = await this.getInbounds();
    for (const ib of inbounds) {
      try {
        const settings = JSON.parse(ib.settings || '{}');
        const clients = settings.clients || [];
        for (const client of clients) {
          if (client.email === clientEmail) {
            return {
              inboundId: ib.id,
              protocol: ib.protocol,
              clientId: String(client.uuid || client.id || ''),
              clientPassword: String(client.password || ''),
            };
          }
        }
      } catch { /* skip parse errors */ }
    }
    return null;
  }

  // ---- Get full client settings by email ----
  async getClientFull(clientEmail: string): Promise<{
    inboundId: number;
    protocol: string;
    client: Record<string, unknown>;
  } | null> {
    if (!this.loggedIn && !(await this.login())) return null;

    try {
      const encoded = encodeURIComponent(clientEmail);
      const res = await this.request(`/panel/api/clients/get/${encoded}`);
      const { result } = await this.readApiResponse(res, 'get full client via clients API');
      const obj = result.obj as { client?: Record<string, unknown>; inboundIds?: number[] } | undefined;
      const client = obj?.client;
      const inboundId = Array.isArray(obj?.inboundIds) ? Number(obj?.inboundIds[0]) : 0;
      if (result.success && client && inboundId) {
        const inbounds = await this.getInbounds();
        const inbound = inbounds.find((ib) => Number(ib.id) === inboundId);
        return { inboundId, protocol: String(inbound?.protocol || ''), client };
      }
    } catch {
      // Fall back to inbound-scoped parsing below.
    }

    const inbounds = await this.getInbounds();
    for (const ib of inbounds) {
      try {
        const settings = JSON.parse(ib.settings || '{}');
        const clients = settings.clients || [];
        for (const client of clients) {
          if (client.email === clientEmail) {
            return { inboundId: ib.id, protocol: ib.protocol, client };
          }
        }
      } catch { /* skip parse errors */ }
    }
    return null;
  }

  // ---- Update client on 3x-UI panel ----
  async updateClient(
    inboundId: number,
    clientUUID: string,
    updatedClient: Record<string, unknown>
  ): Promise<boolean> {
    if (!this.loggedIn && !(await this.login())) return false;

    try {
      const email = String(updatedClient.email || '');
      if (!email) {
        log.error('Cannot update client without email', { clientUUID });
        return false;
      }

      const payload = toClientsApiPayload(updatedClient);
      let legacyPayload = payload;
      const res = await this.request(`/panel/api/clients/update/${encodeURIComponent(email)}`, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      });
      const clientsUpdate = await this.readApiResponse(res, 'update client via clients API');
      let result = clientsUpdate.result;
      const status = clientsUpdate.status;

      if (result.success) return true;

      if (isInvalidClientEmailMessage(result.msg) || clientEmailNeedsRename(email)) {
        const safeEmail = buildSafeClientEmail(payload);
        if (safeEmail && safeEmail !== email) {
          const renamedPayload = toClientsApiPayload({ ...payload, email: safeEmail });
          legacyPayload = renamedPayload;
          const renameRes = await this.request(`/panel/api/clients/update/${encodeURIComponent(email)}`, {
            method: 'POST',
            body: JSON.stringify(renamedPayload),
            headers: { 'Content-Type': 'application/json' },
          });
          const renameUpdate = await this.readApiResponse(renameRes, 'update invalid-email client via clients API');
          if (renameUpdate.result.success) {
            log.info('Renamed legacy 3x-ui client email during update', {
              server: this.server.id,
              oldEmail: email,
              newEmail: safeEmail,
            });
            return true;
          }
          result = renameUpdate.result;
        }
      }

      const body = new URLSearchParams({
        id: String(inboundId),
        settings: JSON.stringify({ clients: [legacyPayload] }),
      });

      const legacyId = String(payload.id || clientUUID);
      const nextRes = await this.request(`/panel/api/inbounds/updateClient/${encodeURIComponent(legacyId)}`, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      ({ result } = await this.readApiResponse(nextRes, 'update client via legacy inbound API'));
      if (!result.success) {
        log.error('Failed to update client', { msg: result.msg, clientUUID, clientsApiStatus: status });
      }
      return result.success;
    } catch (error: unknown) {
      log.error('Error updating client', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  // ---- List all clients across all inbounds ----
  async listAllClients(): Promise<{
    email: string;
    protocol: string;
    enable: boolean;
    expiryTime: number;
    limitIp: number;
    totalGB: number;
    up: number;
    down: number;
    tgId: string;
    subId: string;
    clientId: string;
    clientPassword: string;
  }[]> {
    const inbounds = await this.getInbounds();
    const inboundById = new Map(inbounds.map((ib) => [Number(ib.id), ib]));
    const clients: {
      email: string;
      protocol: string;
      enable: boolean;
      expiryTime: number;
      limitIp: number;
      totalGB: number;
      up: number;
      down: number;
      tgId: string;
      subId: string;
      clientId: string;
      clientPassword: string;
    }[] = [];

    try {
      const res = await this.request('/panel/api/clients/list');
      const { result } = await this.readApiResponse(res, 'list clients via clients API');
      const rows = result.success && Array.isArray(result.obj)
        ? result.obj as Record<string, unknown>[]
        : [];

      if (rows.length > 0) {
        for (const row of rows) {
          const inboundIds = Array.isArray(row.inboundIds)
            ? row.inboundIds.map((value) => Number(value)).filter(Boolean)
            : [];
          const mappedInboundIds = inboundIds.length > 0 ? inboundIds : [0];
          const traffic = row.traffic as Record<string, unknown> | undefined;

          for (const inboundId of mappedInboundIds) {
            const inbound = inboundById.get(inboundId);
            clients.push({
              email: String(row.email || ''),
              protocol: String(inbound?.protocol || ''),
              enable: row.enable !== false,
              expiryTime: parseExpiryNumber(row.expiryTime ?? traffic?.expiryTime),
              limitIp: Number(row.limitIp || 0),
              totalGB: Number(row.totalGB || traffic?.total || 0),
              up: Number(traffic?.up || 0),
              down: Number(traffic?.down || 0),
              tgId: String(row.tgId || ''),
              subId: String(row.subId || ''),
              clientId: String(row.uuid || (typeof row.id === 'string' ? row.id : '') || ''),
              clientPassword: String(row.password || ''),
            });
          }
        }

        return clients;
      }
    } catch {
      // Fall back to inbound-scoped parsing below.
    }

    for (const ib of inbounds) {
      try {
        const settings = JSON.parse(ib.settings || '{}');
        const ibClients = settings.clients || [];
        for (const c of ibClients) {
          // Get traffic stats from clientStats array if available
          const stats = Array.isArray(ib.clientStats)
            ? ib.clientStats.find((s: Record<string, unknown>) => s.email === c.email)
            : null;
          clients.push({
            email: c.email || '',
            protocol: ib.protocol,
            enable: c.enable !== false,
            expiryTime: parseExpiryNumber(c.expiryTime),
            limitIp: c.limitIp || 0,
            totalGB: c.totalGB || 0,
            up: (stats?.up as number) || 0,
            down: (stats?.down as number) || 0,
            tgId: c.tgId || '',
            subId: c.subId || '',
            clientId: c.uuid ? String(c.uuid) : c.id ? String(c.id) : '',
            clientPassword: c.password ? String(c.password) : '',
          });
        }
      } catch { /* skip parse errors */ }
    }
    return clients;
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

  if (protocol === 'trojan') {
    return { ...base, password: clientUUID };
  }
  if (protocol === 'shadowsocks') {
    return { ...base, password: clientUUID, method: 'chacha20-ietf-poly1305' };
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
export interface XuiClientInfo {
  email: string;
  protocol: string;
  enable: boolean;
  expiryTime: number;
  limitIp: number;
  totalGB: number;
  up: number;
  down: number;
  tgId: string;
  subId: string;
  serverId: string;
  serverName: string;
  clientId?: string;
  clientPassword?: string;
}

export async function findClientBySubIdAcrossServers(subId: string, fullUrlHint?: string): Promise<XuiClientInfo | null> {
  const normSubId = subId.toLowerCase().trim();
  const serversMap = await getAllServers();
  const servers = Object.values(serversMap);

  // Highlight priority servers if hint is provided
  if (fullUrlHint) {
    const hint = fullUrlHint.toLowerCase();
    servers.sort((a, b) => {
      const aMatch = hint.includes(a.id.toLowerCase()) || hint.includes(a.domain.toLowerCase()) ? 1 : 0;
      const bMatch = hint.includes(b.id.toLowerCase()) || hint.includes(b.domain.toLowerCase()) ? 1 : 0;
      return bMatch - aMatch;
    });
  }

  for (const server of servers) {
    try {
      const clients = await listServerClients(server.id);
      if (!clients) continue;
      const client = clients.find((c) => {
        const cSubId = (c.subId || '').toLowerCase().trim();
        const cClientId = (c.clientId || '').toLowerCase().trim();
        return cSubId === normSubId || cClientId === normSubId;
      });
      if (client) {
        return {
          ...client,
          serverId: server.id,
          serverName: server.name,
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

interface ParsedConfigLink {
  protocol: string;
  clientId?: string;
  clientPassword?: string;
  host?: string;
  port?: number;
}

function normalizeLookupValue(value?: string): string {
  return (value || '').trim().toLowerCase();
}

function matchesClientIdentity(parsed: ParsedConfigLink, client: {
  clientId?: string;
  clientPassword?: string;
  subId?: string;
}): boolean {
  const parsedIds = [parsed.clientId, parsed.clientPassword]
    .map(normalizeLookupValue)
    .filter(Boolean);

  if (parsedIds.length === 0) {
    return false;
  }

  const clientIds = [client.clientId, client.clientPassword, client.subId]
    .map(normalizeLookupValue)
    .filter(Boolean);

  return parsedIds.some((parsedId) => clientIds.includes(parsedId));
}

function parseVpnConfigLink(input: string): ParsedConfigLink | null {
  const value = input.trim();
  if (!value) return null;

  try {
    if (/^vmess:\/\//i.test(value)) {
      const encoded = value.slice('vmess://'.length).trim();
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);
      return {
        protocol: 'vmess',
        clientId: parsed.id ? String(parsed.id) : undefined,
        host: parsed.add ? String(parsed.add) : undefined,
        port: parsed.port ? Number(parsed.port) : undefined,
      };
    }

    if (/^vless:|^trojan:/i.test(value)) {
      const url = new URL(value);
      return {
        protocol: url.protocol.replace(':', ''),
        clientId: url.username || undefined,
        clientPassword: url.username || url.password || undefined,
        host: url.hostname || undefined,
        port: url.port ? Number(url.port) : undefined,
      };
    }

    if (/^ss:\/\//i.test(value)) {
      let host: string | undefined;
      let password: string | undefined;
      let port: number | undefined;

      try {
        const url = new URL(value);
        host = url.hostname || undefined;
        password = url.password || url.username || undefined;
        port = url.port ? Number(url.port) : undefined;
      } catch {
        const raw = value.slice('ss://'.length);
        const [encoded, hostPart] = raw.split('@');
        try {
          const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
          password = decoded.split(':')[1] || undefined;
        } catch {
          password = undefined;
        }
        if (hostPart) {
          const hostPort = hostPart.split('#')[0].split('?')[0];
          const [hostname, portPart] = hostPort.split(':');
          host = hostname || undefined;
          port = portPart ? Number(portPart) : undefined;
        }
      }

      return {
        protocol: 'shadowsocks',
        clientPassword: password,
        host,
        port,
      };
    }
  } catch {
    // Ignore parse errors and return null below
  }

  return null;
}

export async function findClientByConfigLinkAcrossServers(configLink: string): Promise<XuiClientInfo | null> {
  const parsed = parseVpnConfigLink(configLink);
  if (!parsed) return null;

  // Some 3xUI panels expose the UUID via a different field shape or case.
  // Try the extracted identifiers against both the direct config fields and
  // the subscription/subId fields before giving up.
  const parsedId = normalizeLookupValue(parsed.clientId);
  const parsedPassword = normalizeLookupValue(parsed.clientPassword);

  const serversMap = await getAllServers();
  const servers = Object.values(serversMap);
  const hint = configLink.toLowerCase();

  // Prioritize servers matching domain or id, fallback to others for unknown vmess
  servers.sort((a, b) => {
    const aMatch = hint.includes(a.id.toLowerCase()) || hint.includes(a.domain.toLowerCase()) ? 1 : 0;
    const bMatch = hint.includes(b.id.toLowerCase()) || hint.includes(b.domain.toLowerCase()) ? 1 : 0;
    return bMatch - aMatch;
  });

  for (const server of servers) {
    try {
      const clients = await listServerClients(server.id);
      if (!clients) continue;

      const client = clients.find((c) => {
        if (String(c.protocol).toLowerCase() !== parsed.protocol.toLowerCase()) return false;
        if (matchesClientIdentity(parsed, c)) return true;
        if (parsedId && normalizeLookupValue(c.clientId) === parsedId) return true;
        if (parsedId && normalizeLookupValue(c.subId) === parsedId) return true;
        if (parsedPassword && normalizeLookupValue(c.clientPassword) === parsedPassword) return true;
        return false;
      });

      if (client) {
        return {
          ...client,
          serverId: server.id,
          serverName: server.name,
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

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

  const clientIdentifier = info.protocol === 'trojan' || info.protocol === 'shadowsocks'
    ? info.clientPassword
    : info.clientId;

  return session.deleteClient(info.inboundId, clientEmail, clientIdentifier);
}

/**
 * Update an existing VPN client on the 3xUI panel (e.g. change expiry, devices, data limit).
 * Fetches current client settings, merges with provided updates, and pushes to 3xUI.
 */
export async function updateVpnClient(
  serverId: string,
  clientEmail: string,
  updates: {
    expiryTime?: number;
    devices?: number;
    dataLimitGB?: number;
    enable?: boolean;
  }
): Promise<boolean> {
  const session = await getSession(serverId);
  if (!session) return false;

  const found = await session.getClientFull(clientEmail);
  if (!found) {
    log.warn('Client not found for update', { serverId, clientEmail });
    return false;
  }

  const { inboundId, protocol, client } = found;

  // Determine the client UUID used in the 3x-UI URL path
  // Trojan/SS use "password", vless/vmess use "id"
  const clientUUID = (protocol === 'trojan' || protocol === 'shadowsocks')
    ? String(client.password || '')
    : String(client.uuid || client.id || '');

  if (!clientUUID) {
    log.error('Cannot determine client UUID for update', { clientEmail, protocol });
    return false;
  }

  // Merge updates into existing client settings
  const updatedClient = { ...client };
  if (updates.expiryTime !== undefined) updatedClient.expiryTime = updates.expiryTime;
  if (updates.devices !== undefined) updatedClient.limitIp = updates.devices;
  if (updates.dataLimitGB !== undefined) {
    updatedClient.totalGB = updates.dataLimitGB > 0
      ? Math.floor(updates.dataLimitGB * 1024 * 1024 * 1024)
      : 0;
  }
  if (updates.enable !== undefined) updatedClient.enable = updates.enable;

  const success = await session.updateClient(inboundId, clientUUID, updatedClient);

  if (success) {
    log.info('VPN client updated on panel', { serverId, clientEmail, updates });
  }

  return success;
}

/**
 * Parse expiry time values returned by 3x-UI which may be numeric (ms) or a date string.
 * Returns epoch milliseconds or 0 when unknown/unparseable.
 */
function parseExpiryNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) return asNumber;
  try {
    const parsed = Date.parse(String(value));
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) return parsed;
  } catch {}
  return 0;
}

/**
 * List all clients on a 3x-UI server.
 */
export async function listServerClients(serverId: string) {
  const session = await getSession(serverId);
  if (!session) return null;
  return session.listAllClients();
}

/**
 * Get traffic stats for a VPN client.
 */
export async function getVpnClientStats(serverId: string, clientEmail: string) {
  const session = await getSession(serverId);
  if (!session) return null;
  return session.getClientStats(clientEmail);
}

/**
 * Get the list of actually-enabled protocols from the 3xUI panel.
 * Queries the panel's inbound list and returns only protocols with enable=true.
 */
export async function getEnabledProtocolsFromPanel(serverId: string): Promise<string[] | null> {
  const session = await getSession(serverId);
  if (!session) return null;

  const inbounds = await session.getInbounds();
  if (inbounds.length === 0) return null;

  // Collect unique protocols from enabled inbounds only
  const enabledProtocols = new Set<string>();
  for (const ib of inbounds) {
    if (ib.enable !== false) {
      enabledProtocols.add(ib.protocol);
    }
  }

  return Array.from(enabledProtocols);
}

/**
 * Sync a server's enabledProtocols in DB to match what's actually enabled on the 3xUI panel.
 * Returns the updated list or null on failure.
 */
export async function syncEnabledProtocols(serverId: string): Promise<string[] | null> {
  const panelProtocols = await getEnabledProtocolsFromPanel(serverId);
  if (!panelProtocols) return null;

  try {
    const { default: VpnServerModel } = await import('@/models/VpnServer');
    const { default: connectDB } = await import('@/lib/mongodb');
    await connectDB();
    await VpnServerModel.updateOne(
      { serverId },
      { $set: { enabledProtocols: panelProtocols } }
    );
    // Invalidate cache so next request picks up new protocols
    const { invalidateServerCache } = await import('@/lib/vpn-servers');
    invalidateServerCache();
    log.info('Synced enabledProtocols from panel', { serverId, enabledProtocols: panelProtocols });
    return panelProtocols;
  } catch (error) {
    log.error('Failed to sync enabledProtocols', {
      serverId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Verify protocol ports configured in DB match actual 3xUI inbound ports.
 * Returns mismatches or null if all ports match / no inbounds found.
 */
export async function verifyProtocolPorts(serverId: string): Promise<{
  matches: { protocol: string; port: number }[];
  mismatches: { protocol: string; configuredPort: number; actualPort: number }[];
  unconfigured: { protocol: string; actualPort: number }[];
} | null> {
  const session = await getSession(serverId);
  if (!session) return null;

  const server = await getServer(serverId);
  if (!server) return null;

  const inbounds = await session.getInbounds();
  if (inbounds.length === 0) return null;

  const matches: { protocol: string; port: number }[] = [];
  const mismatches: { protocol: string; configuredPort: number; actualPort: number }[] = [];
  const unconfigured: { protocol: string; actualPort: number }[] = [];

  for (const ib of inbounds) {
    const proto = ib.protocol;
    const actualPort = ib.port;
    const configuredPort = server.protocolPorts?.[proto as keyof typeof server.protocolPorts];

    if (!configuredPort) {
      unconfigured.push({ protocol: proto, actualPort });
    } else if (configuredPort === actualPort) {
      matches.push({ protocol: proto, port: actualPort });
    } else {
      mismatches.push({ protocol: proto, configuredPort, actualPort });
    }
  }

  return { matches, mismatches, unconfigured };
}
