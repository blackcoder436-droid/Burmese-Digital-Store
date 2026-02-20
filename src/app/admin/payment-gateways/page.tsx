'use client';

import { useEffect, useState } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  Loader2,
  CreditCard,
  GripVertical,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/language';

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

const defaultForm = {
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

export default function PaymentGatewaysPage() {
  const { t } = useLanguage();
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchGateways();
  }, []);

  async function fetchGateways() {
    try {
      const res = await fetch('/api/admin/payment-gateways');
      const data = await res.json();
      if (data.success) setGateways(data.data.gateways);
    } catch {
      toast.error(t('admin.paymentGateways.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!form.name || !form.code) {
      toast.error(t('admin.paymentGateways.nameCodeRequired'));
      return;
    }

    setSaving(true);
    try {
      const url = editing
        ? `/api/admin/payment-gateways/${editing}`
        : '/api/admin/payment-gateways';
      const method = editing ? 'PUT' : 'POST';

      const payload = editing
        ? { name: form.name, type: form.type, category: form.category, accountName: form.accountName, accountNumber: form.accountNumber, qrImage: form.qrImage || null, instructions: form.instructions, enabled: form.enabled, displayOrder: form.displayOrder }
        : { ...form, qrImage: form.qrImage || null };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(
          editing
            ? t('admin.paymentGateways.updated')
            : t('admin.paymentGateways.created')
        );
        setShowForm(false);
        setEditing(null);
        setForm(defaultForm);
        fetchGateways();
      } else {
        toast.error(data.error || t('admin.paymentGateways.saveFailed'));
      }
    } catch {
      toast.error(t('admin.paymentGateways.somethingWrong'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
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

  async function handleToggle(gateway: Gateway) {
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
      }
    } catch {
      toast.error(t('admin.paymentGateways.somethingWrong'));
    }
  }

  function startEdit(gw: Gateway) {
    setForm({
      name: gw.name,
      code: gw.code,
      type: gw.type,
      category: gw.category || 'myanmar',
      accountName: gw.accountName || '',
      accountNumber: gw.accountNumber || '',
      qrImage: gw.qrImage || '',
      instructions: gw.instructions || '',
      enabled: gw.enabled,
      displayOrder: gw.displayOrder || 0,
    });
    setEditing(gw._id);
    setShowForm(true);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="heading-lg">{t('admin.paymentGateways.title')}</h1>
        <button
          onClick={() => {
            setShowForm(true);
            setEditing(null);
            setForm(defaultForm);
          }}
          className="btn-electric text-sm flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>{t('admin.paymentGateways.addGateway')}</span>
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="game-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="heading-sm">
                {editing ? t('admin.paymentGateways.editGateway') : t('admin.paymentGateways.addNewGateway')}
              </h2>
              <button
                onClick={() => { setShowForm(false); setEditing(null); }}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-dark-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-300 block mb-2">
                    {t('admin.paymentGateways.gatewayName')} *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="KBZ Pay"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300 block mb-2">
                    {t('admin.paymentGateways.code')} *
                  </label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                    placeholder="kpay"
                    className="input-field font-mono"
                    disabled={!!editing}
                  />
                  {editing && (
                    <p className="text-xs text-gray-500 mt-1">{t('admin.paymentGateways.codeReadonly')}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-gray-300 block mb-2">
                    {t('admin.paymentGateways.type')}
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as 'manual' | 'online' })}
                    className="input-field"
                  >
                    <option value="manual">💳 {t('admin.paymentGateways.typeManual')}</option>
                    <option value="online">🌐 {t('admin.paymentGateways.typeOnline')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-300 block mb-2">
                    {t('admin.paymentGateways.category')}
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value as 'myanmar' | 'crypto' })}
                    className="input-field"
                  >
                    <option value="myanmar">🇲🇲 {t('admin.paymentGateways.categoryMyanmar')}</option>
                    <option value="crypto">₿ {t('admin.paymentGateways.categoryCrypto')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-300 block mb-2">
                    {t('admin.paymentGateways.displayOrder')}
                  </label>
                  <input
                    type="number"
                    value={form.displayOrder}
                    onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })}
                    className="input-field"
                    min={0}
                  />
                </div>
              </div>

              {form.type === 'manual' && (
                <>
                  <div>
                    <label className="text-sm text-gray-300 block mb-2">
                      {t('admin.paymentGateways.accountName')}
                    </label>
                    <input
                      type="text"
                      value={form.accountName}
                      onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                      placeholder="Aung Aung"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-300 block mb-2">
                      {t('admin.paymentGateways.accountNumber')}
                    </label>
                    <input
                      type="text"
                      value={form.accountNumber}
                      onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                      placeholder="09xxxxxxxxx"
                      className="input-field font-mono"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-sm text-gray-300 block mb-2">
                  {t('admin.paymentGateways.instructions')}
                </label>
                <textarea
                  rows={2}
                  value={form.instructions}
                  onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                  placeholder={t('admin.paymentGateways.instructionsPlaceholder')}
                  className="input-field resize-none"
                />
              </div>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                  className="w-5 h-5 rounded-lg border-purple-500/30 bg-[#12122a] text-purple-500 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-300">{t('admin.paymentGateways.enabledLabel')}</span>
              </label>

              <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
                <button
                  onClick={() => { setShowForm(false); setEditing(null); }}
                  className="btn-primary text-sm"
                >
                  {t('admin.productsPage.cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-electric text-sm flex items-center space-x-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>{editing ? t('admin.productsPage.update') : t('admin.productsPage.create')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gateways Table */}
      {loading ? (
        <div className="game-card p-12 text-center">
          <Loader2 className="w-10 h-10 text-purple-500 animate-spin mx-auto" />
        </div>
      ) : gateways.length === 0 ? (
        <div className="game-card p-16 text-center">
          <CreditCard className="w-16 h-16 text-dark-600 mx-auto mb-4" />
          <h3 className="text-xl text-gray-300 font-medium mb-2">{t('admin.paymentGateways.noGateways')}</h3>
          <p className="text-sm text-gray-500">{t('admin.paymentGateways.createFirstHint')}</p>
        </div>
      ) : (
        <div className="game-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase border-b border-dark-700 bg-dark-800/50">
                  <th className="p-4 font-semibold w-10">#</th>
                  <th className="p-4 font-semibold">{t('admin.paymentGateways.gateway')}</th>
                  <th className="p-4 font-semibold">{t('admin.paymentGateways.code')}</th>
                  <th className="p-4 font-semibold">{t('admin.paymentGateways.type')}</th>
                  <th className="p-4 font-semibold">{t('admin.paymentGateways.category')}</th>
                  <th className="p-4 font-semibold">{t('admin.paymentGateways.account')}</th>
                  <th className="p-4 font-semibold">{t('admin.productsPage.status')}</th>
                  <th className="p-4 font-semibold text-right">{t('admin.productsPage.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {gateways.map((gw, idx) => (
                  <tr key={gw._id} className="text-gray-200 hover:bg-purple-500/5 transition-colors">
                    <td className="p-4 text-gray-500">
                      <GripVertical className="w-4 h-4 inline" /> {idx + 1}
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-white">{gw.name}</p>
                      {gw.instructions && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">{gw.instructions}</p>
                      )}
                    </td>
                    <td className="p-4">
                      <code className="text-xs bg-dark-800 px-2 py-1 rounded text-purple-400">{gw.code}</code>
                    </td>
                    <td className="p-4 capitalize">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                        gw.type === 'manual'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                      }`}>
                        {gw.type === 'manual' ? '💳 Manual' : '🌐 Online'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                        gw.category === 'crypto'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {gw.category === 'crypto' ? '₿ Crypto' : '🇲🇲 Myanmar'}
                      </span>
                    </td>
                    <td className="p-4">
                      {gw.accountName && <p className="text-sm text-white">{gw.accountName}</p>}
                      {gw.accountNumber && <p className="text-xs text-gray-400 font-mono">{gw.accountNumber}</p>}
                      {!gw.accountName && !gw.accountNumber && <span className="text-xs text-gray-600">—</span>}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => handleToggle(gw)}
                        className="flex items-center gap-1.5"
                        title={gw.enabled ? 'Disable' : 'Enable'}
                      >
                        {gw.enabled ? (
                          <ToggleRight className="w-6 h-6 text-green-400" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-gray-500" />
                        )}
                        <span className={`text-xs font-semibold ${gw.enabled ? 'text-green-400' : 'text-gray-500'}`}>
                          {gw.enabled ? 'ON' : 'OFF'}
                        </span>
                      </button>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => startEdit(gw)}
                          className="p-2 text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(gw._id, gw.name)}
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
        </div>
      )}
    </div>
  );
}
