'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ShoppingBag, Shield, Tv, Gamepad2, MonitorSmartphone, Gift, Box } from 'lucide-react';
import { useLanguage } from '@/lib/language';

interface Product {
  _id: string;
  name: string;
  slug?: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  image?: string;
}

export default function ProductCard({ product }: { product: Product }) {
  const { t, lang } = useLanguage();
  const inStock = product.stock > 0;
  const hasImage = !!(product.image && product.image !== '/images/default-product.png');

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
    <Link href={`/shop/${product.slug || product._id}`} className="block group">
      <div className="game-card h-full flex flex-col relative overflow-hidden card-shimmer">
        {/* Hover Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 via-transparent to-cyan-500/0 group-hover:from-purple-500/5 group-hover:to-cyan-500/5 transition-all duration-500" />
        
        {/* Top accent line on hover */}
        <div className="absolute top-0 left-0 w-0 group-hover:w-full h-[2px] bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-500 ease-out" />
        
        {/* Product Image */}
        <div className="relative w-full h-40 overflow-hidden bg-dark-800">
          {hasImage ? (
            <>
              <Image
                src={product.image}
                alt={product.name}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-dark-900/80" />
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
          <div className="absolute top-3 right-3">
            <span className={`text-xs font-bold px-2 py-1 rounded-lg border backdrop-blur-md shadow-md ${inStock ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
              {inStock ? (lang === 'my' ? `လက်ကျန် ${product.stock}` : `${product.stock} in stock`) : t('shop.outOfStock')}
            </span>
          </div>
        </div>

        <div className="p-5 flex flex-col flex-1">
        {/* Name */}
        <h3 className="text-base font-bold text-white mb-2 group-hover:text-purple-300 transition-colors duration-300 line-clamp-1 relative">
          {product.name}
        </h3>

        {/* Description */}
        <p className="text-sm text-gray-500 mb-5 line-clamp-2 flex-1 leading-relaxed relative">
          {product.description}
        </p>

        {/* Price + Action */}
        <div className="flex items-center justify-between pt-4 border-t border-dark-600/50 relative">
          <div>
            <span className="text-xl font-black text-purple-400">
              {product.price.toLocaleString()}
            </span>
            <span className="text-xs text-gray-500 ml-1 font-medium">MMK</span>
          </div>
          <div className={`min-w-0 flex items-center gap-1.5 text-xs sm:text-sm font-bold ${inStock ? 'text-white' : 'text-gray-600'}`}>
            {inStock ? (
              <>
                <ShoppingBag className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="truncate">{t('shop.viewDetails')}</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-4 h-4 shrink-0" />
                <span className="truncate">{t('shop.unavailable')}</span>
              </>
            )}
          </div>
        </div>
        </div>
      </div>
    </Link>
  );
}
