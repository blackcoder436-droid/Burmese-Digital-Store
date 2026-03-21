export function normalizeImageSrc(image?: string | null): string | undefined {
  if (!image) return undefined;

  const decoded = image
    .replace(/&#x2f;|&#47;/gi, '/')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&#39;/gi, "'");

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
