'use client';

import { useEffect, useState } from 'react';
import {
  Settings,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  AlertTriangle,
  CreditCard,
  Save,
  Database,
  Send,
  Radio,
  Trash2,
  RefreshCw,
  Plus,
  Edit,
  ToggleLeft,
  ToggleRight,
  GripVertical,
  X,
} from 'lucide-react';
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

interface Gateway {
  _id: string;
  name: string;
  code: string;
  type: 'manual' | 'online';
  category: 'myanmar' | 'crypto';
  accountName: string;
  accountNumber: string;
  qrImage?: string;
  instructions?: string;
  enabled: boolean;
  displayOrder: number;
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

const DEFAULT_GATEWAY_FORM = {
  name: '',
  code: '',
  type: 'manual' as 'manual' | 'online',
  category: 'myanmar' as 'myanmar' | 'crypto',
  accountName: '',
  accountNumber: '',
  qrImage: '',
  instructions: '',
  enabled: true,
  displayOrder: 0,
};

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
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [loadingGateways, setLoadingGateways] = useState(false);
  const [savingGateway, setSavingGateway] = useState(false);
  const [showGatewayForm, setShowGatewayForm] = useState(false);
  const [editingGateway, setEditingGateway] = useState<string | null>(null);
  const [gatewayForm, setGatewayForm] = useState(DEFAULT_GATEWAY_FORM);

