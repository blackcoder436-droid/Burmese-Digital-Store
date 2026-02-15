'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import ProductCard from '@/components/ProductCard';
import { Search, ChevronLeft, ChevronRight, Loader2, Package, X, Filter, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/lib/language';
import { useScrollFade } from '@/hooks/useScrollFade';

interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  image?: string;
}

interface CategoryCount {
  value: string;
  count: number;
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export default function ShopPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
      </div>
    }>
      <ShopContent />
    </Suspense>
  );
}

function ShopContent() {
  const { tr } = useLanguage();
  const containerRef = useScrollFade();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [searchInput, setSearchInput] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [categoryCounts, setCategoryCounts] = useState<CategoryCount[]>([]);

  // Debounce search input by 400ms
  const search = useDebounce(searchInput, 400);

  const hasActiveFilters = category || search;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '12',
      });
      if (category) params.set('category', category);
      if (search) params.set('search', search);

      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();

      if (data.success) {
        setProducts(data.data.products);
        setTotalPages(data.data.pagination.pages);
        setTotalProducts(data.data.pagination.total);
        if (data.data.categories) {
          setCategoryCounts(data.data.categories);
        }
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  }, [page, category, search]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Reset page on filter changes
  useEffect(() => {
    setPage(1);
  }, [category, search]);

  const clearAllFilters = () => {
    setSearchInput('');
    setCategory('');
    setPage(1);
    searchInputRef.current?.focus();
  };

  const getCategoryCount = (value: string) => {
    if (!value) return categoryCounts.reduce((sum, c) => sum + c.count, 0);
    const found = categoryCounts.find((c) => c.value === value);
    return found ? found.count : 0;
  };

  const categories = [
    { value: '', label: tr('All', 'အားလုံး') },
    { value: 'vpn', label: 'VPN' },
    { value: 'streaming', label: 'Streaming' },
    { value: 'gaming', label: 'Gaming' },
    { value: 'software', label: 'Software' },
    { value: 'gift-card', label: 'Gift Cards' },
    { value: 'other', label: tr('Other', 'အခြား') },
  ];

  const selectedCategoryLabel = categories.find((c) => c.value === category)?.label || tr('All', 'အားလုံး');

  return (
    <div className="min-h-screen pt-[2.5rem] pb-12" ref={containerRef}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero row: tagline left + search right */}
        <div className="scroll-fade flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          {/* Left: tagline */}
          <div className="shrink-0">
            <h1 className="text-lg sm:text-xl font-bold text-white">
              {tr('Premium Digital Products', 'အရည်အသွေးမြင့် Digital Products')}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              {tr('Instant delivery • Best prices in Myanmar', 'ချက်ချင်းရယူ • မြန်မာနိုင်ငံတွင် အကောင်းဆုံးစျေး')}
            </p>
          </div>

          {/* Right: search box */}
          <div className="relative flex items-center w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 z-10" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={tr('Search...', 'ရှာမည်...')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="input-field !pl-9 !pr-28 sm:!pr-32 w-full !bg-dark-800/80 !border-dark-600 focus:!border-purple-500/60 !text-sm !py-2 !rounded-xl"
            />

            {/* Right side controls */}
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  className="p-1 rounded text-gray-500 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Divider */}
              <div className="w-px h-5 bg-dark-600" />

              {/* Category dropdown trigger */}
              <div ref={dropdownRef} className="relative">
                <button
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    category
                      ? 'text-purple-300 bg-purple-500/10'
                      : 'text-gray-400 hover:text-white hover:bg-dark-600'
                  }`}
                >
                  <Filter className="w-3 h-3" />
                  <span className="hidden sm:inline">{selectedCategoryLabel}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown */}
                {showCategoryDropdown && (
                  <div className="absolute right-0 top-full mt-1.5 w-48 bg-dark-800 border border-dark-600 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50">
                    {categories.map((cat) => {
                      const count = getCategoryCount(cat.value);
                      const isActive = category === cat.value;
                      return (
                        <button
                          key={cat.value}
                          onClick={() => {
                            setCategory(cat.value);
                            setShowCategoryDropdown(false);
                          }}
                          className={`w-full flex items-center justify-between px-3.5 py-2.5 text-sm transition-colors ${
                            isActive
                              ? 'bg-purple-500/15 text-purple-300'
                              : 'text-gray-400 hover:bg-dark-700 hover:text-white'
                          }`}
                        >
                          <span className="font-medium">{cat.label}</span>
                          {count > 0 && (
                            <span className={`text-xs tabular-nums ${isActive ? 'text-purple-400' : 'text-gray-600'}`}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Active filters info */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 mb-3">
            {category && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded text-xs text-purple-300">
                {selectedCategoryLabel}
                <button onClick={() => setCategory('')} className="hover:text-white"><X className="w-3 h-3" /></button>
              </span>
            )}
            {search && (
              <span className="text-xs text-gray-500">
                &ldquo;{search}&rdquo;
              </span>
            )}
            <button onClick={clearAllFilters} className="text-xs text-gray-600 hover:text-red-400 transition-colors ml-auto">
              {tr('Clear', 'ဖျက်')}
            </button>
          </div>
        )}

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="game-card overflow-hidden animate-pulse">
                <div className="h-40 bg-dark-700/50" />
                <div className="p-4 space-y-3">
                  <div className="h-3 bg-dark-700/50 rounded w-16" />
                  <div className="h-4 bg-dark-700/50 rounded w-3/4" />
                  <div className="h-3 bg-dark-700/50 rounded w-full" />
                  <div className="flex justify-between mt-4">
                    <div className="h-5 bg-dark-700/50 rounded w-24" />
                    <div className="h-5 bg-dark-700/50 rounded w-16" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 mx-auto mb-6 bg-dark-800 rounded-2xl flex items-center justify-center">
              <Package className="w-10 h-10 text-gray-600" />
            </div>
            <p className="text-gray-400 text-lg">{tr('No products found.', 'ပစ္စည်းမတွေ့ပါ။')}</p>
            <p className="text-gray-600 mt-2">{tr('Try a different search or category.', 'အခြားရှာဖွေမှု သို့မဟုတ် အမျိုးအစားကို စမ်းကြည့်ပါ။')}</p>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="mt-4 text-sm text-purple-400 hover:text-purple-300 underline underline-offset-4 transition-colors"
              >
                {tr('Clear all filters', 'Filter အားလုံးဖျက်')}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {products.map((product, i) => (
                <div key={product._id} className="scroll-fade" data-delay={`${i * 60}`}>
                  <ProductCard product={product} />
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-12">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary !px-4 !py-2.5"
                >
                  <ChevronLeft className="w-5 h-5" />
                  {tr('Previous', 'ရှေ့စာမျက်နှာ')}
                </button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-9 h-9 rounded-lg text-sm font-semibold transition-all ${
                          page === pageNum
                            ? 'bg-gradient-to-r from-purple-500 to-cyan-500 text-white shadow-glow-sm'
                            : 'text-gray-500 hover:text-white hover:bg-dark-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn-secondary !px-4 !py-2.5"
                >
                  {tr('Next', 'နောက်စာမျက်နှာ')}
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
