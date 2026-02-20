'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart,
  ShoppingBag,
  Trash2,
  Minus,
  Plus,
  ArrowLeft,
  Zap,
  Tag,
  Loader2,
  CheckCircle,
  LogIn,
  Package,
} from 'lucide-react';
import PaymentUpload from '@/components/PaymentUpload';
import { reportCartAnalytics, useCart } from '@/lib/cart';
import { useLanguage } from '@/lib/language';
import { useScrollFade } from '@/hooks/useScrollFade';
import toast from 'react-hot-toast';

export default function CartPage() {
  const { t } = useLanguage();
  const {
    items,
    removeItem,
    updateQuantity,
    clearCart,
    getSubtotal,
    getItemCount,
  } = useCart();
  const router = useRouter();
  const containerRef = useScrollFade();

  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('kpay');
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [paymentAccounts, setPaymentAccounts] = useState<{ method: string; accountName: string; accountNumber: string }[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [couponValidating, setCouponValidating] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => setIsLoggedIn(data.success === true))
      .catch(() => setIsLoggedIn(false));
    fetch('/api/settings/payment-accounts')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setPaymentAccounts(data.data.accounts);
      })
      .catch(() => {});
  }, []);

  const subtotal = getSubtotal();
  const total = Math.max(0, subtotal - couponDiscount);

  async function handleApplyCoupon() {
    if (!couponCode.trim()) return;
    setCouponValidating(true);
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim(), amount: subtotal }),
      });
      const data = await res.json();
      if (data.success) {
        setCouponDiscount(data.data.discountAmount);
        setAppliedCoupon(couponCode.trim().toUpperCase());
        toast.success(t('shop.productDetail.couponApplied'));
      } else {
        toast.error(data.error || t('shop.productDetail.invalidCoupon'));
        setCouponDiscount(0);
        setAppliedCoupon('');
      }
    } catch {
      toast.error(t('shop.productDetail.failedValidateCoupon'));
    } finally {
      setCouponValidating(false);
    }
  }

  function removeCoupon() {
    setCouponCode('');
    setCouponDiscount(0);
    setAppliedCoupon('');
  }

  async function handleCheckout() {
    if (!paymentFile || items.length === 0) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('screenshot', paymentFile);
      formData.append('paymentMethod', paymentMethod);
      if (appliedCoupon) formData.append('couponCode', appliedCoupon);

      // Send cart items as JSON
      const cartItems = items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }));
      formData.append('cartItems', JSON.stringify(cartItems));

      const res = await fetch('/api/orders/cart', { method: 'POST', body: formData });

      if (res.status === 401) {
        toast.error(t('shop.productDetail.loginRequiredToOrder'));
        router.push('/login?redirect=/cart');
        return;
      }

      const data = await res.json();
      if (data.success) {
        reportCartAnalytics('checkout_completed', items);
        clearCart();
        toast.success(t('cart.page.ordersPlacedVerifySoon'));
        router.push('/account/orders');
      } else {
        toast.error(data.error || t('cart.page.failedPlaceOrders'));
      }
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSubmitting(false);
    }
  }

  // Empty cart
  if (items.length === 0 && !showCheckout) {
    return (
      <div className="min-h-screen pt-8 pb-12" ref={containerRef}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="scroll-fade text-center py-20">
            <div className="w-24 h-24 mx-auto mb-6 bg-dark-800 rounded-3xl flex items-center justify-center">
              <ShoppingCart className="w-12 h-12 text-gray-600" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">
              {t('cart.empty')}
            </h1>
            <p className="text-gray-500 mb-8">
              {t('cart.page.browseAndAdd')}
            </p>
            <Link href="/shop" className="btn-electric inline-flex">
              <ShoppingBag className="w-5 h-5" />
              {t('cart.page.goToShop')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-8 pb-12" ref={containerRef}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="scroll-fade flex items-center justify-between mb-8">
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-dark-700/50 border border-dark-600/50 text-gray-400 hover:text-white hover:border-purple-500/40 hover:bg-purple-500/10 transition-all flex-shrink-0"
              title={t('common.back')}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3 mb-0">
              <ShoppingCart className="w-7 h-7 text-purple-400" />
              {t('cart.title')}
              <span className="text-sm font-normal text-gray-500">
                ({getItemCount()} {t('cart.items')})
              </span>
            </h1>
          </div>
          {items.length > 0 && (
            <button
              onClick={() => {
                clearCart();
                toast.success(t('cart.page.cartCleared'));
                router.push('/shop');
              }}
              className="text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              {t('cart.page.clearAll')}
            </button>
          )}
        </div>

        {/* Cart Items */}
        <div className="scroll-fade space-y-4 mb-8" data-delay="100">
          {items.map((item) => (
            <div key={item.productId} className="game-card p-4 sm:p-6">
              <div className="flex gap-4">
                {/* Product Image */}
                <Link href={`/shop/${item.slug || item.productId}`} className="shrink-0">
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-dark-800">
                    {item.image && item.image !== '/images/default-product.png' ? (
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-cover hover:scale-105 transition-transform"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-8 h-8 text-dark-600" />
                      </div>
                    )}
                  </div>
                </Link>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/shop/${item.slug || item.productId}`}
                        className="text-base font-bold text-white hover:text-purple-300 transition-colors line-clamp-1"
                      >
                        {item.name}
                      </Link>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {item.price.toLocaleString()} MMK × {item.quantity}
                      </p>
                    </div>
                    {/* Remove button */}
                    <button
                      onClick={() => {
                        const isLastItem = items.length === 1;
                        removeItem(item.productId);
                        toast.success(t('cart.page.removedFromCart'));
                        if (isLastItem) {
                          router.push('/shop');
                        }
                      }}
                      className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all shrink-0"
                      title={t('cart.remove')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Quantity + Price */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-dark-800 border border-dark-600 hover:border-purple-500/50 text-gray-400 hover:text-white transition-all"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-10 text-center text-sm font-bold text-white">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        disabled={item.quantity >= item.stock}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-dark-800 border border-dark-600 hover:border-purple-500/50 text-gray-400 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      {item.quantity >= item.stock && (
                        <span className="text-xs text-amber-400 ml-2">
                          {t('cart.page.maxStock')}
                        </span>
                      )}
                    </div>
                    <p className="text-lg font-black text-purple-400">
                      {(item.price * item.quantity).toLocaleString()} <span className="text-xs text-gray-500">MMK</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary + Checkout */}
        {!showCheckout ? (
          <div className="scroll-fade game-card p-6 sm:p-8" data-delay="200">
            <h2 className="text-lg font-bold text-white mb-4">
              {t('shop.productDetail.orderSummary')}
            </h2>

            <div className="space-y-3 mb-6">
              {items.map((item) => (
                <div key={item.productId} className="flex justify-between text-sm">
                  <span className="text-gray-400 truncate mr-4">
                    {item.name} × {item.quantity}
                  </span>
                  <span className="text-white font-medium shrink-0">
                    {(item.price * item.quantity).toLocaleString()} MMK
                  </span>
                </div>
              ))}
              <div className="border-t border-dark-600/50 pt-3">
                <div className="flex justify-between">
                  <span className="text-gray-300 font-semibold">
                    {t('cart.total')}
                  </span>
                  <span className="text-xl font-black text-accent-gradient">
                    {subtotal.toLocaleString()} MMK
                  </span>
                </div>
              </div>
            </div>

            {/* Checkout Button */}
            {isLoggedIn === false ? (
              <Link href="/login?redirect=/cart" className="btn-electric w-full text-center">
                <LogIn className="w-5 h-5" /> {t('cart.page.loginToCheckout')}
              </Link>
            ) : (
              <button
                onClick={() => {
                  reportCartAnalytics('checkout_started', items);
                  setShowCheckout(true);
                }}
                className="btn-electric w-full"
              >
                <Zap className="w-5 h-5" />
                {t('cart.checkout')} — {subtotal.toLocaleString()} MMK
              </button>
            )}
          </div>
        ) : (
          /* Checkout Section */
          <div className="scroll-fade scroll-visible game-card p-6 sm:p-8 space-y-6" data-delay="200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-purple-400" />
                </div>
                {t('shop.productDetail.completePayment')}
              </h2>
              <button
                onClick={() => setShowCheckout(false)}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                {t('common.back')}
              </button>
            </div>

            {/* Payment Method */}
            <div>
              <label className="input-label">{t('order.paymentMethod')}</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'kpay', label: 'KBZ Pay' },
                  { value: 'wave', label: 'WaveMoney' },
                  { value: 'uabpay', label: 'UAB Pay' },
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
              const methodMap: Record<string, string> = { kpay: 'kpay', wave: 'wave', uabpay: 'uabpay', ayapay: 'ayapay' };
              const selectedAccount = paymentAccounts.find((a) => a.method === methodMap[paymentMethod]);
              if (!selectedAccount) return null;
              return (
                <div className="p-4 bg-purple-500/5 rounded-xl border border-purple-500/20">
                  <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wider">
                    {t('shop.productDetail.sendPaymentTo')}
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
                          toast.success(t('common.copied'));
                        }}
                        className="px-3 py-1.5 text-xs font-semibold bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-lg transition-colors"
                      >
                        {t('common.copy')}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {t('cart.page.transferExactTotalScreenshot')}
                  </p>
                </div>
              );
            })()}

            {/* Coupon Code */}
            <div>
              <label className="input-label">{t('shop.productDetail.couponCodeOptional')}</label>
              {appliedCoupon ? (
                <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                  <Tag className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 font-bold text-sm flex-1">{appliedCoupon} — {couponDiscount.toLocaleString()} MMK {t('shop.productDetail.off')}</span>
                  <button onClick={removeCoupon} className="text-xs text-red-400 hover:text-red-300 font-semibold">{t('cart.remove')}</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder={t('shop.productDetail.enterCouponCode')}
                    className="input-field flex-1 uppercase"
                  />
                  <button
                    onClick={handleApplyCoupon}
                    disabled={!couponCode.trim() || couponValidating}
                    className="px-5 py-2.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                  >
                    {couponValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : t('cart.applyCoupon')}
                  </button>
                </div>
              )}
            </div>

            {/* Screenshot Upload */}
            <div>
              <label className="input-label">{t('order.uploadScreenshot')}</label>
              <PaymentUpload onUpload={(file) => setPaymentFile(file)} expectedAmount={total} />
            </div>

            {/* Order Summary */}
            <div className="p-6 bg-dark-900 rounded-2xl border border-dark-600/50 space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">{t('shop.productDetail.orderSummary')}</h3>
              {items.map((item) => (
                <div key={item.productId} className="flex justify-between text-sm">
                  <span className="text-gray-500 truncate mr-2">{item.name} × {item.quantity}</span>
                  <span className="text-white font-medium shrink-0">{(item.price * item.quantity).toLocaleString()} MMK</span>
                </div>
              ))}
              <div className="flex justify-between text-sm pt-2 border-t border-dark-600/50">
                <span className="text-gray-500">{t('cart.subtotal')}</span>
                <span className="text-white font-medium">{subtotal.toLocaleString()} MMK</span>
              </div>
              {couponDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-400 flex items-center gap-1"><Tag className="w-3 h-3" /> {t('cart.discount')}</span>
                  <span className="text-emerald-400 font-medium">-{couponDiscount.toLocaleString()} MMK</span>
                </div>
              )}
              <div className="flex justify-between text-base pt-3 border-t border-dark-600/50">
                <span className="text-gray-300 font-semibold">{t('cart.total')}</span>
                <span className="text-purple-400 font-black text-lg">{total.toLocaleString()} MMK</span>
              </div>
            </div>

            {/* Place Order Button */}
            <button
              onClick={handleCheckout}
              disabled={!paymentFile || submitting}
              className="btn-electric w-full"
            >
              {submitting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> {t('shop.productDetail.processing')}</>
              ) : (
                <><CheckCircle className="w-5 h-5" /> {t('shop.productDetail.placeOrder')} — {total.toLocaleString()} MMK</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
