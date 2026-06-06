'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ShoppingBag, Shield, Tv, Gamepad2, MonitorSmartphone, Gift, Box, Star, Heart, Share2, MessageSquare } from 'lucide-react';
import { useLanguage } from '@/lib/language';
import { useWishlist } from '@/lib/wishlist';
import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { hasCustomProductImage, normalizeImageSrc } from '@/lib/image';

interface Product {
  _id: string;
  name: string;
  slug?: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  image?: string;
  purchaseDisabled?: boolean;
  averageRating?: number;
  reviewCount?: number;
}

export default function ProductCard({ product }: { product: Product }) {
  const { t, lang, tr } = useLanguage();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const inStock = product.stock > 0;
  const normalizedImage = normalizeImageSrc(product.image);
  const hasImage = hasCustomProductImage(product.image);
  const liked = isWishlisted(product._id);
  const [showShare, setShowShare] = useState(false);
  const [imageAspect, setImageAspect] = useState<'square' | 'landscape'>('landscape');
  const [imageError, setImageError] = useState(false);

  const handleLike = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await toggleWishlist(product._id);
    } catch (err) {
      if ((err as Error).message === 'AUTH_REQUIRED') {
        toast.error(tr('Please log in to use wishlist', 'Wishlist သုံးရန် Login ဝင်ပါ'));
      }
    }
  }, [product._id, toggleWishlist, tr]);

  const handleShare = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/shop/${product.slug || product._id}`;
    if (navigator.share) {
      navigator.share({ title: product.name, url }).catch(() => {});
    } else {
      setShowShare((prev) => !prev);
    }
  }, [product]);

  const shareToSocial = useCallback((platform: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = encodeURIComponent(`${window.location.origin}/shop/${product.slug || product._id}`);
    const text = encodeURIComponent(product.name);
    const links: Record<string, string> = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      twitter: `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
      telegram: `https://t.me/share/url?url=${url}&text=${text}`,
      viber: `viber://forward?text=${text}%20${url}`,
    };
    window.open(links[platform], '_blank', 'noopener,noreferrer,width=600,height=400');
    setShowShare(false);
  }, [product]);

  const categoryLabel: Record<string, string> = {
    vpn: t('nav.vpn'),
    streaming: 'Streaming',
    gaming: 'Gaming',
    software: 'Software',
    'gift-card': 'Gift Card',
    other: t('shop.other'),
  };

  const categoryPillClass: Record<string, string> = {
    vpn: 'bg-emerald-900/80 text-emerald-100 border-emerald-300/40',
    streaming: 'bg-violet-900/80 text-violet-100 border-violet-300/40',
    gaming: 'bg-rose-900/80 text-rose-100 border-rose-300/40',
    software: 'bg-sky-900/80 text-sky-100 border-sky-300/45',
    'gift-card': 'bg-amber-900/80 text-amber-100 border-amber-300/40',
    other: 'bg-slate-800/85 text-slate-100 border-slate-300/35',
  };

  const categoryIcon: Record<string, typeof Shield> = {
    vpn: Shield,
    streaming: Tv,
    gaming: Gamepad2,
    software: MonitorSmartphone,
    'gift-card': Gift,
    other: Box,
  };

  const PlaceholderIcon = categoryIcon[product.category] || ShoppingBag;

  return (
    <Link href={`/shop/${product.slug || product._id}`} className="block group h-full">
      <div className="game-card h-full flex flex-col relative overflow-hidden card-shimmer">
        {/* Hover Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 via-transparent to-cyan-500/0 group-hover:from-purple-500/5 group-hover:to-cyan-500/5 transition-all duration-500" />
        
        {/* Top accent line on hover */}
        <div className="absolute top-0 left-0 w-0 group-hover:w-full h-[2px] bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-500 ease-out" />
        
        {/* Product Image */}
        <div className="relative w-full overflow-hidden bg-dark-900 h-44 sm:h-44 md:h-48 lg:h-52 flex items-center justify-center">
          {hasImage ? (
            <>
              {/* decide whether this image is a logo/icon so we can use object-contain */}
              {(() => {
                const isLogo = !!normalizedImage && /\/(logo-|icon_|Color-logo|logotype|logotype-full|logotype-full-primary|logo-full)/i.test(normalizedImage);
                const preferContain = isLogo || imageAspect === 'square';
                const imgSrc = imageError ? '/uploads/gh-pack/logo-full-dark.png' : `${normalizedImage}?v=2`;
                const imgClass = `${preferContain ? 'object-contain' : 'object-cover'} group-hover:scale-105 transition-transform duration-500`;
                return (
                  <>
                    <Image
                      src={imgSrc}
                      alt={product.name}
                      fill
                      className={imgClass}
                      onLoadingComplete={(img) => {
                        const ratio = img.naturalWidth / Math.max(1, img.naturalHeight);
                        setImageAspect(ratio >= 0.9 && ratio <= 1.1 ? 'square' : 'landscape');
                      }}
                      onError={() => setImageError(true)}
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-dark-900/80" />
                  </>
                );
              })()}
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-dark-800 to-cyan-500/20" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <div className="w-14 h-14 rounded-2xl bg-dark-900/60 border border-purple-500/25 flex items-center justify-center">
                  <PlaceholderIcon className="w-8 h-8 text-purple-300" />
                </div>
                <p className="text-[11px] font-semibold text-gray-300 tracking-wide uppercase">
                  {categoryLabel[product.category] || product.category}
                </p>
              </div>
            </>
          )}
          {/* Category badge overlaid on image */}
          <div className="absolute top-3 left-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wide border backdrop-blur-md shadow-md ring-1 ring-black/35 ${categoryPillClass[product.category] || categoryPillClass.other}`}>
              {categoryLabel[product.category] || product.category}
            </span>
          </div>
          <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
            <span className={`text-xs font-bold px-2 py-1 rounded-lg border backdrop-blur-md shadow-md ${inStock ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
              {inStock ? (lang === 'my' ? `လက်ကျန် ${product.stock}` : `${product.stock} in stock`) : t('shop.outOfStock')}
            </span>
            {product.purchaseDisabled && (
              <span className="text-xs font-bold px-2 py-1 rounded-lg border backdrop-blur-md shadow-md bg-orange-500/20 text-orange-400 border-orange-500/30">
                {t('shop.viewOnly')}
              </span>
            )}
          </div>
        </div>

        <div className="p-5 flex flex-col flex-1">
        {/* Name + Price */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 mb-1">
          <h3 className="min-w-0 text-base font-bold text-white group-hover:text-purple-300 transition-colors duration-300 leading-snug line-clamp-2 relative">
            {product.name}
          </h3>
          <div className="shrink-0 text-right leading-none pt-0.5">
            <span className="text-lg font-black text-purple-400 whitespace-nowrap">
              {product.price.toLocaleString()}
            </span>
            <span className="ml-1 text-xs text-gray-500 font-medium">MMK</span>
          </div>
        </div>

        {/* Rating — always visible */}
        <div className="flex items-center gap-1.5 mb-2">
          <div className="flex items-center">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`w-3 h-3 ${(product.reviewCount ?? 0) > 0 && s <= Math.round(product.averageRating || 0) ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-gray-600'}`}
              />
            ))}
          </div>
          <span className="text-[10px] text-gray-500">({product.reviewCount ?? 0})</span>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-500 mb-5 line-clamp-2 flex-1 leading-relaxed relative whitespace-pre-line">
          {product.description}
        </p>

        {/* Actions: like, comment, share (left) | view details (right) */}
        <div className="flex items-center justify-between gap-2 pt-4 border-t border-dark-600/50 relative">
          <div className="flex items-center gap-2">
            {/* Like */}
            <button
              onClick={handleLike}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-dark-800/60 border border-dark-600/40 hover:border-pink-500/40 hover:bg-pink-500/10 transition-all"
              aria-label={liked ? 'Unlike' : 'Like'}
            >
              <Heart className={`w-3.5 h-3.5 transition-colors ${liked ? 'fill-pink-500 text-pink-500' : 'text-gray-500 hover:text-pink-400'}`} />
            </button>
            {/* Comment/Review */}
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-dark-800/60 border border-dark-600/40 text-gray-400 text-xs font-semibold" aria-label={`${product.reviewCount ?? 0} reviews`}>
              <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
              {(product.reviewCount ?? 0) > 0 ? product.reviewCount : ''}
            </div>
            {/* Share */}
            <div className="relative z-30">
              <button
                onClick={handleShare}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-dark-800/60 border border-dark-600/40 hover:border-purple-500/40 hover:bg-purple-500/10 transition-all"
                aria-label="Share"
              >
                <Share2 className="w-3.5 h-3.5 text-gray-500 hover:text-purple-400 transition-colors" />
              </button>
              {showShare && (
                <div className="absolute left-0 top-full mt-2 flex items-center gap-1 p-1.5 bg-dark-900 border border-dark-600/60 rounded-lg shadow-xl z-50 animate-in fade-in slide-in-from-top-2">
                  {([
                    { key: 'facebook', label: 'f', color: 'hover:bg-blue-500/20 hover:text-blue-400' },
                    { key: 'twitter', label: '𝕏', color: 'hover:bg-gray-500/20 hover:text-white' },
                    { key: 'telegram', label: '✈', color: 'hover:bg-sky-500/20 hover:text-sky-400' },
                    { key: 'viber', label: 'V', color: 'hover:bg-purple-500/20 hover:text-purple-400' },
                  ]).map((s) => (
                    <button
                      key={s.key}
                      onClick={(e) => shareToSocial(s.key, e)}
                      className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-gray-400 transition-all ${s.color}`}
                      aria-label={`Share on ${s.key}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* View Details */}
          <div className={`min-w-0 max-w-[46%] flex items-center gap-1.5 text-xs sm:text-sm font-bold px-2.5 py-1.5 rounded-lg border ${inStock ? 'text-white border-purple-500/30 bg-purple-500/10' : 'text-gray-500 border-dark-600/50 bg-dark-800/40'}`}>
            {inStock ? (
              <>
                <ShoppingBag className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="truncate leading-tight">{t('shop.viewDetails')}</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-4 h-4 shrink-0" />
                <span className="truncate leading-tight">{t('shop.unavailable')}</span>
              </>
            )}
          </div>
        </div>
        </div>
      </div>
    </Link>
  );
}