  useEffect(() => {
    fetchSettings();
    fetchWebhookStatus();
    fetchGateways();
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

  async function fetchGateways() {
    setLoadingGateways(true);
    try {
      const res = await fetch('/api/admin/payment-gateways');
      const data = await res.json();
      if (data.success) {
        setGateways(data.data.gateways || []);
      }
    } catch {
      toast.error(t('admin.paymentGateways.fetchFailed'));
    } finally {
      setLoadingGateways(false);
    }
  }

  function openGatewayCreate() {
    setEditingGateway(null);
    setGatewayForm(DEFAULT_GATEWAY_FORM);
    setShowGatewayForm(true);
  }

  function openGatewayEdit(gateway: Gateway) {
    setEditingGateway(gateway._id);
    setGatewayForm({
      name: gateway.name,
      code: gateway.code,
      type: gateway.type,
      category: gateway.category || 'myanmar',
      accountName: gateway.accountName || '',
      accountNumber: gateway.accountNumber || '',
      qrImage: gateway.qrImage || '',
      instructions: gateway.instructions || '',
      enabled: gateway.enabled,
      displayOrder: gateway.displayOrder || 0,
    });
    setShowGatewayForm(true);
  }

  async function saveGateway() {
    if (!gatewayForm.name.trim() || !gatewayForm.code.trim()) {
      toast.error(t('admin.paymentGateways.nameCodeRequired'));
      return;
    }

    setSavingGateway(true);
    try {
      const url = editingGateway ? `/api/admin/payment-gateways/${editingGateway}` : '/api/admin/payment-gateways';
      const method = editingGateway ? 'PUT' : 'POST';
      const payload = editingGateway
        ? {
            name: gatewayForm.name.trim(),
            type: gatewayForm.type,
            category: gatewayForm.category,
            accountName: gatewayForm.accountName,
            accountNumber: gatewayForm.accountNumber,
            qrImage: gatewayForm.qrImage || null,
            instructions: gatewayForm.instructions,
            enabled: gatewayForm.enabled,
            displayOrder: gatewayForm.displayOrder,
          }
        : {
            ...gatewayForm,
            name: gatewayForm.name.trim(),
            code: gatewayForm.code.trim().toLowerCase(),
            qrImage: gatewayForm.qrImage || null,
          };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(editingGateway ? t('admin.paymentGateways.updated') : t('admin.paymentGateways.created'));
        setShowGatewayForm(false);
        setEditingGateway(null);
        setGatewayForm(DEFAULT_GATEWAY_FORM);
        fetchGateways();
      } else {
        toast.error(data.error || t('admin.paymentGateways.saveFailed'));
      }
    } catch {
      toast.error(t('admin.paymentGateways.somethingWrong'));
    } finally {
      setSavingGateway(false);
    }
  }

  async function deleteGateway(id: string, name: string) {
    if (!confirm(t('admin.paymentGateways.confirmDelete').replace('{name}', name))) return;
    try {
      const res = await fetch(`/api/admin/payment-gateways/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success(t('admin.paymentGateways.deleted'));
        fetchGateways();
      } else {
        toast.error(data.error || t('admin.paymentGateways.deleteFailed'));
      }
    } catch {
      toast.error(t('admin.paymentGateways.somethingWrong'));
    }
  }

  async function toggleGateway(gateway: Gateway) {
    try {
      const res = await fetch(`/api/admin/payment-gateways/${gateway._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !gateway.enabled }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(gateway.enabled ? t('admin.paymentGateways.disabled') : t('admin.paymentGateways.enabled'));
        fetchGateways();
      } else {
        toast.error(data.error || t('admin.paymentGateways.somethingWrong'));
      }
    } catch {
      toast.error(t('admin.paymentGateways.somethingWrong'));
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
      <h1 className="heading-lg flex items-center gap-3">
        <Settings className="w-7 h-7 text-purple-400" />
        {t('admin.settings')}
      </h1>

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

      {/* Payment Gateways Management */}
      <div id="payment-gateways" className="game-card p-6 sm:p-8">
        <div className="flex items-start gap-5 mb-6">
          <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            <CreditCard className="w-6 h-6 text-cyan-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-lg font-bold text-white mb-1">
                  {t('admin.paymentGateways.title')}
                </h2>
                <p className="text-sm text-gray-400 max-w-lg">
                  {t('admin.paymentGateways.createFirstHint')}
                </p>
              </div>
              <button
                onClick={openGatewayCreate}
                className="px-4 py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 transition-all flex items-center gap-2 text-sm"
              >
                <Plus className="w-4 h-4" />
                {t('admin.paymentGateways.addGateway')}
              </button>
            </div>
          </div>
        </div>

        {loadingGateways ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        ) : gateways.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
            <CreditCard className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">{t('admin.paymentGateways.noGateways')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.03] text-left text-xs uppercase tracking-[0.2em] text-gray-500">
                  <th className="px-4 py-3 font-semibold w-10">#</th>
                  <th className="px-4 py-3 font-semibold">{t('admin.paymentGateways.gateway')}</th>
                  <th className="px-4 py-3 font-semibold">{t('admin.paymentGateways.code')}</th>
                  <th className="px-4 py-3 font-semibold">{t('admin.paymentGateways.type')}</th>
                  <th className="px-4 py-3 font-semibold">{t('admin.paymentGateways.category')}</th>
                  <th className="px-4 py-3 font-semibold">{t('admin.paymentGateways.account')}</th>
                  <th className="px-4 py-3 font-semibold">{t('admin.productsPage.status')}</th>
                  <th className="px-4 py-3 font-semibold text-right">{t('admin.productsPage.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {gateways.map((gw, index) => (
                  <tr key={gw._id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="px-4 py-3 text-gray-500">
                      <GripVertical className="w-4 h-4 inline" /> {index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{gw.name}</div>
                      {gw.instructions && <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[220px]">{gw.instructions}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs rounded bg-white/5 px-2 py-1 text-cyan-300">{gw.code}</code>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                        gw.type === 'manual'
                          ? 'border-blue-500/20 bg-blue-500/10 text-blue-300'
                          : 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300'
                      }`}>
                        {gw.type === 'manual' ? '💳 Manual' : '🌐 Online'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                        gw.category === 'crypto'
                          ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                          : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                      }`}>
                        {gw.category === 'crypto' ? '₿ Crypto' : '🇲🇲 Myanmar'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {gw.accountName && <div className="text-white">{gw.accountName}</div>}
                      {gw.accountNumber && <div className="text-xs text-gray-400 font-mono">{gw.accountNumber}</div>}
                      {!gw.accountName && !gw.accountNumber && <span className="text-xs text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleGateway(gw)}
                        className="inline-flex items-center gap-1.5"
                        title={gw.enabled ? 'Disable' : 'Enable'}
                      >
                        {gw.enabled ? <ToggleRight className="w-6 h-6 text-green-400" /> : <ToggleLeft className="w-6 h-6 text-gray-500" />}
                        <span className={`text-xs font-semibold ${gw.enabled ? 'text-green-400' : 'text-gray-500'}`}>
                          {gw.enabled ? 'ON' : 'OFF'}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openGatewayEdit(gw)}
                          className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteGateway(gw._id, gw.name)}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Gateway Form Modal */}
      {showGatewayForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="game-card w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="heading-sm">
                {editingGateway ? t('admin.paymentGateways.editGateway') : t('admin.paymentGateways.addNewGateway')}
              </h2>
              <button
                onClick={() => {
                  setShowGatewayForm(false);
                  setEditingGateway(null);
                  setGatewayForm(DEFAULT_GATEWAY_FORM);
                }}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-dark-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-300 block mb-2">{t('admin.paymentGateways.gatewayName')} *</label>
                  <input
                    type="text"
                    value={gatewayForm.name}
                    onChange={(e) => setGatewayForm({ ...gatewayForm, name: e.target.value })}
                    placeholder="KBZ Pay"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300 block mb-2">{t('admin.paymentGateways.code')} *</label>
                  <input
                    type="text"
                    value={gatewayForm.code}
                    onChange={(e) => setGatewayForm({ ...gatewayForm, code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                    placeholder="kpay"
                    className="input-field font-mono"
                    disabled={!!editingGateway}
                  />
                  {editingGateway && (
                    <p className="text-xs text-gray-500 mt-1">{t('admin.paymentGateways.codeReadonly')}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-gray-300 block mb-2">{t('admin.paymentGateways.type')}</label>
                  <select
                    value={gatewayForm.type}
                    onChange={(e) => setGatewayForm({ ...gatewayForm, type: e.target.value as 'manual' | 'online' })}
                    className="input-field"
                  >
                    <option value="manual">💳 {t('admin.paymentGateways.typeManual')}</option>
                    <option value="online">🌐 {t('admin.paymentGateways.typeOnline')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-300 block mb-2">{t('admin.paymentGateways.category')}</label>
                  <select
                    value={gatewayForm.category}
                    onChange={(e) => setGatewayForm({ ...gatewayForm, category: e.target.value as 'myanmar' | 'crypto' })}
                    className="input-field"
                  >
                    <option value="myanmar">🇲🇲 {t('admin.paymentGateways.categoryMyanmar')}</option>
                    <option value="crypto">₿ {t('admin.paymentGateways.categoryCrypto')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-300 block mb-2">{t('admin.paymentGateways.displayOrder')}</label>
                  <input
                    type="number"
                    value={gatewayForm.displayOrder}
                    onChange={(e) => setGatewayForm({ ...gatewayForm, displayOrder: Number(e.target.value) })}
                    className="input-field"
                    min={0}
                  />
                </div>
              </div>

              {gatewayForm.type === 'manual' && (
                <>
                  <div>
                    <label className="text-sm text-gray-300 block mb-2">{t('admin.paymentGateways.accountName')}</label>
                    <input
                      type="text"
                      value={gatewayForm.accountName}
                      onChange={(e) => setGatewayForm({ ...gatewayForm, accountName: e.target.value })}
                      placeholder="Aung Aung"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-300 block mb-2">{t('admin.paymentGateways.accountNumber')}</label>
                    <input
                      type="text"
                      value={gatewayForm.accountNumber}
                      onChange={(e) => setGatewayForm({ ...gatewayForm, accountNumber: e.target.value })}
                      placeholder="09xxxxxxxxx"
                      className="input-field font-mono"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-sm text-gray-300 block mb-2">QR Image URL</label>
                <input
                  type="text"
                  value={gatewayForm.qrImage}
                  onChange={(e) => setGatewayForm({ ...gatewayForm, qrImage: e.target.value })}
                  placeholder="https://..."
                  className="input-field"
                />
              </div>

              <div>
                <label className="text-sm text-gray-300 block mb-2">{t('admin.paymentGateways.instructions')}</label>
                <textarea
                  rows={2}
                  value={gatewayForm.instructions}
                  onChange={(e) => setGatewayForm({ ...gatewayForm, instructions: e.target.value })}
                  placeholder={t('admin.paymentGateways.instructionsPlaceholder')}
                  className="input-field resize-none"
                />
              </div>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={gatewayForm.enabled}
                  onChange={(e) => setGatewayForm({ ...gatewayForm, enabled: e.target.checked })}
                  className="w-5 h-5 rounded-lg border-purple-500/30 bg-[#12122a] text-purple-500 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-300">{t('admin.paymentGateways.enabledLabel')}</span>
              </label>

              <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
                <button
                  onClick={() => {
                    setShowGatewayForm(false);
                    setEditingGateway(null);
                    setGatewayForm(DEFAULT_GATEWAY_FORM);
                  }}
                  className="btn-primary text-sm"
                >
                  {t('admin.productsPage.cancel')}
                </button>
                <button
                  onClick={saveGateway}
                  disabled={savingGateway}
                  className="btn-electric text-sm flex items-center space-x-2"
                >
                  {savingGateway ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>{editingGateway ? t('admin.productsPage.update') : t('admin.productsPage.create')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
