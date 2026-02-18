'use client';

import { useEffect, useState } from 'react';
import { Settings, Eye, EyeOff, Loader2, CheckCircle, AlertTriangle, CreditCard, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/language';

interface PaymentAccount {
  method: string;
  accountName: string;
  accountNumber: string;
  qrImage: string | null;
  enabled: boolean;
}

const PAYMENT_METHODS = [
  { value: 'kpay', label: 'KBZ Pay', emoji: '🏦' },
  { value: 'wave', label: 'WaveMoney', emoji: '🌊' },
  { value: 'cbpay', label: 'CB Pay', emoji: '💳' },
  { value: 'ayapay', label: 'AYA Pay', emoji: '🏧' },
];

export default function AdminSettingsPage() {
  const { t } = useLanguage();
  const [ocrEnabled, setOcrEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>(
    PAYMENT_METHODS.map((m) => ({
      method: m.value,
      accountName: '',
      accountNumber: '',
      qrImage: null,
      enabled: true,
    }))
  );
  const [savingPayment, setSavingPayment] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (data.success) {
        setOcrEnabled(data.data.settings.ocrEnabled);
        if (data.data.settings.paymentAccounts?.length > 0) {
          // Merge with default methods to ensure all 4 exist
          const saved = data.data.settings.paymentAccounts;
          const merged = PAYMENT_METHODS.map((m) => {
            const found = saved.find((s: PaymentAccount) => s.method === m.value);
            return found || { method: m.value, accountName: '', accountNumber: '', qrImage: null, enabled: true };
          });
          setPaymentAccounts(merged);
        }
      }
    } catch {
      toast.error(t('admin.settingsPage.failedLoadSettings'));
    } finally {
      setLoading(false);
    }
  }

  async function toggleOcr() {
    const newValue = !ocrEnabled;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ocrEnabled: newValue }),
      });
      const data = await res.json();
      if (data.success) {
        setOcrEnabled(newValue);
        toast.success(
          newValue
            ? t('admin.settingsPage.ocrEnabled')
            : t('admin.settingsPage.ocrDisabled')
        );
      } else {
        toast.error(data.error || t('admin.settingsPage.failedUpdate'));
      }
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  function updatePaymentAccount(index: number, field: keyof PaymentAccount, value: string | boolean) {
    setPaymentAccounts((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  async function savePaymentAccounts() {
    setSavingPayment(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentAccounts }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t('admin.settingsPage.paymentAccountsSaved'));
      } else {
        toast.error(data.error || t('admin.settingsPage.failedSave'));
      }
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSavingPayment(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="heading-lg">{t('admin.settings')}</h1>

      {/* OCR Toggle Card */}
      <div className="game-card p-6 sm:p-8">
        <div className="flex items-start gap-5">
          <div className={`p-3.5 rounded-xl ${ocrEnabled ? 'bg-green-500/10 border border-green-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
            {ocrEnabled ? (
              <Eye className="w-6 h-6 text-green-400" />
            ) : (
              <EyeOff className="w-6 h-6 text-amber-400" />
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-lg font-bold text-white mb-1">
                  {t('admin.settingsPage.ocrPaymentVerification')}
                </h2>
                <p className="text-sm text-gray-400 max-w-lg">
                  {ocrEnabled
                    ? t('admin.settingsPage.ocrEnabledDescription')
                    : t('admin.settingsPage.ocrDisabledDescription')}
                </p>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={toggleOcr}
                disabled={saving}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-[#0a0a1a] ${
                  ocrEnabled ? 'bg-green-500' : 'bg-gray-600'
                }`}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin absolute left-1/2 -translate-x-1/2" />
                ) : (
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                      ocrEnabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                )}
              </button>
            </div>

            {/* Status indicator */}
            <div className={`mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${
              ocrEnabled
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}>
              {ocrEnabled ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5" />
                  {t('admin.settingsPage.autoVerificationActive')}
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {t('admin.settingsPage.manualReviewMode')}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="game-card p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-400" />
            </div>
            <h3 className="text-sm font-bold text-white">
              {t('admin.settingsPage.whenOcrOn')}
            </h3>
          </div>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">•</span>
              {t('admin.settingsPage.onAutoScanned')}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">•</span>
              {t('admin.settingsPage.onHighConfidence')}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">•</span>
              {t('admin.settingsPage.onLowConfidence')}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">•</span>
              {t('admin.settingsPage.onStatusFlow')}
            </li>
          </ul>
        </div>

        <div className="game-card p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <h3 className="text-sm font-bold text-white">
              {t('admin.settingsPage.whenOcrOff')}
            </h3>
          </div>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-start gap-2">
              <span className="text-amber-400 mt-0.5">•</span>
              {t('admin.settingsPage.offNoAutoScan')}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400 mt-0.5">•</span>
              {t('admin.settingsPage.offAllPending')}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400 mt-0.5">•</span>
              {t('admin.settingsPage.offManualCheck')}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400 mt-0.5">•</span>
              {t('admin.settingsPage.offStatusFlow')}
            </li>
          </ul>
        </div>
      </div>

      {/* Payment Accounts Management */}
      <div className="game-card p-6 sm:p-8">
        <div className="flex items-start gap-5 mb-6">
          <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <CreditCard className="w-6 h-6 text-purple-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-white mb-1">
              {t('admin.settingsPage.paymentAccounts')}
            </h2>
            <p className="text-sm text-gray-400 max-w-lg">
              {t('admin.settingsPage.paymentAccountsDescription')}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {paymentAccounts.map((account, index) => {
            const methodInfo = PAYMENT_METHODS.find((m) => m.value === account.method);
            return (
              <div
                key={account.method}
                className={`p-5 rounded-xl border transition-all ${
                  account.enabled
                    ? 'bg-dark-800/50 border-dark-600'
                    : 'bg-dark-900/50 border-dark-700 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{methodInfo?.emoji}</span>
                    <h3 className="text-base font-bold text-white">{methodInfo?.label}</h3>
                  </div>
                  <button
                    onClick={() => updatePaymentAccount(index, 'enabled', !account.enabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                      account.enabled ? 'bg-green-500' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                        account.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                {account.enabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">
                        {t('admin.settingsPage.accountName')}
                      </label>
                      <input
                        type="text"
                        value={account.accountName}
                        onChange={(e) => updatePaymentAccount(index, 'accountName', e.target.value)}
                        placeholder={t('admin.settingsPage.accountNamePlaceholder')}
                        className="input-field text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">
                        {t('admin.settingsPage.phoneOrAccountNumber')}
                      </label>
                      <input
                        type="text"
                        value={account.accountNumber}
                        onChange={(e) => updatePaymentAccount(index, 'accountNumber', e.target.value)}
                        placeholder="09xxxxxxxxx"
                        className="input-field text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end mt-6 pt-5 border-t border-dark-700">
          <button
            onClick={savePaymentAccounts}
            disabled={savingPayment}
            className="btn-electric text-sm flex items-center gap-2"
          >
            {savingPayment ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {t('admin.settingsPage.savePaymentAccounts')}
          </button>
        </div>
      </div>
    </div>
  );
}
