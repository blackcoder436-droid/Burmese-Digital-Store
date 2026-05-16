'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/language';

// ==========================================
// /migrate — Key Migration Page
// Allows old single-server VPN key holders to upgrade
// to the new multi-server format.
// ==========================================

type Step = 'input' | 'preview' | 'upgrading' | 'result' | 'error';

interface KeyDetails {
  token: string;
  username: string;
  devices: number;
  expiryTime: number | null;
  remainingDays: number | null;
  protocol: string;
  dataLimitGB: number;
}

interface UpgradeResult {
  subLink: string;
  servers: string[];
  username: string;
  devices: number;
  remainingDays: number;
  protocol: string;
}

export default function MigratePage() {
  const { tr } = useLanguage();

  const [step, setStep] = useState<Step>('input');
  const [inputValue, setInputValue] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [keyDetails, setKeyDetails] = useState<KeyDetails | null>(null);
  const [upgradeResult, setUpgradeResult] = useState<UpgradeResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCheck = async () => {
    if (!inputValue.trim()) return;
    setIsChecking(true);
    setErrorMessage('');

    try {
      const res = await fetch(
        `/api/migration/check?key=${encodeURIComponent(inputValue.trim())}`
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Unknown error occurred.');
        setStep('error');
        return;
      }

      setKeyDetails(data.data);
      setStep('preview');
    } catch {
      setErrorMessage('Network error. Please try again.');
      setStep('error');
    } finally {
      setIsChecking(false);
    }
  };

  const handleUpgrade = async () => {
    if (!keyDetails) return;
    setStep('upgrading');
    setErrorMessage('');

    try {
      const res = await fetch('/api/migration/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldKey: inputValue.trim() }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Migration failed.');
        setStep('error');
        return;
      }

      setUpgradeResult(data.data);
      setStep('result');
    } catch {
      setErrorMessage('Network error during migration. Please try again.');
      setStep('error');
    }
  };

  const handleCopy = async () => {
    if (!upgradeResult?.subLink) return;
    try {
      await navigator.clipboard.writeText(upgradeResult.subLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: document.execCommand is deprecated but still supported in most browsers
      // when the Clipboard API is unavailable (e.g. HTTP context, older iOS Safari).
      const el = document.createElement('textarea');
      el.value = upgradeResult.subLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy'); // eslint-disable-line @typescript-eslint/no-deprecated
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCheck();
    }
  };

  const handleReset = () => {
    setStep('input');
    setInputValue('');
    setKeyDetails(null);
    setUpgradeResult(null);
    setErrorMessage('');
    setCopied(false);
  };

  const formatDate = (ms: number | null) => {
    if (ms === 0) return tr('Unlimited', 'အကန့်အသတ်မရှိ');
    if (!ms) return 'N/A';
    return new Date(ms).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen py-10 px-4 flex flex-col items-center">
      {/* Page Header */}
      <div className="text-center mb-10 max-w-xl w-full">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-600/20 border border-purple-500/40 mb-4">
          <span className="text-3xl">🔄</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">
          {tr('Key Migration', 'Key ပြောင်းလဲမှု')}
        </h1>
        <p className="text-gray-400 text-sm leading-relaxed">
          {tr(
            'Upgrade your old single-server VPN key to the new multi-server format (JAN, SG1, SG2, SG3, SG4).',
            'သင့် Single-Server VPN Key ဟောင်းကို Multi-Server အသစ် (JAN, SG1, SG2, SG3, SG4) သို့ ပြောင်းလဲပါ။'
          )}
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8">
        {(['input', 'preview', 'result'] as const).map((s, i) => {
          const isActive = step === s || (step === 'upgrading' && s === 'result');
          const isDone =
            (s === 'input' && ['preview', 'upgrading', 'result'].includes(step)) ||
            (s === 'preview' && ['upgrading', 'result'].includes(step));
          return (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all
                  ${isDone ? 'bg-green-500 border-green-500 text-white' : isActive ? 'bg-purple-600 border-purple-500 text-white' : 'bg-transparent border-gray-600 text-gray-500'}`}
              >
                {isDone ? '✓' : i + 1}
              </div>
              {i < 2 && (
                <div
                  className={`w-10 h-0.5 transition-all ${isDone ? 'bg-green-500' : 'bg-gray-700'}`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Card Container */}
      <div className="w-full max-w-lg">

        {/* ── Step 1: Input ── */}
        {step === 'input' && (
          <div className="bg-[#12122a] border border-purple-500/20 rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-1">
              {tr('Step 1: Enter Your Old Sub-Link or Config Link', 'အဆင့် ၁: Sub-Link သို့မဟုတ် Config Link ဟောင်း ထည့်ပါ')}
            </h2>
            <p className="text-gray-400 text-sm mb-5">
              {tr(
                'Paste your old VPN subscription or config link (e.g. https://burmesedigital.store/api/vpn/sub/… or vmess://...)',
                'Sub-link သို့မဟုတ် Config Link ဟောင်းကို ထည့်ပါ (ဥပမာ - https://burmesedigital.store/api/vpn/sub/… သို့မဟုတ် vmess://...)'
              )}
            </p>
            <textarea
              rows={3}
              className="w-full bg-[#0a0a1a] border border-purple-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-400 resize-none"
              placeholder="https://burmesedigital.store/api/vpn/sub/... or vmess://..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
            />
            <button
              onClick={handleCheck}
              disabled={!inputValue.trim() || isChecking}
              className="mt-4 w-full py-3 rounded-xl font-semibold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isChecking
                ? tr('Checking…', 'စစ်ဆေးနေသည်…')
                : tr('🔍 Check Key', '🔍 Key စစ်ဆေးမည်')}
            </button>
          </div>
        )}

        {/* ── Step 2: Preview ── */}
        {step === 'preview' && keyDetails && (
          <div className="bg-[#12122a] border border-purple-500/20 rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-4">
              {tr('Step 2: Verify Key Details', 'အဆင့် ၂: Key အချက်အလက် စစ်ဆေးပါ')}
            </h2>

            <div className="space-y-3 mb-6">
              <InfoRow
                icon="🔑"
                label={tr('Key Name', 'Key အမည်')}
                value={keyDetails.username}
              />
              <InfoRow
                icon="📱"
                label={tr('Device Limit', 'Device အရေအတွက်')}
                value={`${keyDetails.devices} ${tr('device(s)', 'ကိရိယာ')}`}
              />
              <InfoRow
                icon="📅"
                label={tr('Expiry Date', 'သက်တမ်းကုန်မည့်ရက်')}
                value={formatDate(keyDetails.expiryTime)}
              />
              <InfoRow
                icon="⏳"
                label={tr('Remaining', 'ကျန်ရှိသက်တမ်း')}
                value={
                  keyDetails.expiryTime === 0
                    ? tr('Unlimited', 'အကန့်အသတ်မရှိ')
                    : keyDetails.remainingDays !== null
                    ? `${keyDetails.remainingDays} ${tr('days', 'ရက်')}`
                    : 'N/A'
                }
              />
              <InfoRow
                icon="📊"
                label={tr('Data Limit', 'ဒေတာ အသုံးပြုခွင့်')}
                value={
                  keyDetails.dataLimitGB === 0
                    ? tr('Unlimited', 'အကန့်အသတ်မရှိ')
                    : `${keyDetails.dataLimitGB} GB`
                }
              />
              <InfoRow
                icon="🌐"
                label={tr('Protocol', 'Protocol')}
                value={keyDetails.protocol.toUpperCase()}
              />
            </div>

            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl px-4 py-3 text-yellow-300 text-xs mb-5">
              ⚠️{' '}
              {tr(
                'After upgrading, your old sub-link will be permanently deleted. The new multi-server sub-link will have the same expiry date and device limit.',
                'Upgrade လုပ်ပြီးနောက် Sub-link ဟောင်းကို အပြီးတိုင် ဖျက်ပစ်မည်။ Multi-server Sub-link အသစ်တွင် သက်တမ်းနှင့် Device limit အတူတူပင် ဖြစ်မည်။'
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 py-3 rounded-xl font-semibold text-gray-300 border border-gray-600 hover:bg-gray-700/30 transition-all"
              >
                {tr('← Back', '← နောက်သို့')}
              </button>
              <button
                onClick={handleUpgrade}
                className="flex-[2] py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all"
              >
                {tr('🚀 Upgrade to Multi-Server', '🚀 Multi-Server သို့ ပြောင်းမည်')}
              </button>
            </div>
          </div>
        )}

        {/* ── Upgrading (loading) ── */}
        {step === 'upgrading' && (
          <div className="bg-[#12122a] border border-purple-500/20 rounded-2xl p-10 shadow-xl text-center">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            </div>
            <p className="text-white font-semibold">
              {tr('Migrating your key…', 'Key ပြောင်းလဲနေသည်…')}
            </p>
            <p className="text-gray-400 text-sm mt-2">
              {tr(
                'Provisioning new keys on all servers. This may take a moment.',
                'Server အားလုံးတွင် Key အသစ်များ ဖန်တီးနေသည်။ ခဏစောင့်ပါ။'
              )}
            </p>
          </div>
        )}

        {/* ── Step 3: Result ── */}
        {step === 'result' && upgradeResult && (
          <div className="bg-[#12122a] border border-green-500/30 rounded-2xl p-6 shadow-xl">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-500/20 border border-green-500/40 mb-3">
                <span className="text-3xl">✅</span>
              </div>
              <h2 className="text-xl font-bold text-green-400">
                {tr('Migration Successful!', 'ပြောင်းလဲမှု အောင်မြင်ပြီ!')}
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                {tr(
                  `Your key is now active on ${upgradeResult.servers.length} server(s).`,
                  `သင့် Key ကို Server ${upgradeResult.servers.length} ခုတွင် ဖွင့်ထားပြီး။`
                )}
              </p>
            </div>

            {/* Server badges */}
            <div className="flex flex-wrap gap-2 justify-center mb-5">
              {upgradeResult.servers.map((s) => (
                <span
                  key={s}
                  className="px-3 py-1 rounded-full bg-purple-600/20 border border-purple-500/30 text-purple-300 text-xs font-medium"
                >
                  🖥️ {s}
                </span>
              ))}
            </div>

            {/* New sub-link display */}
            <div className="bg-[#0a0a1a] border border-purple-500/20 rounded-xl p-4 mb-4">
              <p className="text-gray-400 text-xs mb-1 font-medium uppercase tracking-wider">
                {tr('New Multi-Server Sub-Link', 'Multi-Server Sub-Link အသစ်')}
              </p>
              <p className="text-white text-xs break-all font-mono leading-relaxed">
                {upgradeResult.subLink}
              </p>
            </div>

            <button
              onClick={handleCopy}
              className={`w-full py-3 rounded-xl font-semibold text-white transition-all mb-3
                ${copied ? 'bg-green-600 hover:bg-green-600' : 'bg-purple-600 hover:bg-purple-500'}`}
            >
              {copied
                ? tr('✓ Copied!', '✓ ကူးပြီးပြီ!')
                : tr('📋 Copy Sub-Link', '📋 Sub-Link ကူးယူမည်')}
            </button>

            <div className="space-y-2 mb-4">
              <InfoRow
                icon="📱"
                label={tr('Devices', 'Device')}
                value={`${upgradeResult.devices} ${tr('device(s)', 'ကိရိယာ')}`}
              />
              <InfoRow
                icon="⏳"
                label={tr('Remaining Days', 'ကျန်ရှိသက်တမ်း')}
                value={`${upgradeResult.remainingDays} ${tr('days', 'ရက်')}`}
              />
            </div>

            <button
              onClick={handleReset}
              className="w-full py-2.5 rounded-xl text-sm text-gray-400 border border-gray-700 hover:bg-gray-700/30 transition-all"
            >
              {tr('Migrate another key', 'Key အခြားတစ်ခု ပြောင်းမည်')}
            </button>
          </div>
        )}

        {/* ── Error ── */}
        {step === 'error' && (
          <div className="bg-[#12122a] border border-red-500/30 rounded-2xl p-6 shadow-xl text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-500/20 border border-red-500/40 mb-3">
              <span className="text-3xl">❌</span>
            </div>
            <h2 className="text-lg font-semibold text-red-400 mb-2">
              {tr('Error', 'အမှား')}
            </h2>
            <p className="text-gray-300 text-sm mb-5">{errorMessage}</p>
            <button
              onClick={handleReset}
              className="px-6 py-2.5 rounded-xl font-semibold text-white bg-purple-600 hover:bg-purple-500 transition-all"
            >
              {tr('← Try Again', '← ထပ်ကြိုးစားပါ')}
            </button>
          </div>
        )}
      </div>

      {/* Info note at the bottom */}
      <p className="mt-10 text-center text-gray-600 text-xs max-w-sm">
        {tr(
          'Each old key can only be migrated once. The old sub-link will stop working immediately after migration.',
          'Key ဟောင်းတစ်ခုချင်းကို တစ်ကြိမ်သာ ပြောင်းနိုင်သည်။ ပြောင်းလဲပြီးနောက် Sub-link ဟောင်းသည် ချက်ချင်းပင် အလုပ်မလုပ်တော့ပါ။'
        )}
      </p>
    </div>
  );
}

// ── Reusable info row ──
function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between bg-[#0a0a1a]/60 rounded-lg px-4 py-2.5">
      <span className="text-gray-400 text-sm flex items-center gap-2">
        <span>{icon}</span>
        {label}
      </span>
      <span className="text-white text-sm font-medium">{value}</span>
    </div>
  );
}
