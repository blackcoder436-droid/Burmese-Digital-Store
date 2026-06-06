type KeyRecordLike = Record<string, unknown> & {
  username?: unknown;
  devices?: unknown;
  keyType?: unknown;
  clientEmail?: unknown;
  migratedFromClientEmail?: unknown;
  vpnKey?: { clientEmail?: unknown } | null;
};

type ServerLike = {
  id?: unknown;
  name?: unknown;
};

type ResolvedClientLike = {
  email?: unknown;
  serverName?: unknown;
};

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function sanitizeClientLabel(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 48);
}

function normalizeComparable(value: string): string {
  return value.trim().toLowerCase();
}

function getDeviceLabel(record: KeyRecordLike): string {
  const devices = Number(record.devices);
  return `${Number.isFinite(devices) && devices > 0 ? Math.trunc(devices) : 1}D`;
}

function stripGeneratedKeySuffix(email: string): string {
  return email.trim().replace(/-Key\d+$/i, '');
}

function addCandidate(candidates: Set<string>, value: string) {
  const cleaned = value.trim();
  if (cleaned) candidates.add(cleaned);
}

function addClientNameCandidate(candidates: Set<string>, baseName: string, deviceLabel: string) {
  const cleaned = baseName.trim();
  if (!cleaned) return;

  addCandidate(candidates, cleaned);

  const comparable = normalizeComparable(cleaned);
  if (!comparable.endsWith(`-${deviceLabel.toLowerCase()}`)) {
    addCandidate(candidates, `${cleaned}-${deviceLabel}`);
  }

  if (!comparable.endsWith(` - ${deviceLabel.toLowerCase()}`)) {
    addCandidate(candidates, `${cleaned} - ${deviceLabel}`);
  }
}

function serverNameTokens(serverName: string): string[] {
  const raw = serverName.trim();
  const safe = sanitizeClientLabel(raw);
  const dashed = sanitizeClientLabel(raw.replace(/\s+/g, '-'));
  return Array.from(new Set([safe, dashed].filter(Boolean)));
}

function identityTokens(record: KeyRecordLike): string[] {
  const rawValues = [
    asText(record.username),
    asText(record.clientEmail),
    asText(record.migratedFromClientEmail),
    asText(record.vpnKey?.clientEmail),
  ];

  const tokens = new Set<string>();
  for (const raw of rawValues) {
    if (!raw) continue;
    const safe = sanitizeClientLabel(raw);
    if (safe) {
      tokens.add(safe);
      if (safe.length > 20) tokens.add(safe.slice(0, 20).replace(/[._-]+$/g, ''));
    }
  }
  return Array.from(tokens).filter((token) => token.length >= 6);
}

function addSiblingCandidates(
  candidates: Set<string>,
  resolvedClients: ResolvedClientLike[],
  server: ServerLike,
  deviceLabel: string
) {
  const targetTokens = serverNameTokens(asText(server.name));
  if (targetTokens.length === 0) return;

  for (const resolved of resolvedClients) {
    const email = asText(resolved.email);
    if (!email) continue;

    const baseEmail = stripGeneratedKeySuffix(email);
    addCandidate(candidates, baseEmail);

    const sourceTokens = serverNameTokens(asText(resolved.serverName));
    for (const sourceToken of sourceTokens) {
      for (const targetToken of targetTokens) {
        const suffixes = [
          `_${sourceToken}-${deviceLabel}`,
          `-${sourceToken}-${deviceLabel}`,
        ];

        for (const suffix of suffixes) {
          if (normalizeComparable(baseEmail).endsWith(normalizeComparable(suffix))) {
            const prefix = baseEmail.slice(0, baseEmail.length - suffix.length);
            addCandidate(candidates, `${prefix}${suffix[0]}${targetToken}-${deviceLabel}`);
          }
        }

        const deviceSuffixPattern = new RegExp(`([_-])${sourceToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d+D$`, 'i');
        const match = baseEmail.match(deviceSuffixPattern);
        if (match) {
          const separator = match[1] || '_';
          const prefix = baseEmail.slice(0, match.index);
          addCandidate(candidates, `${prefix}${separator}${targetToken}-${deviceLabel}`);
        }
      }
    }
  }
}

export function buildMultiServerClientEmailCandidates(
  record: KeyRecordLike,
  server: ServerLike,
  resolvedClients: ResolvedClientLike[] = []
): string[] {
  const candidates = new Set<string>();
  const deviceLabel = getDeviceLabel(record);

  for (const token of identityTokens(record)) {
    addClientNameCandidate(candidates, token, deviceLabel);
  }

  addSiblingCandidates(candidates, resolvedClients, server, deviceLabel);

  return Array.from(candidates);
}

function candidateMatchesEmail(email: string, candidate: string): boolean {
  const normalizedEmail = normalizeComparable(email);
  const normalizedCandidate = normalizeComparable(candidate);
  return normalizedEmail === normalizedCandidate || normalizedEmail.startsWith(`${normalizedCandidate}-key`);
}

function likelyPrefixedClient(email: string, record: KeyRecordLike, server: ServerLike): boolean {
  const baseEmail = normalizeComparable(stripGeneratedKeySuffix(email));
  const safeBaseEmail = normalizeComparable(sanitizeClientLabel(stripGeneratedKeySuffix(email)));
  const deviceLabel = getDeviceLabel(record).toLowerCase();
  const serverTokens = serverNameTokens(asText(server.name)).map(normalizeComparable).filter(Boolean);
  const recordTokens = identityTokens(record).map(normalizeComparable).filter(Boolean);
  const keyType = normalizeComparable(asText(record.keyType));

  const allowPrefixedHeuristic =
    keyType === 'migrated_web' ||
    keyType === 'free_test' ||
    /^((mig|free|sync|admin|test)_)/i.test(email);

  if (!allowPrefixedHeuristic || serverTokens.length === 0 || recordTokens.length === 0) {
    return false;
  }

  return (
    [baseEmail, safeBaseEmail].some((candidate) =>
      candidate.includes(`-${deviceLabel}`) &&
      serverTokens.some((token) => candidate.includes(token)) &&
      recordTokens.some((token) => candidate.includes(token))
    )
  );
}

export function isMultiServerClientEmailMatch(
  email: string,
  record: KeyRecordLike,
  server: ServerLike,
  resolvedClients: ResolvedClientLike[] = []
): boolean {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) return false;

  const candidates = buildMultiServerClientEmailCandidates(record, server, resolvedClients);
  if (candidates.some((candidate) => candidateMatchesEmail(normalizedEmail, candidate))) {
    return true;
  }

  return likelyPrefixedClient(normalizedEmail, record, server);
}
