// ==========================================
// VPN Server Configuration - Burmese Digital Store
// ==========================================
// DB-backed server config with in-memory cache

import dbConnect from '@/lib/mongodb';
import VpnServerModel, { type IVpnServerDocument } from '@/models/VpnServer';

export interface VpnServer {
  id: string;
  name: string;
  flag: string;
  url: string; // panel base URL (e.g. https://jan.burmesedigital.store:8080)
  panelPath: string; // e.g. /mka
  domain: string;
  subPort: number;
  trojanPort?: number; // custom trojan port (if different from inbound port)
  protocol: string;
  enabledProtocols: string[]; // available protocols for this server
  online: boolean;
  enabled: boolean;
}

// ---- Static fallback (used if DB is empty / first boot) ----
const STATIC_SERVERS: Record<string, VpnServer> = {
  sg1: {
    id: 'sg1',
    name: 'Singapore 1',
    flag: '🇸🇬',
    url: 'https://jan.burmesedigital.store:8080',
    panelPath: '/mka',
    domain: 'jan.burmesedigital.store',
    subPort: 2096,
    trojanPort: 22716,
    protocol: 'trojan',
    enabledProtocols: ['trojan', 'vless', 'vmess', 'shadowsocks'],
    online: true,
    enabled: true,
  },
  sg2: {
    id: 'sg2',
    name: 'Singapore 2',
    flag: '🇸🇬',
    url: 'https://sg2.burmesedigital.store:8080',
    panelPath: '/mka',
    domain: 'sg2.burmesedigital.store',
    subPort: 2096,
    protocol: 'trojan',
    enabledProtocols: ['trojan', 'vless', 'vmess', 'shadowsocks'],
    online: true,
    enabled: true,
  },
  sg3: {
    id: 'sg3',
    name: 'Singapore 3',
    flag: '🇸🇬',
    url: 'https://sg3.burmesedigital.store:8080',
    panelPath: '/mka',
    domain: 'sg3.burmesedigital.store',
    subPort: 2096,
    protocol: 'trojan',
    enabledProtocols: ['trojan', 'vless', 'vmess', 'shadowsocks'],
    online: true,
    enabled: true,
  },
  us1: {
    id: 'us1',
    name: 'United States',
    flag: '🇺🇸',
    url: 'https://us.burmesedigital.store:8080',
    panelPath: '/mka',
    domain: 'us.burmesedigital.store',
    subPort: 8080,
    protocol: 'trojan',
    enabledProtocols: ['trojan', 'vless', 'vmess', 'shadowsocks'],
    online: true,
    enabled: true,
  },
};

// ---- In-memory cache (refreshed every 60s) ----
let cacheServers: Record<string, VpnServer> = {};
let cacheTime = 0;
const CACHE_TTL = 60_000; // 60 seconds

function docToServer(doc: IVpnServerDocument): VpnServer {
  return {
    id: doc.serverId,
    name: doc.name,
    flag: doc.flag,
    url: doc.url,
    panelPath: doc.panelPath,
    domain: doc.domain,
    subPort: doc.subPort,
    trojanPort: doc.trojanPort ?? undefined,
    protocol: doc.protocol,
    enabledProtocols: doc.enabledProtocols ?? ['trojan', 'vless', 'vmess', 'shadowsocks'],
    online: doc.online,
    enabled: doc.enabled,
  };
}

/** Refresh cache from DB */
async function refreshCache(): Promise<Record<string, VpnServer>> {
  try {
    await dbConnect();
    const docs = await VpnServerModel.find().lean<IVpnServerDocument[]>();
    if (docs.length === 0) {
      // DB empty — use static fallback
      cacheServers = { ...STATIC_SERVERS };
    } else {
      const map: Record<string, VpnServer> = {};
      for (const doc of docs) {
        map[doc.serverId] = docToServer(doc as unknown as IVpnServerDocument);
      }
      cacheServers = map;
    }
  } catch {
    // On error, keep existing cache or use static
    if (Object.keys(cacheServers).length === 0) {
      cacheServers = { ...STATIC_SERVERS };
    }
  }
  cacheTime = Date.now();
  return cacheServers;
}

/** Get all servers (cached) */
export async function getAllServers(): Promise<Record<string, VpnServer>> {
  if (Date.now() - cacheTime > CACHE_TTL || Object.keys(cacheServers).length === 0) {
    return refreshCache();
  }
  return cacheServers;
}

/** Invalidate cache (call after admin CRUD) */
export function invalidateServerCache(): void {
  cacheTime = 0;
  cacheServers = {};
}

// ---- Convenience helpers (async versions) ----

export async function getServer(serverId: string): Promise<VpnServer | undefined> {
  const servers = await getAllServers();
  return servers[serverId];
}

export async function getOnlineServers(): Promise<VpnServer[]> {
  const servers = await getAllServers();
  return Object.values(servers).filter((s) => s.online && s.enabled);
}

export async function getEnabledServers(): Promise<VpnServer[]> {
  const servers = await getAllServers();
  return Object.values(servers).filter((s) => s.enabled);
}

export async function isValidServerId(serverId: string): Promise<boolean> {
  const servers = await getAllServers();
  return serverId in servers && servers[serverId].enabled;
}

// ---- Legacy sync access (for static fallback during SSR/ISR) ----
// These return cached data synchronously; they should only be used
// after at least one async call has populated the cache.

export function getServerSync(serverId: string): VpnServer | undefined {
  if (Object.keys(cacheServers).length === 0) return STATIC_SERVERS[serverId];
  return cacheServers[serverId];
}

export function getAllServersSync(): Record<string, VpnServer> {
  if (Object.keys(cacheServers).length === 0) return { ...STATIC_SERVERS };
  return cacheServers;
}

