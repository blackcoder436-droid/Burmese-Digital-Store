export function sanitizeClientLabel(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 48);
}

export function clientEmailNeedsRename(value: string): boolean {
  const trimmed = value.trim();
  return !trimmed || trimmed !== value || !/^[A-Za-z0-9._-]+$/.test(trimmed);
}

function getClientUniqueSuffix(client: Record<string, unknown>): string {
  return sanitizeClientLabel(String(client.uuid || client.id || client.password || client.subId || 'client')).slice(0, 8);
}

export function buildSafeClientEmail(client: Record<string, unknown>): string {
  const current = String(client.email || '').trim();
  const suffix = getClientUniqueSuffix(client);
  const base = sanitizeClientLabel(current) || 'client';

  if (!suffix) return base;
  if (base.endsWith(`-${suffix}`)) return base;

  const maxBaseLength = Math.max(1, 48 - suffix.length - 1);
  return `${base.slice(0, maxBaseLength).replace(/[._-]+$/g, '')}-${suffix}`;
}

export function isInvalidClientEmailMessage(message?: string): boolean {
  return /client email contains an invalid character|invalid.*email/i.test(message || '');
}

export function toClientsApiPayload(client: Record<string, unknown>): Record<string, unknown> {
  const payload = { ...client };
  const uuid = String(payload.uuid ?? '').trim();
  const id = payload.id;

  // 3x-ui v3.2+ returns first-class client rows as { id: number, uuid: string }.
  // The update API still binds to model.Client where json "id" is the Xray UUID string.
  if (uuid && typeof id !== 'string') {
    payload.id = uuid;
  } else if (id !== undefined && typeof id !== 'string') {
    delete payload.id;
  }

  const tgId = String(payload.tgId ?? '').trim();
  payload.tgId = /^\d+$/.test(tgId) ? Number(tgId) : 0;
  return payload;
}
