'use client';

import { useState } from 'react';
import { ShoppingCart, Check, X, Search, Globe, Zap, Cpu, Terminal, ArrowRight } from 'lucide-react';
import { useCart } from '@/lib/cart';
import toast from 'react-hot-toast';
import { useScrollFade } from '@/hooks/useScrollFade';

const EXTENSIONS = [
  // Tech & Dev
  { ext: '.tech', category: 'Tech' },
  { ext: '.dev', category: 'Tech' },
  { ext: '.software', category: 'Tech' },
  { ext: '.engineer', category: 'Tech' },
  { ext: '.codes', category: 'Tech' },
  { ext: '.systems', category: 'Tech' },
  { ext: '.app', category: 'Tech' },
  // Creative & Professional
  { ext: '.studio', category: 'Creative' },
  { ext: '.page', category: 'Creative' },
  { ext: '.live', category: 'Creative' },
  { ext: '.me', category: 'Creative' },
  // Fun & Unique
  { ext: '.ninja', category: 'Fun' },
  { ext: '.rocks', category: 'Fun' },
  { ext: '.games', category: 'Fun' },
  { ext: '.works', category: 'Fun' },
  { ext: '.email', category: 'Fun' },
  { ext: '.foo', category: 'Fun' },
];

const FIXED_PRICE = 30000;

interface DomainResult {
  domain: string;
  ext: string;
  available: boolean | null;
  loading: boolean;
}

