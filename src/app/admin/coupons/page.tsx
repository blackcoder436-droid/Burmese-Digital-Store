'use client';

import { useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  X,
  Save,
  Tag,
  Loader2,
  ToggleLeft,
  ToggleRight,
  Percent,
  DollarSign,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/language';

interface Coupon {
  _id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  usageLimit: number;
  usedCount: number;
  perUserLimit: number;
  validFrom: string;
  validUntil: string;
  categories: string[];
  active: boolean;
}

const defaultCoupon = {
  code: '',
  discountType: 'percentage' as const,
  discountValue: 10,
  minOrderAmount: 0,
  maxDiscountAmount: '',
  usageLimit: 0,
  perUserLimit: 1,
  validFrom: new Date().toISOString().slice(0, 10),
  validUntil: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  categories: [] as string[],
};

export default function AdminCouponsPage() {
  const { t } = useLanguage();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<typeof defaultCoupon, 'discountType'> & { discountType: 'percentage' | 'fixed' }>(defaultCoupon);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCoupons();
  }, []);

  async function fetchCoupons() {
    try {
      const res = await fetch('/api/admin/coupons');
      const data = await res.json();
      if (data.success) setCoupons(data.data.coupons);
    } catch {
      toast.error(t('admin.couponsPage.failedFetchCoupons'));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!form.code.trim()) {
      toast.error(t('admin.couponsPage.couponCodeRequired'));
      return;
    }
    if (form.discountValue <= 0) {
      toast.error(t('admin.couponsPage.discountMustBeGreaterThanZero'));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          maxDiscountAmount: form.maxDiscountAmount ? Number(form.maxDiscountAmount) : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t('admin.couponsPage.couponCreated'));
        setShowForm(false);
        setForm(defaultCoupon);
        fetchCoupons();
      } else {
        toast.error(data.error || t('admin.couponsPage.failedCreate'));
      }
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(id: string, active: boolean) {
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active: !active }),
      });
      const data = await res.json();
      if (data.success) {
        setCoupons((prev) =>
          prev.map((c) => (c._id === id ? { ...c, active: !active } : c))
        );
        toast.success(!active ? t('admin.couponsPage.couponActivated') : t('admin.couponsPage.couponDeactivated'));
      }
    } catch {
      toast.error(t('common.error'));
    }
  }

  async function handleDelete(id: string, code: string) {
    if (!confirm(t('admin.couponsPage.deleteCouponConfirm').replace('{code}', code))) return;
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setCoupons((prev) => prev.filter((c) => c._id !== id));
        toast.success(t('admin.couponsPage.couponDeleted'));
      }
    } catch {
      toast.error(t('common.error'));
    }
  }

  function isExpired(validUntil: string) {
    return new Date(validUntil) < new Date();
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="heading-lg">{t('admin.coupons')}</h1>
        <button
          onClick={() => { setShowForm(true); setForm(defaultCoupon); }}
          className="btn-electric text-sm flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>{t('admin.couponsPage.createCoupon')}</span>
        </button>
      </div>

      {/* Create Coupon Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="game-card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="heading-sm">{t('admin.couponsPage.newCoupon')}</h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-dark-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Code */}
              <div>
                <label className="text-sm text-gray-300 block mb-1.5">{t('admin.couponsPage.couponCodeLabel')}</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="SAVE20"
                  className="input-field font-mono uppercase"
                />
              </div>

              {/* Discount Type + Value */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-300 block mb-1.5">{t('admin.couponsPage.typeLabel')}</label>
                  <select
                    value={form.discountType}
                    onChange={(e) => setForm({ ...form, discountType: e.target.value as 'percentage' | 'fixed' })}
                    className="input-field"
                  >
                    <option value="percentage">{t('admin.couponsPage.percentageType')}</option>
                    <option value="fixed">{t('admin.couponsPage.fixedType')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-300 block mb-1.5">
                    {form.discountType === 'percentage' ? t('admin.couponsPage.discountPercent') : t('admin.couponsPage.discountMmk')}
                  </label>
                  <input
                    type="number"
                    value={form.discountValue}
                    onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
                    min={0}
                    max={form.discountType === 'percentage' ? 100 : undefined}
                    className="input-field"
                  />
                </div>
              </div>

              {/* Min Order + Max Discount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-300 block mb-1.5">{t('admin.couponsPage.minOrderLabel')}</label>
                  <input
                    type="number"
                    value={form.minOrderAmount}
                    onChange={(e) => setForm({ ...form, minOrderAmount: Number(e.target.value) })}
                    min={0}
                    className="input-field"
                  />
                </div>
                {form.discountType === 'percentage' && (
                  <div>
                    <label className="text-sm text-gray-300 block mb-1.5">{t('admin.couponsPage.maxDiscountLabel')}</label>
                    <input
                      type="number"
                      value={form.maxDiscountAmount}
                      onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value })}
                      placeholder={t('admin.couponsPage.noLimit')}
                      min={0}
                      className="input-field"
                    />
                  </div>
                )}
              </div>

              {/* Usage Limits */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-300 block mb-1.5">{t('admin.couponsPage.totalUsesLabel')}</label>
                  <input
                    type="number"
                    value={form.usageLimit}
                    onChange={(e) => setForm({ ...form, usageLimit: Number(e.target.value) })}
                    min={0}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300 block mb-1.5">{t('admin.couponsPage.perUserLimitLabel')}</label>
                  <input
                    type="number"
                    value={form.perUserLimit}
                    onChange={(e) => setForm({ ...form, perUserLimit: Number(e.target.value) })}
                    min={0}
                    className="input-field"
                  />
                </div>
              </div>

              {/* Validity Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-300 block mb-1.5">{t('admin.couponsPage.validFromLabel')}</label>
                  <input
                    type="date"
                    value={form.validFrom}
                    onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300 block mb-1.5">{t('admin.couponsPage.validUntilLabel')}</label>
                  <input
                    type="date"
                    value={form.validUntil}
                    onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-dark-700">
                <button onClick={() => setShowForm(false)} className="btn-primary text-sm">
                  {t('common.cancel')}
                </button>
                <button onClick={handleCreate} disabled={saving} className="btn-electric text-sm flex items-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {t('admin.couponsPage.create')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Coupons List */}
      {loading ? (
        <div className="game-card p-12 text-center">
          <Loader2 className="w-10 h-10 text-purple-500 animate-spin mx-auto" />
        </div>
      ) : coupons.length === 0 ? (
        <div className="game-card p-16 text-center">
          <Tag className="w-16 h-16 text-dark-600 mx-auto mb-4" />
          <h3 className="text-xl text-gray-300 font-medium mb-2">{t('admin.couponsPage.noCouponsYet')}</h3>
          <p className="text-sm text-gray-500">
            {t('admin.couponsPage.createFirstCouponHint')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {coupons.map((coupon) => {
            const expired = isExpired(coupon.validUntil);
            return (
              <div
                key={coupon._id}
                className={`game-card p-5 ${(!coupon.active || expired) ? 'opacity-60' : ''}`}
              >
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-xl ${coupon.discountType === 'percentage' ? 'bg-purple-500/10' : 'bg-emerald-500/10'}`}>
                      {coupon.discountType === 'percentage' ? (
                        <Percent className="w-5 h-5 text-purple-400" />
                      ) : (
                        <DollarSign className="w-5 h-5 text-emerald-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-lg">{coupon.code}</span>
                        {expired && (
                          <span className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-lg border border-red-500/20">
                            {t('admin.couponsPage.expired')}
                          </span>
                        )}
                        {!coupon.active && !expired && (
                          <span className="text-xs bg-gray-500/10 text-gray-400 px-2 py-0.5 rounded-lg border border-gray-500/20">
                            {t('admin.couponsPage.inactive')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 mt-0.5">
                        {coupon.discountType === 'percentage'
                          ? `${coupon.discountValue}% ${t('admin.couponsPage.off')}`
                          : `${coupon.discountValue.toLocaleString()} MMK ${t('admin.couponsPage.off')}`}
                        {coupon.minOrderAmount > 0 && ` · ${t('admin.couponsPage.min')} ${coupon.minOrderAmount.toLocaleString()} MMK`}
                        {' '}· {t('admin.couponsPage.used')} {coupon.usedCount}/{coupon.usageLimit || '∞'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(coupon.validFrom).toLocaleDateString()} — {new Date(coupon.validUntil).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(coupon._id, coupon.active)}
                      className="p-2 text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-all"
                      title={coupon.active ? t('admin.couponsPage.deactivate') : t('admin.couponsPage.activate')}
                    >
                      {coupon.active ? <ToggleRight className="w-5 h-5 text-green-400" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => handleDelete(coupon._id, coupon.code)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                      title={t('common.delete')}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
