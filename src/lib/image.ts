export function normalizeImageSrc(image?: string | null): string | undefined {
  if (!image) return undefined;

  // Decode entities in two passes to handle values like "&amp;#x2F;uploads..."
  // where the first pass turns it into "&#x2F;uploads..." and the second into "/uploads...".
  let decoded = image;
  for (let i = 0; i < 2; i++) {
    decoded = decoded
      .replace(/&amp;/gi, '&')
      .replace(/&#x2f;|&#47;/gi, '/')
      .replace(/&quot;/gi, '"')
      .replace(/&#x27;|&#39;/gi, "'");
  }

  const trimmed = decoded.trim();
  if (!trimmed) return undefined;

  if (
    /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  const withForwardSlashes = trimmed.replace(/\\/g, '/');
  const withoutPublicPrefix = withForwardSlashes.replace(/^\.?\/?public\//i, '/');

  return withoutPublicPrefix.startsWith('/')
    ? withoutPublicPrefix
    : `/${withoutPublicPrefix}`;
}

export function hasCustomProductImage(image?: string | null): boolean {
  const normalized = normalizeImageSrc(image);
  return !!normalized && normalized !== '/images/default-product.png';
}

export function appendImageVersion(image?: string | null, version = '2'): string | undefined {
  const normalized = normalizeImageSrc(image);
  if (!normalized) return undefined;

  try {
    const url = new URL(normalized, 'http://localhost');
    url.searchParams.set('v', version);
    return normalized.startsWith('http') ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return normalized;
  }
}