export default function DomainSearchPage() {
  const { addItem, isInCart } = useCart();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DomainResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const containerRef = useScrollFade();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = query.trim().toLowerCase().split('.')[0]; // remove user typed extensions
    if (!cleanQuery) return;

    setIsSearching(true);
    
    // Initialize results in loading state
    const initialResults = EXTENSIONS.map(x => ({
      domain: `${cleanQuery}${x.ext}`,
      ext: x.ext,
      available: null,
      loading: true,
    }));
    setResults(initialResults);

    // Fetch availability in parallel
    for (let i = 0; i < EXTENSIONS.length; i++) {
        const domainStr = `${cleanQuery}${EXTENSIONS[i].ext}`;
        checkDomain(domainStr, i);
    }
  };

  const checkDomain = async (domainStr: string, index: number) => {
    try {
      const res = await fetch(`/api/domains/check?domain=${domainStr}`);
      const data = await res.json();
      setResults(prev => {
        const next = [...prev];
        next[index] = { ...next[index], available: data.available, loading: false };
        return next;
      });
    } catch {
      setResults(prev => {
        const next = [...prev];
        next[index] = { ...next[index], available: false, loading: false };
        return next;
      });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('my-MM', {
      style: 'currency',
      currency: 'MMK',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="min-h-screen pb-12" ref={containerRef}>
      <main className="flex-grow">
        {/* Header Section */}
        <div className="relative overflow-hidden mb-12">
          {/* Background decoration */}
          <div className="absolute inset-0 bg-hero-glow pointer-events-none" />
          
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-8 pb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-electric-500/10 text-electric-400 text-sm font-medium mb-6 ring-1 ring-electric-500/20">
              <Terminal className="w-4 h-4" />
              Developer Domains
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 text-white tracking-tight">
              Secure Your Digital Identity
            </h1>
            <p className="text-lg text-gray-400 mb-8 max-w-2xl mx-auto">
              သင့်ရဲ့ Idea တွေ၊ Project တွေအတွက် Developer Domains များကို မြန်မာငွေ {formatPrice(FIXED_PRICE)} ဖြင့် ၁ နှစ်စာ လွယ်ကူစွာ ဝယ်ယူလိုက်ပါ။
            </p>
            
            {/* Search Box */}
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto relative flex scroll-fade">
              <div className="relative flex-grow">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="w-5 h-5 text-gray-500" />
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find your perfect domain name..."
                  className="w-full bg-dark-800/80 border border-dark-600 focus:border-electric-500 text-white rounded-l-2xl pl-12 pr-4 py-4 text-lg focus:outline-none focus:ring-1 focus:ring-electric-500 transition-all placeholder:text-gray-600"
                  required
                />
              </div>
              <button 
                type="submit"
                disabled={isSearching && results.some(r => r.loading)}
                className="bg-electric-600 hover:bg-electric-500 disabled:bg-dark-600 disabled:text-gray-400 text-white px-8 py-4 rounded-r-2xl font-bold transition flex items-center gap-2"
              >
                Search
              </button>
            </form>

            <div className="mt-12 text-left scroll-fade max-w-4xl mx-auto">
              <h3 className="text-center text-gray-400 text-sm font-semibold tracking-widest uppercase mb-6">
                Premium Extensions @ {formatPrice(FIXED_PRICE)} / Year
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Array.from(new Set(EXTENSIONS.map(e => e.category))).map(category => (
                  <div key={category} className="bg-dark-800/50 border border-dark-600 rounded-2xl p-5 hover:border-dark-500 transition-colors shadow-lg">
                    <h4 className="text-electric-400 font-semibold mb-4 flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full bg-electric-500" />
                       {category}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {EXTENSIONS.filter(e => e.category === category).map((e) => (
                        <span 
                          key={e.ext} 
                          className="px-3 py-1.5 bg-dark-900/80 border border-dark-700/50 rounded-lg text-gray-300 font-mono text-sm hover:text-white hover:border-electric-500/50 transition-colors cursor-default shadow-inner"
                        >
                          {e.ext}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {results.length > 0 && (
            <div className="bg-dark-800 rounded-3xl border border-dark-600 overflow-hidden shadow-2xl scroll-fade">
              <div className="p-6 border-b border-dark-600 bg-dark-900/50 flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Search Results</h2>
                <div className="flex gap-4 text-sm font-medium">
                  <span className="flex items-center gap-1 text-green-400"><Check className="w-4 h-4"/> Available</span>
                  <span className="flex items-center gap-1 text-red-400"><X className="w-4 h-4"/> Taken</span>
                </div>
              </div>

              <div className="divide-y divide-dark-600/50">
                {results.map((result, idx) => {
                  const domainProductId = `domain-${result.domain}`;
                  const inCart = isInCart(domainProductId);

                  return (
                    <div key={idx} className={`p-6 flex flex-col sm:flex-row items-center justify-between gap-4 transition hover:bg-dark-700/30 ${result.available === true ? 'bg-green-900/5' : ''}`}>
                      <div className="flex items-center gap-4 w-full sm:w-auto">
                        {result.loading ? (
                          <div className="w-10 h-10 rounded-full bg-dark-700 flex items-center justify-center">
                            <div className="w-5 h-5 border-2 border-electric-500 border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : result.available ? (
                          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-400 ring-1 ring-green-500/20">
                            <Check className="w-5 h-5" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 ring-1 ring-red-500/20">
                            <X className="w-5 h-5" />
                          </div>
                        )}
                        
                        <div>
                          <h3 className="text-xl font-bold text-white flex items-baseline gap-1">
                            <span className="text-gray-300">{result.domain.replace(result.ext, '')}</span>
                            <span className="text-electric-400">{result.ext}</span>
                          </h3>
                          {result.loading ? (
                            <p className="text-sm text-gray-500">Checking availability...</p>
                          ) : result.available ? (
                            <p className="text-sm text-green-400">Available to register</p>
                          ) : (
                            <p className="text-sm text-red-400">Already registered</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto mt-2 sm:mt-0">
                        {!result.loading && result.available && (
                          <div className="text-right flex-shrink-0">
                            <div className="font-bold text-lg text-white">{formatPrice(FIXED_PRICE)}</div>
                            <div className="text-xs text-gray-500">per 1 Year</div>
                          </div>
                        )}
                        
                        <button
                          disabled={result.loading || !result.available || inCart}
                          onClick={() => {
                            addItem({
                              productId: domainProductId,
                              name: result.domain,
                              price: FIXED_PRICE,
                              stock: 1,
                              category: 'Domain'
                            });
                            toast.success(`Added ${result.domain} to cart!`);
                          }}
                          className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all flex-shrink-0 ${
                            result.loading
                              ? 'bg-dark-700 text-gray-500'
                              : !result.available
                              ? 'bg-dark-700/50 text-gray-500 cursor-not-allowed'
                              : inCart
                              ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/50'
                              : 'bg-electric-600 hover:bg-electric-500 text-white shadow-lg shadow-electric-500/20'
                          }`}
                        >
                          {inCart ? (
                            <>
                              <Check className="w-5 h-5" />
                              Added
                            </>
                          ) : (
                            <>
                              <ShoppingCart className="w-5 h-5" />
                              Add to cart
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Features / Empty State */}
          {results.length === 0 && (
            <div className="grid md:grid-cols-3 gap-6 scroll-fade">
              <div className="bg-dark-800 p-8 rounded-3xl border border-dark-600 text-center hover:border-dark-500 transition-colors">
                <div className="w-14 h-14 bg-electric-500/10 text-electric-400 flex items-center justify-center rounded-2xl mx-auto mb-6 ring-1 ring-electric-500/20">
                  <Globe className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-lg text-white mb-2">Premium Domains</h3>
                <p className="text-sm text-gray-400">Get access to developer-focused domain extensions for your portfolio or next startup.</p>
              </div>
              <div className="bg-dark-800 p-8 rounded-3xl border border-dark-600 text-center hover:border-dark-500 transition-colors">
                <div className="w-14 h-14 bg-purple-500/10 text-purple-400 flex items-center justify-center rounded-2xl mx-auto mb-6 ring-1 ring-purple-500/20">
                  <Zap className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-lg text-white mb-2">Fast Provisioning</h3>
                <p className="text-sm text-gray-400">Once your order is verified, domains are registered manually by our team swiftly.</p>
              </div>
              <div className="bg-dark-800 p-8 rounded-3xl border border-dark-600 text-center hover:border-dark-500 transition-colors">
                <div className="w-14 h-14 bg-blue-500/10 text-blue-400 flex items-center justify-center rounded-2xl mx-auto mb-6 ring-1 ring-blue-500/20">
                  <Cpu className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-lg text-white mb-2">Full DNS Control</h3>
                <p className="text-sm text-gray-400">You will receive an official registrar account with full DNS management capabilities.</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
