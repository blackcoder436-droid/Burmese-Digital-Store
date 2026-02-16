'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ShoppingBag, Zap } from 'lucide-react';
import { useLanguage } from '@/lib/language';

interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  image?: string;
}

const categoryBadge: Record<string, string> = {
  vpn: 'badge-vpn',
  streaming: 'badge-streaming',
  gaming: 'badge-gaming',
  software: 'badge-software',
  'gift-card': 'badge-gift-card',
  other: 'badge-other',
};

const categoryLabel: Record<string, string> = {
  vpn: 'VPN',
  streaming: 'Streaming',
  gaming: 'Gaming',
  software: 'Software',
  'gift-card': 'Gift Card',
  other: 'Other',
};

export default function ProductCard({ product }: { product: Product }) {
  const { tr } = useLanguage();
  const inStock = product.stock > 0;

  const categoryLabel: Record<string, string> = {
    vpn: tr('VPN', 'VPN'),
    streaming: tr('Streaming', 'Streaming'),
    gaming: tr('Gaming', 'Gaming'),
    software: tr('Software', 'Software'),
    'gift-card': tr('Gift Card', 'Gift Card'),
    other: tr('Other', 'အခြား'),
  };

  return (
    <Link href={`/shop/${product._id}`} className="block group">
      <div className="game-card h-full flex flex-col relative overflow-hidden card-shimmer">
        {/* Hover Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 via-transparent to-cyan-500/0 group-hover:from-purple-500/5 group-hover:to-cyan-500/5 transition-all duration-500" />
        
        {/* Top accent line on hover */}
        <div className="absolute top-0 left-0 w-0 group-hover:w-full h-[2px] bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-500 ease-out" />
        
        {/* Product Image */}
        <div className="relative w-full h-40 overflow-hidden bg-dark-800">
          {product.image && product.image !== '/images/default-product.png' ? (
            <>
              <Image
                src={product.image}
                alt={product.name}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark-900/80 to-transparent" />
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <ShoppingBag className="w-12 h-12 text-dark-600" />
            </div>
          )}
          {/* Category badge overlaid on image */}
          <div className="absolute top-3 left-3">
            <span className={categoryBadge[product.category] || 'badge-other'}>
              {categoryLabel[product.category] || product.category}
            </span>
          </div>
          <div className="absolute top-3 right-3">
            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${inStock ? 'bg-emerald-500/20 text-emerald-400 backdrop-blur-sm' : 'bg-red-500/20 text-red-400 backdrop-blur-sm'}`}>
              {inStock ? tr(`${product.stock} in stock`, `လက်ကျန် ${product.stock}`) : tr('Out of stock', 'ကုန်သွားပါပြီ')}
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
          <div className={`flex items-center gap-2 text-sm font-bold ${inStock ? 'text-white' : 'text-gray-600'}`}>
            {inStock ? (
              <>
                <Zap className="w-4 h-4 text-purple-400" />
                {tr('Buy Now', 'ယခုဝယ်မည်')}
              </>
            ) : (
              <>
                <ShoppingBag className="w-4 h-4" />
                {tr('Unavailable', 'မရရှိနိုင်')}
              </>
            )}
          </div>
        </div>
        </div>
      </div>
    </Link>
  );
}
