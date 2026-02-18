'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  ShoppingBag,
  ShoppingCart,
  Minus,
  Plus,
  Loader2,
  CheckCircle,
  Zap,
  Tag,
  LogIn,
  Check,
  Package,
} from 'lucide-react';
import PaymentUpload from '@/components/PaymentUpload';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/language';
import { useCart } from '@/lib/cart';
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

const categoryLabel: Record<string, string> = {
  vpn: 'VPN', streaming: 'Streaming', gaming: 'Gaming',
  software: 'Software', 'gift-card': 'Gift Card', other: 'Other',
};

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const { tr } = useLanguage();
  const { addItem, isInCart, getItem } = useCart();
  const containerRef = useScrollFade();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('kpay');
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentAccounts, setPaymentAccounts] = useState<{ method: string; accountName: string; accountNumber: string }[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [couponValidating, setCouponValidating] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    fetchProduct();
    fetch('/api/settings/payment-accounts')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setPaymentAccounts(data.data.accounts);
      })
      .catch(() => {});
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => setIsLoggedIn(data.success === true))
      .catch(() => setIsLoggedIn(false));
  }, [params.id]);

  async function fetchProduct() {
    try {
      const res = await fetch(`/api/products/${params.id}`);
      const data = await res.json();
      if (data.success) setProduct(data.data.product);
      else router.push('/shop');
    } catch {
      router.push('/shop');
    } finally {
      setLoading(false);
    }
  }

  function handleAddToCart() {
    if (!product || product.stock <= 0) return;
    addItem({
      productId: product._id,
      name: product.name,
      price: product.price,
      stock: product.stock,
      category: product.category,
      image: product.image,
    }, quantity);
    setJustAdded(true);
    toast.success(tr(`${product.name} added to cart`, `${product.name} ကို cart ထဲထည့်ပြီးပါပြီ`));
    setTimeout(() => setJustAdded(false), 2000);
  }

  async function handleApplyCoupon() {
    if (!couponCode.trim() || !product) return;
    setCouponValidating(true);
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim(), amount: total, category: product.category }),
      });
      const data = await res.json();
      if (data.success) {
        setCouponDiscount(data.data.discountAmount);
        setAppliedCoupon(couponCode.trim().toUpperCase());
        toast.success(tr('Coupon applied!', 'ကူပွန်အသုံးပြုပြီးပါပြီ!'));
      } else {
        toast.error(data.error || tr('Invalid coupon', 'ကူပွန်မမှန်ကန်ပါ'));
        setCouponDiscount(0);
        setAppliedCoupon('');
      }
    } catch {
      toast.error(tr('Failed to validate coupon', 'ကူပွန်စစ်ဆေးခြင်း မအောင်မြင်ပါ'));
    } finally {
      setCouponValidating(false);
    }
  }

  function removeCoupon() {
    setCouponCode('');
    setCouponDiscount(0);
    setAppliedCoupon('');
  }

  async function handleOrder() {
    if (!paymentFile || !product) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('productId', product._id);
      formData.append('quantity', quantity.toString());
      formData.append('paymentMethod', paymentMethod);
      formData.append('screenshot', paymentFile);
      if (appliedCoupon) formData.append('couponCode', appliedCoupon);

      const res = await fetch('/api/orders', { method: 'POST', body: formData });
      if (res.status === 401) {
        toast.error(tr('Please login to place an order', 'အော်ဒါတင်ရန် အကောင့်ဝင်ပါ'));
        router.push(`/login?redirect=/shop/${params.id}`);
        return;
      }
      const data = await res.json();
      if (data.success) {
        toast.success(
          data.data.order.status === 'completed'
            ? tr('Payment verified! Check your orders for keys.', 'ငွေပေးချေမှု အတည်ပြုပြီးပါပြီ! သင်၏ key များကို orders မှာစစ်ကြည့်ပါ။')
            : tr("Order placed! We'll verify shortly.", 'အော်ဒါတင်ပြီးပါပြီ! မကြာမီစစ်ဆေးပေးပါမည်။')
        );
        router.push('/account/orders');
      } else {
        toast.error(data.error || tr('Failed to place order', 'အော်ဒါတင်ခြင်း မအောင်မြင်ပါ'));
      }
    } catch {
      toast.error(tr('Something went wrong', 'တစ်ခုခုမှားယွင်းနေပါသည်'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
      </div>
    );
  }
  if (!product) return null;

  const subtotal = product.price * quantity;
  const total = Math.max(0, subtotal - couponDiscount);
  const alreadyInCart = isInCart(product._id);
  const cartItem = getItem(product._id);

  return (
    <div className="min-h-screen pt-24 pb-12" ref={containerRef}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/shop" className="scroll-fade inline-flex items-center gap-2 text-sm text-gray-400 hover:text-purple-400 mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> {tr('Back to Shop', 'ဆိုင်သို့ပြန်မည်')}
        </Link>

        {/* Product Info */}
        <div className="scroll-fade game-card overflow-hidden mb-6" data-delay="100">
          {/* Product Image */}
          {product.image && product.image !== '/images/default-product.png' && (
            <div className="relative w-full h-48 sm:h-64">
              <Image
                src={product.image}
                alt={product.name}
                fill
                className="object-cover"
                priority
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark-900/90 via-dark-900/20 to-transparent" />
            </div>
          )}
          <div className="p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <span className={`badge-${product.category}`}>
                {categoryLabel[product.category] || product.category}
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mt-3">{product.name}</h1>
            </div>
            <span className={`px-4 py-2 rounded-xl text-sm font-bold ${product.stock > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
              {product.stock > 0 ? tr(`${product.stock} in stock`, `လက်ကျန် ${product.stock}`) : tr('Out of stock', 'ကုန်သွားပါပြီ')}
            </span>
          </div>

          <p className="text-gray-400 leading-relaxed mb-8">{product.description}</p>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-6 bg-dark-900 rounded-2xl border border-dark-600/50">
            <div>
              <p className="text-sm text-gray-500 mb-1">{tr('Price per unit', 'တစ်ခုစျေးနှုန်း')}</p>
              <span className="text-3xl font-black text-purple-400">{product.price.toLocaleString()}</span>
              <span className="text-sm text-gray-500 ml-2">MMK</span>
            </div>
            {product.stock > 0 && (
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-dark-800 border border-dark-600 hover:border-purple-500/50 text-gray-400 hover:text-white transition-all"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center text-xl font-bold text-white">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-dark-800 border border-dark-600 hover:border-purple-500/50 text-gray-400 hover:text-white transition-all"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">{tr('Total', 'စုစုပေါင်း')}</p>
                  <p className="text-2xl font-black text-accent-gradient">{total.toLocaleString()} MMK</p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {product.stock > 0 && !showPayment && (
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              {/* Add to Cart Button (Primary) */}
              <button
                onClick={handleAddToCart}
                className={`flex-1 btn ${
                  justAdded || alreadyInCart
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 hover:shadow-glow-sm'
                }`}
              >
                {justAdded ? (
                  <><Check className="w-5 h-5" /> {tr('Added to Cart!', 'Cart ထဲထည့်ပြီး!')}</>
                ) : alreadyInCart ? (
                  <><Check className="w-5 h-5" /> {tr(`In Cart (${cartItem?.quantity})`, `Cart ထဲ (${cartItem?.quantity})`)}</>
                ) : (
                  <><ShoppingCart className="w-5 h-5" /> {tr('Add to Cart', 'Cart ထဲထည့်မည်')}</>
                )}
              </button>

              {/* View Cart or Go to Checkout */}
              {alreadyInCart && (
                <Link href="/cart" className="btn-secondary flex-1 text-center">
                  <ShoppingCart className="w-5 h-5" />
                  {tr('View Cart', 'Cart ကြည့်မည်')}
                </Link>
              )}

              {/* Buy Now (Direct) */}
              {isLoggedIn === false ? (
                <Link href={`/login?redirect=/shop/${params.id}`} className="btn-electric flex-1 text-center">
                  <LogIn className="w-5 h-5" /> {tr('Login to Purchase', 'ဝယ်ယူရန် အကောင့်ဝင်ပါ')}
                </Link>
              ) : (
                <button onClick={() => setShowPayment(true)} className="btn-electric flex-1">
                  <Zap className="w-5 h-5" /> {tr('Buy Now', 'ယခုဝယ်မည်')}
                </button>
              )}
            </div>
          )}
          </div>
        </div>

        {/* Payment Section */}
        {showPayment && (
          <div className="scroll-fade scroll-visible game-card p-8 space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-purple-400" />
              </div>
              {tr('Complete Payment', 'ငွေပေးချေမှု ပြီးစီးရန်')}
            </h2>

            <div>
              <label className="input-label">{tr('Payment Method', 'ငွေပေးချေမှုနည်းလမ်း')}</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'kpay', label: 'KBZ Pay' },
                  { value: 'wave', label: 'WaveMoney' },
                  { value: 'cbpay', label: 'CB Pay' },
                  { value: 'ayapay', label: 'AYA Pay' },
                ].map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setPaymentMethod(m.value)}
                    className={`px-5 py-3 rounded-xl text-sm font-semibold border-2 transition-all duration-200 ${
                      paymentMethod === m.value
                        ? 'bg-purple-500/10 border-purple-500 text-purple-400 shadow-glow-sm'
                        : 'bg-dark-900 border-dark-600 text-gray-400 hover:border-purple-500/50'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Account Info */}
            {(() => {
              const methodMap: Record<string, string> = { kpay: 'kpay', wave: 'wave', cbpay: 'cbpay', ayapay: 'ayapay' };
              const selectedAccount = paymentAccounts.find((a) => a.method === methodMap[paymentMethod]);
              if (!selectedAccount) return null;
              return (
                <div className="p-4 bg-purple-500/5 rounded-xl border border-purple-500/20">
                  <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wider">
                    {tr('Send payment to', 'ငွေလွှဲရန်')}
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      {selectedAccount.accountName && (
                        <p className="text-white font-bold text-base">{selectedAccount.accountName}</p>
                      )}
                      {selectedAccount.accountNumber && (
                        <p className="text-purple-400 font-mono text-lg font-bold tracking-wide">{selectedAccount.accountNumber}</p>
                      )}
                    </div>
                    {selectedAccount.accountNumber && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedAccount.accountNumber);
                          toast.success(tr('Copied!', 'ကူးယူပြီး!'));
                        }}
                        className="px-3 py-1.5 text-xs font-semibold bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-lg transition-colors"
                      >
                        {tr('Copy', 'ကူးယူမည်')}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {tr(
                      'Please transfer the exact amount and take a screenshot',
                      'ကျေးဇူးပြု၍ ပမာဏအတိအကျလွှဲပြီး screenshot ရိုက်ပါ'
                    )}
                  </p>
                </div>
              );
            })()}

            {/* Coupon Code */}
            <div>
              <label className="input-label">{tr('Coupon Code (Optional)', 'ကူပွန်ကုဒ် (ရွေးချယ်ခွင့်)')}</label>
              {appliedCoupon ? (
                <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                  <Tag className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 font-bold text-sm flex-1">{appliedCoupon} — {couponDiscount.toLocaleString()} MMK {tr('off', 'လျှော့')}</span>
                  <button onClick={removeCoupon} className="text-xs text-red-400 hover:text-red-300 font-semibold">{tr('Remove', 'ဖယ်ရှားမည်')}</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder={tr('Enter coupon code', 'ကူပွန်ကုဒ်ထည့်ပါ')}
                    className="input-field flex-1 uppercase"
                  />
                  <button
                    onClick={handleApplyCoupon}
                    disabled={!couponCode.trim() || couponValidating}
                    className="px-5 py-2.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                  >
                    {couponValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : tr('Apply', 'အသုံးပြုမည်')}
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="input-label">{tr('Payment Screenshot', 'ငွေပေးချေမှု Screenshot')}</label>
              <PaymentUpload onUpload={(file) => setPaymentFile(file)} expectedAmount={total} />
            </div>

            {/* Order Summary */}
            <div className="p-6 bg-dark-900 rounded-2xl border border-dark-600/50 space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">{tr('Order Summary', 'အော်ဒါအနှစ်ချုပ်')}</h3>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{tr('Product', 'ပစ္စည်း')}</span>
                <span className="text-white font-medium">{product.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{tr('Quantity', 'အရေအတွက်')}</span>
                <span className="text-white font-medium">{quantity}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{tr('Payment Method', 'ငွေပေးချေမှုနည်းလမ်း')}</span>
                <span className="text-white font-medium capitalize">{paymentMethod}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{tr('Subtotal', 'စုစုပေါင်း')}</span>
                <span className="text-white font-medium">{subtotal.toLocaleString()} MMK</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-400 flex items-center gap-1"><Tag className="w-3 h-3" /> {tr('Discount', 'လျှော့စျေး')}</span>
                  <span className="text-emerald-400 font-medium">-{couponDiscount.toLocaleString()} MMK</span>
                </div>
              )}
              <div className="flex justify-between text-base pt-3 border-t border-dark-600/50">
                <span className="text-gray-300 font-semibold">{tr('Total', 'စုစုပေါင်း')}</span>
                <span className="text-purple-400 font-black text-lg">{total.toLocaleString()} MMK</span>
              </div>
            </div>

            <button
              onClick={handleOrder}
              disabled={!paymentFile || submitting}
              className="btn-electric w-full"
            >
              {submitting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> {tr('Processing...', 'လုပ်ဆောင်နေသည်...')}</>
              ) : (
                <><CheckCircle className="w-5 h-5" /> {tr('Place Order', 'အော်ဒါတင်မည်')} — {total.toLocaleString()} MMK</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
