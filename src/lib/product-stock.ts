export type ProductFulfillmentMode = 'preloaded' | 'manual';

type ProductStockLike = {
  fulfillmentMode?: ProductFulfillmentMode | string | null;
  stock?: number | null;
  details?: Array<{ sold?: boolean | null }> | null;
};

export function normalizeStockQty(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.floor(numeric));
}

export function getProductFulfillmentMode(product: ProductStockLike): ProductFulfillmentMode {
  const details = Array.isArray(product.details) ? product.details : [];
  if (product.fulfillmentMode === 'manual') return 'manual';
  if (product.fulfillmentMode === 'preloaded') {
    return details.length === 0 && normalizeStockQty(product.stock) > 0 ? 'manual' : 'preloaded';
  }

  return details.length > 0 ? 'preloaded' : 'manual';
}

export function getAvailableProductStock(product: ProductStockLike): number {
  const mode = getProductFulfillmentMode(product);
  if (mode === 'preloaded') {
    const details = Array.isArray(product.details) ? product.details : [];
    return details.filter((detail) => !detail.sold).length;
  }

  return normalizeStockQty(product.stock);
}

export function getStockForSave(
  fulfillmentMode: ProductFulfillmentMode,
  details: Array<{ sold?: boolean | null }> | null | undefined,
  stock: unknown
): number {
  if (fulfillmentMode === 'preloaded') {
    return (Array.isArray(details) ? details : []).filter((detail) => !detail.sold).length;
  }

  return normalizeStockQty(stock);
}
