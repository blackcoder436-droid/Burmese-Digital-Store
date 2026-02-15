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
  { value: 'trojan', label: 'Trojan', desc: 'Best for most ISPs' },
  { value: 'vless', label: 'VLESS', desc: 'Fast and stable' },
  { value: 'vmess', label: 'VMess', desc: 'Good compatibility' },
  { value: 'shadowsocks', label: 'Shadowsocks', desc: 'Lightweight option' },
];

function VpnOrderPageContent() {
  const { tr } = useLanguage();
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
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

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
      <div className="min-h-screen pt-20 pb-10 px-4">
        <div className="max-w-xl mx-auto bg-[#12122a] border border-purple-500/20 rounded-2xl p-5 text-center">
          <h1 className="text-xl font-bold text-white mb-2">{tr('Invalid plan', 'Plan မမှန်ကန်ပါ')}</h1>
          <p className="text-sm text-gray-400 mb-4">{tr('Please choose a plan from pricing cards.', 'Pricing cards မှ plan ကိုပြန်ရွေးပါ။')}</p>
          <button
            onClick={() => router.push('/vpn#pricing')}
            className="px-5 py-2.5 rounded-lg font-semibold text-white bg-gradient-to-r from-purple-600 to-cyan-500"
          >
            {tr('Back to Pricing', 'စျေးနှုန်းသို့ ပြန်သွားမည်')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 sm:pt-20 pb-8 sm:pb-10 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => router.push('/vpn#pricing')} className="text-sm text-purple-400 hover:text-purple-300 mb-3">
          ← {tr('Back to pricing', 'စျေးနှုန်းသို့ ပြန်သွားမည်')}
        </button>

        <div className="bg-[#12122a] border border-purple-500/20 rounded-2xl p-3.5 sm:p-5">
          {!submitSuccess && (
            <div className="mb-4 flex items-center gap-2 text-[11px] sm:text-xs text-gray-400">
              <span className={`px-2 py-1 rounded-md border ${step === 'server' ? 'text-purple-300 border-purple-500/40 bg-purple-500/10' : 'border-purple-500/20'}`}>1. {tr('Server', 'Server')}</span>
              <span className="opacity-60">→</span>
              <span className={`px-2 py-1 rounded-md border ${step === 'protocol' ? 'text-purple-300 border-purple-500/40 bg-purple-500/10' : 'border-purple-500/20'}`}>2. {tr('Protocol', 'Protocol')}</span>
              <span className="opacity-60">→</span>
              <span className={`px-2 py-1 rounded-md border ${step === 'payment' ? 'text-purple-300 border-purple-500/40 bg-purple-500/10' : 'border-purple-500/20'}`}>3. {tr('Payment', 'ငွေပေးချေမှု')}</span>
            </div>
          )}

          {submitSuccess ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 mx-auto mb-3 bg-emerald-500/20 rounded-full flex items-center justify-center">
                <span className="text-2xl">✅</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2">{tr('Order Placed Successfully!', 'အော်ဒါ အောင်မြင်စွာ တင်ပြီးပါပြီ!')}</h3>
              <p className="text-sm text-gray-400 mb-5">
                {tr('Your VPN order is being verified. You will receive your VPN key after admin approval.', 'သင့် VPN order ကို စစ်ဆေးနေပါသည်။ Admin approve ပြီးရင် VPN key ရရှိပါမည်။')}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <button onClick={() => router.push('/account/orders')} className="px-5 py-2.5 rounded-lg font-semibold text-white bg-gradient-to-r from-purple-600 to-cyan-500 transition-all">
                  {tr('View My Orders', 'ကျွန်ုပ်၏ အော်ဒါများ')}
                </button>
                <button onClick={() => router.push('/vpn')} className="px-5 py-2.5 rounded-lg border border-purple-500/20 text-white hover:bg-purple-500/10 transition-all">
                  {tr('Close', 'ပိတ်မည်')}
                </button>
              </div>
            </div>
          ) : step === 'server' ? (
            <>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-1">{tr('Choose Server', 'Server ရွေးချယ်ပါ')}</h3>
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
                        Online
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <button onClick={() => router.push('/vpn#pricing')} className="px-4 py-2 rounded-lg border border-purple-500/20 text-white hover:bg-purple-500/10 transition-all">
                  {tr('Cancel', 'မလုပ်တော့ပါ')}
                </button>
                <button
                  onClick={() => { if (selectedServer) setStep('protocol'); }}
                  disabled={!selectedServer}
                  className="px-4 py-2 rounded-lg font-semibold text-white bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {tr('Next: Protocol', 'နောက်တစ်ဆင့်: Protocol')}
                </button>
              </div>
            </>
          ) : step === 'protocol' ? (
            <>
              <button onClick={() => setStep('server')} className="text-sm text-purple-400 hover:text-purple-300 mb-3 flex items-center gap-1">
                ← {tr('Back to server selection', 'Server ရွေးချယ်ရန် ပြန်သွားမည်')}
              </button>

              <h3 className="text-lg sm:text-xl font-bold text-white mb-1">{tr('Choose Protocol', 'Protocol ရွေးချယ်ပါ')}</h3>
              <p className="text-xs sm:text-sm text-gray-400 mb-4">{tr('Trojan is recommended for most users', 'အသုံးများသူများအတွက် Trojan ကို အကြံပြုပါသည်')}</p>

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
                    <p className="text-xs text-gray-400 mt-0.5">{protocol.desc}</p>
                  </button>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <button onClick={() => setStep('server')} className="px-4 py-2 rounded-lg border border-purple-500/20 text-white hover:bg-purple-500/10 transition-all">
                  {tr('Back', 'နောက်သို့')}
                </button>
                <button onClick={() => setStep('payment')} className="px-4 py-2 rounded-lg font-semibold text-white bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 transition-all">
                  {tr('Continue to Payment', 'ငွေပေးချေမှုသို့ ဆက်သွားမည်')}
                </button>
              </div>
            </>
          ) : (
            <>
              <button onClick={() => setStep('protocol')} className="text-sm text-purple-400 hover:text-purple-300 mb-3 flex items-center gap-1">
                ← {tr('Back to protocol selection', 'Protocol ရွေးချယ်ရန် ပြန်သွားမည်')}
              </button>

              <h3 className="text-lg sm:text-xl font-bold text-white mb-1">{tr('Payment', 'ငွေပေးချေမှု')}</h3>
              <p className="text-sm text-gray-400 mb-4">{tr('Confirm details and upload payment proof', 'အချက်အလက်စစ်ပြီး ငွေလွှဲ screenshot တင်ပါ')}</p>

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
                <p className="text-lg sm:text-xl font-extrabold text-purple-400 shrink-0">{plan.price.toLocaleString()} <span className="text-xs sm:text-sm text-gray-400">Ks</span></p>
              </div>

              <div className="flex items-center gap-3 bg-[#0a0a1f]/70 rounded-2xl px-3.5 py-3 mb-4 border border-amber-500/20">
                <span className="text-base mt-0.5">💳</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-amber-400/80 mb-1 tracking-wide uppercase">{tr('Transfer to', 'ငွေလွှဲရန်')}</p>
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
                  {copiedAccount ? tr('Copied', 'ကူးပြီး') : tr('Copy', 'ကူး')}
                </button>
              </div>

              <div className="mb-4">
                <label className="text-xs text-gray-400 mb-2 block font-medium">{tr('Payment Method', 'ငွေပေးချေနည်း')}</label>
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
                <label className="text-xs text-gray-400 mb-2 block font-medium">{tr('Payment Screenshot', 'ငွေပေးချေမှု Screenshot')}</label>
                <p className="text-xs text-gray-500 mb-2">{tr('Upload clear screenshot with account, amount and time visible', 'Account, amount, time တွေထင်ရှားတဲ့ screenshot တင်ပါ')}</p>
                <PaymentUpload onUpload={(file) => setScreenshotFile(file)} expectedAmount={plan.price} />
              </div>

              <div className="mb-4">
                <label className="text-xs text-gray-400 mb-2 block font-medium">{tr('Coupon Code (optional)', 'Coupon Code (ရှိလျှင်)')}</label>
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="e.g. VPN20"
                  className="w-full px-3 py-2 bg-[#0a0a1f] border border-purple-500/15 rounded-lg text-sm text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none transition-all"
                />
              </div>

              {submitError && <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{submitError}</div>}

              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <button
                  onClick={() => setStep('protocol')}
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg border border-purple-500/20 text-white hover:bg-purple-500/10 transition-all disabled:opacity-50"
                >
                  {tr('Back', 'နောက်သို့')}
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
                      else setSubmitError(data.error || 'Failed to place order');
                    } catch {
                      setSubmitError('Network error. Please try again.');
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
                      {tr('Placing Order...', 'အော်ဒါ တင်နေသည်...')}
                    </>
                  ) : (
                    tr('Place Order', 'အော်ဒါ တင်မည်')
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
  return (
    <Suspense
      fallback={
        <div className="min-h-screen pt-24 pb-12 px-4">
          <div className="max-w-xl mx-auto bg-[#12122a] border border-purple-500/20 rounded-2xl p-5 text-center text-gray-300">
            Loading...
          </div>
        </div>
      }
    >
      <VpnOrderPageContent />
    </Suspense>
  );
}
