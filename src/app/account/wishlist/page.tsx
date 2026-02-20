'use client';

// ==========================================
// Wishlist Page — /account/wishlist
// Phase 10.4 — Wishlist / Favorites System
// ==========================================

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Heart,
  Loader2,
  Trash2,
  ShoppingCart,
  ShoppingBag,
  Package,
} from 'lucide-react';
import { useLanguage } from '@/lib/language';
import { useWishlist } from '@/lib/wishlist';
import { useCart } from '@/lib/cart';
import { useScrollFade } from '@/hooks/useScrollFade';
import toast from 'react-hot-toast';

interface WishlistItem {
  _id: string;
  product: {
    _id: string;
    name: string;
    slug?: string;
    description: string;
    price: number;
    category: string;
    stock: number;
    image?: string;
    averageRating?: number;
    reviewCount?: number;
  };
  addedAt: string;
}

export default function WishlistPage() {
  const { tr, t } = useLanguage();
  const { toggleWishlist, refresh } = useWishlist();
  const { addItem, isInCart } = useCart();
  const containerRef = useScrollFade();
  const router = useRouter();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWishlist();
  }, []);

  async function fetchWishlist() {
    setLoading(true);
    try {
      const res = await fetch('/api/wishlist');
      if (!res.ok) {
        if (res.status === 401) router.push('/login?redirect=/account/wishlist');
        return;
      }
      const data = await res.json();
      if (data.success) {
        setItems(data.data.items);
      }
    } catch {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(productId: string) {
    try {
      await toggleWishlist(productId);
      setItems((prev) => prev.filter((item) => item.product._id !== productId));
      toast.success(tr('Removed from wishlist', 'Wishlist မှ ဖယ်ရှားပြီး'));
    } catch {
      toast.error(tr('Failed to remove', 'ဖယ်ရှား၍ မရပါ'));
    }
  }

  function handleAddToCart(product: WishlistItem['product']) {
    if (product.stock <= 0) return;
    addItem({
      productId: product._id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      stock: product.stock,
      category: product.category,
      image: product.image,
    }, 1);
    toast.success(`${product.name} ${tr('added to cart', 'ခြင်းတောင်းထဲ ထည့်ပြီး')}`);
  }

  const categoryLabel: Record<string, string> = {
    vpn: 'VPN', streaming: 'Streaming', gaming: 'Gaming',
    software: 'Software', 'gift-card': 'Gift Card', other: tr('Other', 'အခြား'),
  };

  return (
    <div className="min-h-screen pt-8 pb-12 relative z-[1]" ref={containerRef}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="scroll-fade mb-8">
          <Link
            href="/account"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-purple-400 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('nav.myAccount')}
          </Link>
          <h1 className="heading-lg flex items-center gap-3">
            <Heart className="w-7 h-7 text-pink-400" />
            {tr('My Wishlist', 'ကျွန်ုပ်၏ Wishlist')}
            {items.length > 0 && (
              <span className="text-base font-normal text-gray-500">({items.length})</span>
            )}
          </h1>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && items.length === 0 && (
          <div className="text-center py-20 scroll-fade">
            <div className="w-20 h-20 mx-auto mb-5 bg-dark-800 border border-dark-600 rounded-2xl flex items-center justify-center">
              <Heart className="w-10 h-10 text-gray-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-400 mb-2">
              {tr('Your wishlist is empty', 'Wishlist ထဲ ဘာမှ မရှိသေးပါ')}
            </h2>
            <p className="text-gray-600 text-sm mb-6">
              {tr(
                'Browse our shop and add products you love!',
                'ဆိုင်ထဲ ကြည့်ပြီး ကြိုက်တဲ့ ပစ္စည်းတွေ ထည့်လိုက်ပါ!'
              )}
            </p>
            <Link href="/shop" className="btn-primary inline-flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              {tr('Browse Shop', 'ဆိုင်ကြည့်မယ်')}
            </Link>
          </div>
        )}

        {/* Wishlist items grid */}
        {!loading && items.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {items.map((item) => (
              <div
                key={item._id}
                className="game-card overflow-hidden group relative"
              >
                <div className="flex gap-4 p-4">
                  {/* Product image */}
                  <Link
                    href={`/shop/${item.product.slug || item.product._id}`}
                    className="flex-shrink-0"
                  >
                    {item.product.image && item.product.image !== '/images/default-product.png' ? (
                      <div className="relative w-24 h-24 rounded-xl overflow-hidden">
                        <Image
                          src={item.product.image}
                          alt={item.product.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="96px"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="w-24 h-24 rounded-xl bg-dark-700 flex items-center justify-center">
                        <Package className="w-8 h-8 text-gray-600" />
                      </div>
                    )}
                  </Link>

                  {/* Product info */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/shop/${item.product.slug || item.product._id}`}
                      className="block"
                    >
                      <h3 className="text-sm font-bold text-white truncate group-hover:text-purple-300 transition-colors">
                        {item.product.name}
                      </h3>
                    </Link>
                    <span className="text-xs text-gray-500">
                      {categoryLabel[item.product.category] || item.product.category}
                    </span>
                    <div className="mt-1">
                      <span className="text-lg font-black text-purple-400">
                        {item.product.price.toLocaleString()}
                      </span>
                      <span className="text-xs text-gray-500 ml-1">MMK</span>
                    </div>
                    <span className={`text-xs font-semibold ${item.product.stock > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {item.product.stock > 0
                        ? `${item.product.stock} ${tr('in stock', 'လက်ကျန်')}`
                        : tr('Out of stock', 'ကုန်သွားပြီ')}
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 px-4 pb-4">
                  {item.product.stock > 0 && (
                    <button
                      onClick={() => handleAddToCart(item.product)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-all ${
                        isInCart(item.product._id)
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                          : 'bg-purple-500/15 text-purple-400 border border-purple-500/25 hover:bg-purple-500/25'
                      }`}
                    >
                      <ShoppingCart className="w-4 h-4" />
                      {isInCart(item.product._id)
                        ? tr('In Cart', 'ခြင်းတောင်းထဲရှိ')
                        : tr('Add to Cart', 'ခြင်းတောင်းထဲ ထည့်မယ်')}
                    </button>
                  )}
                  <button
                    onClick={() => handleRemove(item.product._id)}
                    className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-semibold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    {tr('Remove', 'ဖယ်ရှား')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
