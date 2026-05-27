function getPublicAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://burmesedigital.store';
}

export function getCustomerVpnSubLink(
  multiSubToken?: string,
  fallbackSubLink?: string
): string {
  if (multiSubToken) {
    return `${getPublicAppUrl()}/api/vpn/sub/${multiSubToken}`;
  }
  return fallbackSubLink || '';
}

export function sanitizeCustomerOrder<T extends Record<string, unknown>>(order: T): T {
  const safeOrder: Record<string, unknown> = { ...order };
  const multiSubToken = typeof safeOrder.multiSubToken === 'string' ? safeOrder.multiSubToken : undefined;
  const vpnKey = safeOrder.vpnKey;

  if (vpnKey && typeof vpnKey === 'object') {
    const key = vpnKey as Record<string, unknown>;
    safeOrder.vpnKey = {
      clientEmail: key.clientEmail,
      subLink: getCustomerVpnSubLink(
        multiSubToken,
        typeof key.subLink === 'string' ? key.subLink : undefined
      ),
      protocol: key.protocol,
      expiryTime: key.expiryTime,
      provisionedAt: key.provisionedAt,
    };
  }

  delete safeOrder.vpnKeys;
  return safeOrder as T;
}
