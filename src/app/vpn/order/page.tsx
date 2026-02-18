'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PaymentUpload from '@/components/PaymentUpload';
import { useLanguage } from '@/lib/language';
import { buildPlanId, getPlan } from '@/lib/vpn-plans';

interface ServerOption {
  id: string;
  name: string;
  flag: string;
  online: boolean;
  protocol?: string;
  enabledProtocols?: string[];
}

const allProtocols = [
  { value: 'trojan', label: 'Trojan', descKey: 'vpn.orderPage.protocolBestForMostIsps' },
  { value: 'vless', label: 'VLESS', descKey: 'vpn.orderPage.protocolFastAndStable' },
  { value: 'vmess', label: 'VMess', descKey: 'vpn.orderPage.protocolGoodCompatibility' },
  { value: 'shadowsocks', label: 'Shadowsocks', descKey: 'vpn.orderPage.protocolLightweightOption' },
];

function VpnOrderPageContent() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  const devices = Number(searchParams.get('devices') || 0);
  const months = Number(searchParams.get('months') || 0);

  const plan = useMemo(() => {
    if (!devices || !months) return null;
    return getPlan(buildPlanId(devices, months)) || null;
  }, [devices, months]);

  const [servers, setServers] = useState<ServerOption[]>([]);

  useEffect(() => {
    fetch('/api/vpn/servers')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.servers) setServers(d.data.servers);
      })
      .catch(() => {});
  }, []);

  const [step, setStep] = useState<'server' | 'protocol' | 'payment'>('server');
  const [selectedServer, setSelectedServer] = useState('');
  const [selectedProtocol, setSelectedProtocol] = useState('trojan');
  const [paymentMethod, setPaymentMethod] = useState('kpay');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountInfo, setDiscountInfo] = useState<{ type: string; value: number } | null>(null);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Computed final price
  const finalPrice = plan ? Math.max(0, plan.price - discountAmount) : 0;

  // Validate coupon against API
  async function applyCoupon() {
    if (!couponCode.trim() || !plan) return;
    setCouponLoading(true);
    setCouponError('');
    setCouponApplied(false);
    setDiscountAmount(0);
    setDiscountInfo(null);
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode, amount: plan.price, category: 'vpn' }),
      });
      const data = await res.json();
      if (data.success) {
        setDiscountAmount(data.data.discountAmount);
        setDiscountInfo({ type: data.data.discountType, value: data.data.discountValue });
        setCouponApplied(true);
      } else {
        setCouponError(data.error || t('vpn.orderPage.invalidCoupon'));
      }
    } catch {
      setCouponError(t('vpn.orderPage.networkError'));
    } finally {
      setCouponLoading(false);
    }
  }

  // Clear coupon
  function clearCoupon() {
    setCouponCode('');
    setCouponApplied(false);
    setCouponError('');
    setDiscountAmount(0);
    setDiscountInfo(null);
  }

  // Auto-select first server when loaded
  useEffect(() => {
    if (servers.length > 0 && !selectedServer) {
      setSelectedServer(servers[0].id);
    }
  }, [servers, selectedServer]);

  // Get available protocols for selected server
  const availableProtocols = useMemo(() => {
    const server = servers.find((s) => s.id === selectedServer);
    const enabled = server?.enabledProtocols ?? ['trojan', 'vless', 'vmess', 'shadowsocks'];
    return allProtocols.filter((p) => enabled.includes(p.value));
  }, [servers, selectedServer]);

  // Reset protocol if current one becomes unavailable
  useEffect(() => {
    if (availableProtocols.length > 0 && !availableProtocols.some((p) => p.value === selectedProtocol)) {
      setSelectedProtocol(availableProtocols[0].value);
    }
  }, [availableProtocols, selectedProtocol]);

  const paymentAccountName = 'Myo Ko Aung';
  const paymentAccountNumber = '09950569539';

  const monthLabel = (m: number) => (m === 12 ? '12 Months' : `${m} Month${m > 1 ? 's' : ''}`);

  if (!plan) {
    return (
      <div className="min-h-screen pt-8 pb-10 px-4">
        <div className="max-w-xl mx-auto bg-[#12122a] border border-purple-500/20 rounded-2xl p-5 text-center">
          <h1 className="text-xl font-bold text-white mb-2">{t('vpn.orderPage.invalidPlan')}</h1>
          <p className="text-sm text-gray-400 mb-4">{t('vpn.orderPage.choosePlanFromPricing')}</p>
          <button
            onClick={() => router.push('/vpn#pricing')}
            className="px-5 py-2.5 rounded-lg font-semibold text-white bg-gradient-to-r from-purple-600 to-cyan-500"
          >
            {t('vpn.orderPage.backToPricing')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-8 sm:pt-10 pb-8 sm:pb-10 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => router.push('/vpn#pricing')} className="text-sm text-purple-400 hover:text-purple-300 mb-3">
          ← {t('vpn.orderPage.backToPricing')}
        </button>

        <div className="bg-[#12122a] border border-purple-500/20 rounded-2xl p-3.5 sm:p-5">
          {!submitSuccess && (
            <div className="mb-4 flex items-center gap-2 text-[11px] sm:text-xs text-gray-400">
              <span className={`px-2 py-1 rounded-md border ${step === 'server' ? 'text-purple-300 border-purple-500/40 bg-purple-500/10' : 'border-purple-500/20'}`}>1. {t('vpn.orderPage.server')}</span>
              <span className="opacity-60">→</span>
              <span className={`px-2 py-1 rounded-md border ${step === 'protocol' ? 'text-purple-300 border-purple-500/40 bg-purple-500/10' : 'border-purple-500/20'}`}>2. {t('vpn.orderPage.protocol')}</span>
              <span className="opacity-60">→</span>
              <span className={`px-2 py-1 rounded-md border ${step === 'payment' ? 'text-purple-300 border-purple-500/40 bg-purple-500/10' : 'border-purple-500/20'}`}>3. {t('order.paymentMethod')}</span>
            </div>
          )}

          {submitSuccess ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 mx-auto mb-3 bg-emerald-500/20 rounded-full flex items-center justify-center">
                <span className="text-2xl">✅</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2">{t('vpn.orderPage.orderPlacedSuccessfully')}</h3>
              <p className="text-sm text-gray-400 mb-5">
                {t('vpn.orderPage.orderPlacedDesc')}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <button onClick={() => router.push('/account/orders')} className="px-5 py-2.5 rounded-lg font-semibold text-white bg-gradient-to-r from-purple-600 to-cyan-500 transition-all">
                  {t('nav.myOrders')}
                </button>
                <button onClick={() => router.push('/vpn')} className="px-5 py-2.5 rounded-lg border border-purple-500/20 text-white hover:bg-purple-500/10 transition-all">
                  {t('common.close')}
                </button>
              </div>
            </div>
          ) : step === 'server' ? (
            <>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-1">{t('vpn.orderPage.chooseServer')}</h3>
              <p className="text-xs sm:text-sm text-gray-400 mb-4">
                {plan.devices} Device{plan.devices > 1 ? 's' : ''} / {monthLabel(plan.months)} — {plan.price.toLocaleString()} Ks
              </p>

              <div className="space-y-2 mb-4">
                {servers.map((server) => (
                  <button
                    key={server.id}
                    onClick={() => setSelectedServer(server.id)}
                    className={`w-full text-left rounded-xl border px-3 py-2.5 transition-all ${
                      selectedServer === server.id ? 'border-purple-500 bg-purple-500/10' : 'border-purple-500/20 hover:border-purple-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{server.flag}</span>
                        <span className="text-white font-medium text-sm sm:text-base">{server.name}</span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] text-green-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        {t('vpn.online')}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <button onClick={() => router.push('/vpn#pricing')} className="px-4 py-2 rounded-lg border border-purple-500/20 text-white hover:bg-purple-500/10 transition-all">
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => { if (selectedServer) setStep('protocol'); }}
                  disabled={!selectedServer}
                  className="px-4 py-2 rounded-lg font-semibold text-white bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {t('vpn.orderPage.nextProtocol')}
                </button>
              </div>
            </>
          ) : step === 'protocol' ? (
            <>
              <button onClick={() => setStep('server')} className="text-sm text-purple-400 hover:text-purple-300 mb-3 flex items-center gap-1">
                ← {t('vpn.orderPage.backToServerSelection')}
              </button>

              <h3 className="text-lg sm:text-xl font-bold text-white mb-1">{t('vpn.orderPage.chooseProtocol')}</h3>
              <p className="text-xs sm:text-sm text-gray-400 mb-4">{t('vpn.orderPage.trojanRecommended')}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                {availableProtocols.map((protocol) => (
                  <button
                    key={protocol.value}
                    onClick={() => setSelectedProtocol(protocol.value)}
                    className={`text-left rounded-xl border px-3 py-2.5 transition-all ${
                      selectedProtocol === protocol.value ? 'border-purple-400 bg-purple-500/15' : 'border-purple-500/20 hover:border-purple-500/40 bg-[#0a0a1f]/60'
                    }`}
                  >
                    <p className="text-white font-semibold text-sm sm:text-base">{protocol.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t(protocol.descKey)}</p>
                  </button>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <button onClick={() => setStep('server')} className="px-4 py-2 rounded-lg border border-purple-500/20 text-white hover:bg-purple-500/10 transition-all">
                  {t('common.back')}
                </button>
                <button onClick={() => setStep('payment')} className="px-4 py-2 rounded-lg font-semibold text-white bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 transition-all">
                  {t('vpn.orderPage.continueToPayment')}
                </button>
              </div>
            </>
          ) : (
            <>
              <button onClick={() => setStep('protocol')} className="text-sm text-purple-400 hover:text-purple-300 mb-3 flex items-center gap-1">
                ← {t('vpn.orderPage.backToProtocolSelection')}
              </button>

              <h3 className="text-lg sm:text-xl font-bold text-white mb-1">{t('order.paymentMethod')}</h3>
              <p className="text-sm text-gray-400 mb-4">{t('vpn.orderPage.confirmDetailsUploadProof')}</p>

              <div className="flex items-start justify-between gap-3 bg-[#0a0a1f]/70 rounded-2xl px-3.5 py-3 mb-3 border border-purple-500/20">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="text-base mt-0.5">🛡️</span>
                  <div>
                    <p className="text-white font-semibold text-sm leading-tight">{plan.devices} Device{plan.devices > 1 ? 's' : ''} / {monthLabel(plan.months)}</p>
                    <p className="text-gray-400 text-xs mt-1">
                      {servers.find((s) => s.id === selectedServer)?.flag} {servers.find((s) => s.id === selectedServer)?.name || selectedServer} • {selectedProtocol.toUpperCase()}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {couponApplied ? (
                    <>
                      <p className="text-xs text-gray-500 line-through">{plan.price.toLocaleString()} Ks</p>
                      <p className="text-lg sm:text-xl font-extrabold text-emerald-400">{finalPrice.toLocaleString()} <span className="text-xs sm:text-sm text-gray-400">Ks</span></p>
                      <p className="text-[10px] text-emerald-400/80">-{discountAmount.toLocaleString()} Ks ({discountInfo?.type === 'percentage' ? `${discountInfo.value}%` : `${discountInfo?.value?.toLocaleString()} Ks`})</p>
                    </>
                  ) : (
                    <p className="text-lg sm:text-xl font-extrabold text-purple-400">{plan.price.toLocaleString()} <span className="text-xs sm:text-sm text-gray-400">Ks</span></p>
                  )}
                </div>
              </div>

              {/* Coupon Code - right below price */}
              <div className="mb-4">
                <label className="text-xs text-gray-400 mb-2 block font-medium">{t('vpn.orderPage.couponCodeOptional')}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value.toUpperCase());
                      if (couponApplied) clearCoupon();
                    }}
                    placeholder="e.g. VPN20"
                    disabled={couponApplied}
                    className="flex-1 px-3 py-2 bg-[#0a0a1f] border border-purple-500/15 rounded-lg text-sm text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none transition-all disabled:opacity-50"
                  />
                  {couponApplied ? (
                    <button
                      type="button"
                      onClick={clearCoupon}
                      className="px-3 py-2 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all"
                    >
                      {t('cart.remove')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={applyCoupon}
                      disabled={!couponCode.trim() || couponLoading}
                      className="px-3 py-2 rounded-lg text-xs font-medium bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {couponLoading ? '...' : t('cart.applyCoupon')}
                    </button>
                  )}
                </div>
                {couponApplied && (
                  <p className="text-xs text-emerald-400 mt-1.5">
                    ✓ {t('vpn.orderPage.couponApplied')} -{discountAmount.toLocaleString()} Ks {t('cart.discount')}
                  </p>
                )}
                {couponError && (
                  <p className="text-xs text-red-400 mt-1.5">{couponError}</p>
                )}
              </div>

              {/* Transfer account info */}
              <div className="flex items-center gap-3 bg-[#0a0a1f]/70 rounded-2xl px-3.5 py-3 mb-3 border border-amber-500/20">
                <span className="text-base mt-0.5">💳</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-amber-400/80 mb-1 tracking-wide uppercase">{t('vpn.orderPage.transferTo')}</p>
                  <p className="text-white text-base sm:text-lg font-semibold leading-tight">{paymentAccountName}</p>
                  <p className="text-cyan-400 font-mono text-sm sm:text-base mt-0.5">{paymentAccountNumber}</p>
                </div>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(paymentAccountNumber);
                    setCopiedAccount(true);
                    setTimeout(() => setCopiedAccount(false), 1500);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all shrink-0 ${
                    copiedAccount ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10' : 'text-purple-300 border-purple-500/30 hover:border-purple-500/50 hover:text-purple-200'
                  }`}
                >
                  {copiedAccount ? t('common.copied') : t('common.copy')}
                </button>
              </div>

              {/* Amount to transfer reminder */}
              {couponApplied && (
                <div className="mb-4 p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                  <p className="text-xs text-emerald-400 text-center font-medium">
                    💰 {t('vpn.orderPage.pleaseTransfer')} <span className="font-bold text-sm">{finalPrice.toLocaleString()} Ks</span> {t('vpn.orderPage.onlyAfterDiscount')}
                  </p>
                </div>
              )}

              <div className="mb-4">
                <label className="text-xs text-gray-400 mb-2 block font-medium">{t('order.paymentMethod')}</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { value: 'kpay', label: 'KBZPay' },
                    { value: 'wavemoney', label: 'WaveMoney' },
                    { value: 'cbpay', label: 'CBPay' },
                    { value: 'ayapay', label: 'AYA Pay' },
                  ].map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setPaymentMethod(m.value)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                        paymentMethod === m.value ? 'bg-purple-500/20 text-white border-purple-400' : 'bg-[#0a0a1f] text-gray-300 border-purple-500/15 hover:border-purple-500/40'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="text-xs text-gray-400 mb-2 block font-medium">{t('order.uploadScreenshot')}</label>
                <p className="text-xs text-gray-500 mb-2">{t('vpn.orderPage.uploadClearScreenshot')}</p>
                <PaymentUpload onUpload={(file) => setScreenshotFile(file)} expectedAmount={finalPrice} />
              </div>

              {submitError && <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{submitError}</div>}

              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <button
                  onClick={() => setStep('protocol')}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg border border-purple-500/20 text-white hover:bg-purple-500/10 transition-all disabled:opacity-50"
                >
                  {t('common.back')}
                </button>
                <button
                  onClick={async () => {
                    if (!screenshotFile || !selectedServer || !selectedProtocol) return;
                    setSubmitting(true);
                    setSubmitError('');
                    try {
                      const formData = new FormData();
                      formData.append('serverId', selectedServer);
                      formData.append('protocol', selectedProtocol);
                      formData.append('devices', String(plan.devices));
                      formData.append('months', String(plan.months));
                      formData.append('paymentMethod', paymentMethod);
                      formData.append('screenshot', screenshotFile);
                      if (couponCode) formData.append('couponCode', couponCode);

                      const res = await fetch('/api/vpn/orders', { method: 'POST', body: formData });
                      const data = await res.json();

                      if (data.success) setSubmitSuccess(true);
                      else setSubmitError(data.error || t('vpn.orderPage.failedToPlaceOrder'));
                    } catch {
                      setSubmitError(t('vpn.orderPage.networkErrorTryAgain'));
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  disabled={!screenshotFile || submitting}
                  className="px-4 py-2 rounded-lg font-semibold text-white bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t('vpn.orderPage.placingOrder')}
                    </>
                  ) : (
                    t('vpn.orderPage.placeOrder')
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VpnOrderPage() {
  const { t } = useLanguage();

  return (
    <Suspense
      fallback={
        <div className="min-h-screen pt-8 pb-12 px-4">
          <div className="max-w-xl mx-auto bg-[#12122a] border border-purple-500/20 rounded-2xl p-5 text-center text-gray-300">
            {t('common.loading')}
          </div>
        </div>
      }
    >
      <VpnOrderPageContent />
    </Suspense>
  );
}
