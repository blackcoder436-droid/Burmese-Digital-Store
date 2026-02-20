'use client';

// ==========================================
// Recently Viewed Products
// Phase 10.9 — Quick UX Improvements
// localStorage-based tracking + display
// ==========================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Clock, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/lib/language';

const STORAGE_KEY = 'recently-viewed';
const MAX_ITEMS = 8;

interface RecentProduct {
  id: string;
  name: string;
  price: number;
  image?: string;
  category: string;
  viewedAt: number;
}

/**
 * Track a product view in localStorage
 */
export function trackProductView(product: {
  _id: string;
  name: string;
  price: number;
  image?: string;
  category: string;
}) {
  if (typeof window === 'undefined') return;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const items: RecentProduct[] = stored ? JSON.parse(stored) : [];

    // Remove if already exists (will re-add at front)
    const filtered = items.filter((item) => item.id !== product._id);

    // Add to front
    filtered.unshift({
      id: product._id,
      name: product.name,
      price: product.price,
      image: product.image,
      category: product.category,
      viewedAt: Date.now(),
    });

    // Keep only MAX_ITEMS
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.slice(0, MAX_ITEMS)));
  } catch {
    // localStorage unavailable — ignore
  }
}

/**
 * Get recently viewed products from localStorage
 */
function getRecentlyViewed(excludeId?: string): RecentProduct[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const items: RecentProduct[] = JSON.parse(stored);
    return excludeId ? items.filter((item) => item.id !== excludeId) : items;
  } catch {
    return [];
  }
}

interface RecentlyViewedProps {
  /** Exclude this product ID from the list (e.g., current product page) */
  excludeId?: string;
  /** Max items to display */
  maxDisplay?: number;
}

export function RecentlyViewed({ excludeId, maxDisplay = 6 }: RecentlyViewedProps) {
  const { tr } = useLanguage();
  const [items, setItems] = useState<RecentProduct[]>([]);

  useEffect(() => {
    setItems(getRecentlyViewed(excludeId).slice(0, maxDisplay));
  }, [excludeId, maxDisplay]);

  if (items.length === 0) return null;

  return (
    <div className="mt-10">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          {tr('Recently Viewed', 'မကြာသေးမီက ကြည့်ခဲ့သော')}
        </h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/shop/${item.id}`}
            className="group bg-dark-800 border border-dark-600 rounded-xl overflow-hidden hover:border-purple-500/30 hover:shadow-glow-sm transition-all"
          >
            {item.image && item.image !== '/images/default-product.png' ? (
              <div className="relative w-full h-24">
                <Image
                  src={item.image}
                  alt={item.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 640px) 50vw, 16vw"
                  unoptimized
                />
              </div>
            ) : (
              <div className="w-full h-24 bg-dark-700 flex items-center justify-center">
                <span className="text-2xl opacity-30">📦</span>
              </div>
            )}
            <div className="p-2.5">
              <p className="text-xs text-white font-medium truncate group-hover:text-purple-300 transition-colors">
                {item.name}
              </p>
              <p className="text-xs text-purple-400 font-bold mt-0.5">
                {item.price.toLocaleString()} MMK
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
