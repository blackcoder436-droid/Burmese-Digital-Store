'use client';

import { useEffect, useState } from 'react';
import { Settings, Eye, EyeOff, Loader2, CheckCircle, AlertTriangle, CreditCard, Save, Database, Send, Radio, Trash2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/language';

interface PaymentAccount {
  method: string;
  accountName: string;
  accountNumber: string;
  qrImage: string | null;
  enabled: boolean;
}

interface BackupResult {
  collections: number;
  documents: number;
  size: string;
  duration: string;
}

interface WebhookInfo {
  url: string | null;
  pendingUpdateCount: number;
  lastErrorDate: string | null;
  lastErrorMessage: string | null;
}

const PAYMENT_METHODS = [
  { value: 'kpay', label: 'KBZ Pay', emoji: '🏦' },
  { value: 'wave', label: 'WaveMoney', emoji: '🌊' },
  { value: 'uabpay', label: 'UAB Pay', emoji: '💳' },
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
  const [backingUp, setBackingUp] = useState(false);
  const [lastBackup, setLastBackup] = useState<BackupResult | null>(null);
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null);
  const [loadingWebhook, setLoadingWebhook] = useState(false);
  const [settingWebhook, setSettingWebhook] = useState(false);
  const [removingWebhook, setRemovingWebhook] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchWebhookStatus();
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

  async function fetchWebhookStatus() {
    setLoadingWebhook(true);
    try {
      const res = await fetch('/api/admin/telegram-webhook');
      const data = await res.json();
      if (data.success) {
        setWebhookInfo(data.data);
      }
    } catch {
      // silent fail
    } finally {
      setLoadingWebhook(false);
    }
  }

  async function setupWebhook() {
    setSettingWebhook(true);
    try {
      const res = await fetch('/api/admin/telegram-webhook', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('Webhook registered ✓');
        fetchWebhookStatus();
      } else {
        toast.error(data.error || 'Failed to set webhook');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSettingWebhook(false);
    }
  }

  async function removeWebhook() {
    setRemovingWebhook(true);
    try {
      const res = await fetch('/api/admin/telegram-webhook', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Webhook removed');
        fetchWebhookStatus();
      } else {
        toast.error(data.error || 'Failed to remove webhook');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setRemovingWebhook(false);
    }
  }

  async function runBackup() {
    setBackingUp(true);
    setLastBackup(null);
    try {
      const res = await fetch('/api/admin/backup', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setLastBackup(data.data);
        toast.success('Backup sent to Telegram ✓');
      } else {
        toast.error(data.error || 'Backup failed');
      }
    } catch {
      toast.error('Network error — backup failed');
    } finally {
      setBackingUp(false);
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

      {/* Telegram Webhook Setup */}
      <div className="game-card p-6 sm:p-8">
        <div className="flex items-start gap-5">
          <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <Radio className="w-6 h-6 text-blue-400" />
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-lg font-bold text-white mb-1">
                  Telegram Webhook
                </h2>
                <p className="text-sm text-gray-400 max-w-lg">
                  Register a webhook so Telegram can send order approval/rejection callbacks to your server. Required for inline approve/reject buttons.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={setupWebhook}
                  disabled={settingWebhook || removingWebhook}
                  className="px-5 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 text-sm"
                >
                  {settingWebhook ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      {webhookInfo?.url ? 'Update Webhook' : 'Register Webhook'}
                    </>
                  )}
                </button>
                {webhookInfo?.url && (
                  <button
                    onClick={removeWebhook}
                    disabled={removingWebhook || settingWebhook}
                    className="px-3 py-2.5 rounded-xl font-semibold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
                    title="Remove webhook"
                  >
                    {removingWebhook ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Webhook Status */}
            {loadingWebhook ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Checking webhook status...
              </div>
            ) : webhookInfo ? (
              <div className="mt-4 space-y-2">
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  webhookInfo.url
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                  {webhookInfo.url ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      Active
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Not registered
                    </>
                  )}
                </div>
                {webhookInfo.url && (
                  <p className="text-xs text-gray-500 font-mono break-all">{webhookInfo.url}</p>
                )}
                {webhookInfo.lastErrorMessage && (
                  <p className="text-xs text-red-400">Last error: {webhookInfo.lastErrorMessage}</p>
                )}
                {webhookInfo.pendingUpdateCount > 0 && (
                  <p className="text-xs text-amber-400">Pending updates: {webhookInfo.pendingUpdateCount}</p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Database Backup to Telegram */}
      <div className="game-card p-6 sm:p-8">
        <div className="flex items-start gap-5">
          <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            <Database className="w-6 h-6 text-cyan-400" />
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-lg font-bold text-white mb-1">
                  Database Backup
                </h2>
                <p className="text-sm text-gray-400 max-w-lg">
                  Export all MongoDB collections as JSON and send to your Telegram channel. Useful for manual snapshots before major changes.
                </p>
              </div>

              <button
                onClick={runBackup}
                disabled={backingUp}
                className="px-5 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 text-sm"
              >
                {backingUp ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Backing up...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Backup to Telegram
                  </>
                )}
              </button>
            </div>

            {lastBackup && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Collections', value: lastBackup.collections, color: 'text-cyan-400' },
                  { label: 'Documents', value: lastBackup.documents.toLocaleString(), color: 'text-purple-400' },
                  { label: 'Size', value: lastBackup.size, color: 'text-emerald-400' },
                  { label: 'Duration', value: lastBackup.duration, color: 'text-amber-400' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-[#0a0a1f]/70 rounded-xl px-3 py-2.5 border border-purple-500/10">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">{stat.label}</p>
                    <p className={`text-lg font-bold ${stat.color} mt-0.5`}>{stat.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
