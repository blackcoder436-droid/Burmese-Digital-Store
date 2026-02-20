'use client';

// ==========================================
// Wishlist Hook — Burmese Digital Store
// Phase 10.4 — Client-side wishlist state management
// Fetches user's wishlist IDs and provides add/remove/check
// ==========================================

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface WishlistContextValue {
  /** Set of product IDs in wishlist */
  wishlistIds: Set<string>;
  /** Whether wishlist data has been loaded */
  loaded: boolean;
  /** Check if a product is in wishlist */
  isWishlisted: (productId: string) => boolean;
  /** Toggle wishlist status for a product */
  toggleWishlist: (productId: string) => Promise<void>;
  /** Total wishlist count */
  count: number;
  /** Refresh wishlist from server */
  refresh: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  const fetchWishlist = useCallback(async () => {
    try {
      const res = await fetch('/api/wishlist');
      if (!res.ok) {
        // Not logged in or error — empty wishlist
        setWishlistIds(new Set());
        setLoaded(true);
        return;
      }
      const data = await res.json();
      if (data.success) {
        const ids = new Set<string>(
          data.data.items.map((item: { product: { _id: string } }) => item.product._id)
        );
        setWishlistIds(ids);
      }
    } catch {
      // Silently fail — wishlist is non-critical
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  const isWishlisted = useCallback(
    (productId: string) => wishlistIds.has(productId),
    [wishlistIds]
  );

  const toggleWishlist = useCallback(
    async (productId: string) => {
      const isCurrently = wishlistIds.has(productId);

      // Optimistic update
      setWishlistIds((prev) => {
        const next = new Set(prev);
        if (isCurrently) {
          next.delete(productId);
        } else {
          next.add(productId);
        }
        return next;
      });

      try {
        const res = await fetch('/api/wishlist', {
          method: isCurrently ? 'DELETE' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId }),
        });

        if (!res.ok) {
          // Revert optimistic update
          setWishlistIds((prev) => {
            const reverted = new Set(prev);
            if (isCurrently) {
              reverted.add(productId);
            } else {
              reverted.delete(productId);
            }
            return reverted;
          });

          if (res.status === 401) {
            // User not logged in — throw so caller can handle
            throw new Error('AUTH_REQUIRED');
          }
        }
      } catch (error) {
        if ((error as Error).message === 'AUTH_REQUIRED') {
          throw error;
        }
        // Revert on network error
        setWishlistIds((prev) => {
          const reverted = new Set(prev);
          if (isCurrently) {
            reverted.add(productId);
          } else {
            reverted.delete(productId);
          }
          return reverted;
        });
      }
    },
    [wishlistIds]
  );

  return (
    <WishlistContext.Provider
      value={{
        wishlistIds,
        loaded,
        isWishlisted,
        toggleWishlist,
        count: wishlistIds.size,
        refresh: fetchWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) {
    throw new Error('useWishlist must be used within WishlistProvider');
  }
  return ctx;
}
