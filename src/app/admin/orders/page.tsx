'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Eye,
  Clock,
  Image,
  Loader2,
  ExternalLink,
  EyeOff,
  RotateCw,
  Ban,
  Copy,
  Check,
  Shield,
  AlertTriangle,
  ShieldAlert,
  UserX,
  DollarSign,
  Timer,
  CheckSquare,
  Square,
  ListChecks,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/language';

interface Order {
  _id: string;
  user: { _id: string; name: string; email: string };
  product: { _id: string; name: string; category: string; price: number } | null;
  orderType: 'product' | 'vpn';
  quantity: number;
  totalAmount: number;
  paymentMethod: string;
  paymentScreenshot: string;
  transactionId: string;
  ocrVerified: boolean;
  ocrExtractedData?: {
    amount?: string;
    transactionId?: string;
    confidence: number;
  };
  status: string;
  deliveredKeys: any[];
  vpnPlan?: { serverId: string; planId: string; devices: number; months: number };
  vpnKey?: { clientEmail: string; subLink: string; configLink: string; protocol: string; expiryTime: number };
  vpnProvisionStatus?: string;
  adminNote: string;
  createdAt: string;
  // Fraud detection fields
  fraudFlags?: string[];
  requiresManualReview?: boolean;
  reviewReason?: string;
  paymentExpiresAt?: string;
  couponCode?: string;
  discountAmount?: number;
  rejectReason?: string;
  verificationChecklist?: {
    amountVerified?: boolean;
    timeVerified?: boolean;
    accountVerified?: boolean;
    txidVerified?: boolean;
    payerVerified?: boolean;
  };
}

const fraudFlagLabels: Record<string, { label: string; icon: typeof AlertTriangle; color: string }> = {
  duplicate_txid: { label: 'Duplicate TxID', icon: ShieldAlert, color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  duplicate_screenshot: { label: 'Duplicate Screenshot', icon: Image, color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  amount_time_suspicious: { label: 'Suspicious Timing', icon: Timer, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  first_time_user: { label: 'First-Time User', icon: UserX, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  high_amount: { label: 'High Amount', icon: DollarSign, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
};

export default function AdminOrdersPage() {
  const { t } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [ocrEnabled, setOcrEnabled] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [checklist, setChecklist] = useState({
    amountVerified: false,
    timeVerified: false,
    accountVerified: false,
    txidVerified: false,
    payerVerified: false,
  });
  const [showReviewOnly, setShowReviewOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');
  const [showBulkRejectDialog, setShowBulkRejectDialog] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map(o => o._id)));
    }
  };

  const selectedPendingCount = orders.filter(o => selectedIds.has(o._id) && (o.status === 'pending' || o.status === 'verifying')).length;

  async function bulkAction(action: 'bulk_approve' | 'bulk_reject', rejectReason?: string) {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true);
    try {
      const res = await fetch('/api/admin/orders/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          orderIds: Array.from(selectedIds),
          rejectReason,
          verificationChecklist: action === 'bulk_approve' ? {
            amountVerified: true,
            timeVerified: true,
            accountVerified: true,
            txidVerified: true,
            payerVerified: true,
          } : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || `${data.data.successCount} orders processed`);
        if (data.data.failCount > 0) {
          toast.error(`${data.data.failCount} orders failed`);
        }
        setSelectedIds(new Set());
        setShowBulkRejectDialog(false);
        setBulkRejectReason('');
        fetchOrders();
      } else {
        toast.error(data.error || 'Bulk action failed');
      }
    } catch {
      toast.error('Bulk action failed');
    } finally {
      setBulkProcessing(false);
    }
  }

  const copyText = async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    } catch { /* fallback */ }
  };

  useEffect(() => {
    fetchOrders();
    fetchOcrStatus();
  }, [filter, showReviewOnly]);

  async function fetchOcrStatus() {
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (data.success) setOcrEnabled(data.data.settings.ocrEnabled);
    } catch { /* ignore */ }
  }

  async function fetchOrders() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (filter) params.set('status', filter);
      if (showReviewOnly) params.set('requiresReview', 'true');

      const res = await fetch(`/api/admin/orders?${params}`);
      const data = await res.json();
      if (data.success) setOrders(data.data.orders);
    } catch {
      toast.error(t('admin.ordersPage.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function updateOrderStatus(orderId: string, status: string, note?: string, rejectReason?: string, verificationChecklist?: Record<string, boolean>) {
    setProcessing(orderId);
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status, adminNote: note, rejectReason, verificationChecklist }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`${t('admin.ordersPage.order')} ${status}`);
        fetchOrders();
        setSelectedOrder(null);
        setShowRejectDialog(false);
        setRejectReasonInput('');
        setChecklist({ amountVerified: false, timeVerified: false, accountVerified: false, txidVerified: false, payerVerified: false });
      } else {
        toast.error(data.error || t('admin.ordersPage.updateFailed'));
      }
    } catch {
      toast.error(t('admin.ordersPage.somethingWrong'));
    } finally {
      setProcessing(null);
    }
  }

  async function vpnAction(orderId: string, action: 'retry_provision' | 'revoke_key') {
    setProcessing(orderId);
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, action }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(action === 'retry_provision'
          ? t('admin.ordersPage.vpnProvisioned')
          : t('admin.ordersPage.vpnRevoked'));
        fetchOrders();
        setSelectedOrder(null);
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error(t('admin.ordersPage.somethingWrong'));
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="heading-lg">{t('admin.ordersPage.title')}</h1>
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${
          ocrEnabled
            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
        }`}>
          {ocrEnabled ? (
            <>
              <Eye className="w-3.5 h-3.5" />
              {t('admin.ordersPage.ocrOn')}
            </>
          ) : (
            <>
              <EyeOff className="w-3.5 h-3.5" />
              {t('admin.ordersPage.ocrOff')}
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { value: '', label: t('admin.ordersPage.all'), count: orders.length },
          { value: 'pending', label: t('admin.ordersPage.pending') },
          { value: 'verifying', label: t('admin.ordersPage.verifying') },
          { value: 'completed', label: t('admin.ordersPage.completed') },
          { value: 'rejected', label: t('admin.ordersPage.rejected') },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 text-sm rounded-xl font-medium transition-all ${
              filter === f.value
                ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-glow-sm'
                : 'bg-[#12122a] text-gray-400 hover:text-white border border-purple-500/[0.15] hover:border-purple-500/50'
            }`}
          >
            {f.label}
          </button>
        ))}

        {/* Manual Review toggle */}
        <button
          onClick={() => setShowReviewOnly(!showReviewOnly)}
          className={`ml-auto flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
            showReviewOnly
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-[#12122a] text-gray-500 border border-purple-500/[0.08] hover:text-amber-400'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          {t('admin.ordersPage.reviewRequired')}
        </button>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="game-card flex flex-wrap items-center gap-3 p-4 border-purple-500/30 bg-purple-500/5">
          <div className="flex items-center gap-2 text-sm text-purple-300">
            <ListChecks className="w-4 h-4" />
            <span className="font-semibold">{selectedIds.size} selected</span>
            {selectedPendingCount > 0 && (
              <span className="text-xs text-gray-400">({selectedPendingCount} pending/verifying)</span>
            )}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {selectedPendingCount > 0 && (
              <>
                <button
                  onClick={() => {
                    if (confirm(`Approve ${selectedPendingCount} orders? This will auto-deliver keys/provision VPN.`)) {
                      bulkAction('bulk_approve');
                    }
                  }}
                  disabled={bulkProcessing}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-lg text-green-400 transition-all disabled:opacity-50"
                >
                  {bulkProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  Approve All
                </button>
                <button
                  onClick={() => setShowBulkRejectDialog(true)}
                  disabled={bulkProcessing}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-red-400 transition-all disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Reject All
                </button>
              </>
            )}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Bulk Reject Dialog */}
      {showBulkRejectDialog && (
        <div className="game-card p-4 border-red-500/30 bg-red-500/5 space-y-3">
          <p className="text-sm font-semibold text-red-400">Reject {selectedPendingCount} orders — reason required:</p>
          <textarea
            value={bulkRejectReason}
            onChange={(e) => setBulkRejectReason(e.target.value)}
            placeholder="Enter rejection reason..."
            className="w-full px-3 py-2 text-sm bg-dark-800 border border-red-500/20 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-red-500"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!bulkRejectReason.trim()) {
                  toast.error('Reject reason is required');
                  return;
                }
                bulkAction('bulk_reject', bulkRejectReason.trim());
              }}
              disabled={bulkProcessing}
              className="px-4 py-2 text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-red-400 transition-all disabled:opacity-50"
            >
              {bulkProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> : null}
              Confirm Reject
            </button>
            <button
              onClick={() => { setShowBulkRejectDialog(false); setBulkRejectReason(''); }}
              className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="game-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="heading-sm">
                {t('admin.ordersPage.orderDetails')}
              </h2>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-dark-700 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 mb-1">{t('admin.ordersPage.customer')}</p>
                  <p className="text-white font-medium">
                    {selectedOrder.user?.name}
                  </p>
                  <p className="text-gray-400 text-xs">
                    {selectedOrder.user?.email}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">{t('admin.ordersPage.product')}</p>
                  <p className="text-white font-medium">
                    {selectedOrder.orderType === 'vpn' && selectedOrder.vpnPlan
                      ? `VPN ${selectedOrder.vpnPlan.devices}D / ${selectedOrder.vpnPlan.months}M — ${selectedOrder.vpnPlan.serverId.toUpperCase()}`
                      : selectedOrder.product?.name || 'Product'}
                  </p>
                  {selectedOrder.orderType === 'vpn' && (
                    <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">VPN</span>
                  )}
                </div>
                <div>
                  <p className="text-gray-500 mb-1">{t('admin.ordersPage.amount')}</p>
                  <p className="text-purple-400 font-bold text-lg">
                    {selectedOrder.totalAmount?.toLocaleString()} MMK
                  </p>
                  {selectedOrder.couponCode && selectedOrder.discountAmount && selectedOrder.discountAmount > 0 && (
                    <div className="mt-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                        🎟️ {selectedOrder.couponCode} (-{selectedOrder.discountAmount.toLocaleString()} MMK)
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-gray-500 mb-1">{t('admin.ordersPage.payment')}</p>
                  <p className="text-white font-medium">
                    {selectedOrder.paymentMethod?.toUpperCase()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">{t('admin.ordersPage.transactionId')}</p>
                  <p className="text-white font-mono text-xs bg-dark-800 px-2 py-1 rounded-lg inline-block">
                    {selectedOrder.transactionId || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">{t('admin.ordersPage.ocrStatus')}</p>
                  <p
                    className={
                      selectedOrder.ocrVerified
                        ? 'text-green-400 font-medium'
                        : 'text-amber-400 font-medium'
                    }
                  >
                    {selectedOrder.ocrVerified ? t('admin.ordersPage.verified') : t('admin.ordersPage.notVerified')}
                    {selectedOrder.ocrExtractedData && (
                      <span className="text-xs text-gray-500 ml-2">
                        ({Math.round(selectedOrder.ocrExtractedData.confidence)}%
                        confidence)
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Payment Screenshot */}
              {selectedOrder.paymentScreenshot && (
                <div>
                  <p className="text-gray-500 text-sm mb-2">
                    {t('admin.ordersPage.paymentScreenshot')}
                  </p>
                  <img
                    src={selectedOrder.paymentScreenshot}
                    alt="Payment screenshot"
                    className="max-h-64 rounded-xl border border-dark-700"
                  />
                </div>
              )}

              {/* OCR Data */}
              {selectedOrder.ocrExtractedData && (
                <div className="p-4 bg-dark-800 rounded-xl border border-dark-700">
                  <p className="text-gray-500 text-xs mb-2 font-medium">
                    {t('admin.ordersPage.ocrExtractedData')}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500">{t('admin.ordersPage.amountLabel')} </span>
                      <span className="text-white font-mono">
                        {selectedOrder.ocrExtractedData.amount || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">{t('admin.ordersPage.txnIdLabel')} </span>
                      <span className="text-white font-mono">
                        {selectedOrder.ocrExtractedData.transactionId || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Fraud Flags */}
              {selectedOrder.fraudFlags && selectedOrder.fraudFlags.length > 0 && (
                <div className="p-4 bg-red-500/5 rounded-xl border border-red-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-semibold text-red-400">{t('admin.ordersPage.fraudFlags')}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedOrder.fraudFlags.map((flag) => {
                      const flagInfo = fraudFlagLabels[flag] || { label: flag, icon: AlertTriangle, color: 'text-gray-400 bg-gray-500/10 border-gray-500/20' };
                      const FlagIcon = flagInfo.icon;
                      return (
                        <span key={flag} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border ${flagInfo.color}`}>
                          <FlagIcon className="w-3 h-3" />
                          {flagInfo.label}
                        </span>
                      );
                    })}
                  </div>
                  {selectedOrder.reviewReason && (
                    <p className="text-xs text-gray-400 mt-2">{selectedOrder.reviewReason}</p>
                  )}
                </div>
              )}

              {/* Payment Expiry */}
              {selectedOrder.paymentExpiresAt && (selectedOrder.status === 'pending' || selectedOrder.status === 'verifying') && (
                <div className="flex items-center gap-2 text-xs">
                  <Timer className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-gray-500">{t('admin.ordersPage.paymentExpires')}</span>
                  <span className={`font-semibold ${new Date(selectedOrder.paymentExpiresAt) < new Date() ? 'text-red-400' : 'text-amber-400'}`}>
                    {new Date(selectedOrder.paymentExpiresAt) < new Date()
                      ? t('admin.ordersPage.expired')
                      : new Date(selectedOrder.paymentExpiresAt).toLocaleString()}
                  </span>
                </div>
              )}

              {/* VPN Provision Status + Key Details */}
              {selectedOrder.orderType === 'vpn' && (
                <div className="p-4 bg-dark-800 rounded-xl border border-dark-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-semibold text-white">{t('admin.ordersPage.vpnProvision')}</span>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${
                      selectedOrder.vpnProvisionStatus === 'provisioned'
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : selectedOrder.vpnProvisionStatus === 'failed'
                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : selectedOrder.vpnProvisionStatus === 'revoked'
                        ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      {selectedOrder.vpnProvisionStatus || 'pending'}
                    </span>
                  </div>

                  {/* VPN Key details if provisioned */}
                  {selectedOrder.vpnKey && selectedOrder.vpnProvisionStatus === 'provisioned' && (
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-gray-500">Client: </span>
                        <span className="text-white font-mono">{selectedOrder.vpnKey.clientEmail}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Config: </span>
                        <code className="text-purple-400 font-mono text-[10px] truncate max-w-[300px] block">{selectedOrder.vpnKey.configLink}</code>
                        <button onClick={() => copyText(selectedOrder.vpnKey!.configLink, 'admin-config')} className="shrink-0 p-1 hover:bg-purple-500/10 rounded text-gray-400 hover:text-purple-400">
                          {copiedField === 'admin-config' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Sub: </span>
                        <code className="text-cyan-400 font-mono text-[10px] truncate max-w-[300px] block">{selectedOrder.vpnKey.subLink}</code>
                        <button onClick={() => copyText(selectedOrder.vpnKey!.subLink, 'admin-sub')} className="shrink-0 p-1 hover:bg-cyan-500/10 rounded text-gray-400 hover:text-cyan-400">
                          {copiedField === 'admin-sub' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <div>
                        <span className="text-gray-500">Expiry: </span>
                        <span className="text-white">{new Date(selectedOrder.vpnKey.expiryTime).toLocaleDateString()}</span>
                      </div>
                    </div>
                  )}

                  {/* Retry / Revoke buttons */}
                  <div className="flex gap-2 pt-2">
                    {selectedOrder.vpnProvisionStatus === 'failed' && (
                      <button
                        onClick={() => vpnAction(selectedOrder._id, 'retry_provision')}
                        disabled={processing === selectedOrder._id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg text-purple-300 transition-all disabled:opacity-50"
                      >
                        {processing === selectedOrder._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
                        {t('admin.ordersPage.retryProvision')}
                      </button>
                    )}
                    {selectedOrder.vpnProvisionStatus === 'provisioned' && (
                      <button
                        onClick={() => { if (confirm(t('admin.ordersPage.confirmRevoke'))) vpnAction(selectedOrder._id, 'revoke_key'); }}
                        disabled={processing === selectedOrder._id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-red-400 transition-all disabled:opacity-50"
                      >
                        {processing === selectedOrder._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                        {t('admin.ordersPage.revokeKey')}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {(selectedOrder.status === 'pending' ||
                selectedOrder.status === 'verifying') && (
                <div className="space-y-4 pt-5 border-t border-dark-700">
                  {/* Verification Checklist */}
                  <div className="p-4 bg-dark-800 rounded-xl border border-dark-700">
                    <div className="flex items-center justify-between mb-3 gap-2">
                      <p className="text-xs font-semibold text-gray-400">{t('admin.ordersPage.verificationChecklist')}</p>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setChecklist({ amountVerified: true, timeVerified: true, accountVerified: true, txidVerified: true, payerVerified: true })}
                          className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/25 hover:bg-purple-500/20 transition-colors"
                        >
                          {t('admin.ordersPage.markAll')}
                        </button>
                        <button
                          onClick={() => setChecklist({ amountVerified: false, timeVerified: false, accountVerified: false, txidVerified: false, payerVerified: false })}
                          className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-dark-700 text-gray-400 border border-dark-600 hover:text-white transition-colors"
                        >
                          {t('admin.ordersPage.clear')}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {[
                        { key: 'amountVerified' as const, label: t('admin.ordersPage.amountMatches') },
                        { key: 'timeVerified' as const, label: t('admin.ordersPage.paymentTimeRecent') },
                        { key: 'accountVerified' as const, label: t('admin.ordersPage.paidToCorrectAccount') },
                        { key: 'txidVerified' as const, label: t('admin.ordersPage.txidValid') },
                        { key: 'payerVerified' as const, label: t('admin.ordersPage.payerInfoMatches') },
                      ].map((item) => (
                        <label key={item.key} className="flex items-center gap-2 cursor-pointer group p-2 rounded-lg hover:bg-dark-700/60 transition-colors">
                          <input
                            type="checkbox"
                            checked={checklist[item.key]}
                            onChange={(e) => setChecklist({ ...checklist, [item.key]: e.target.checked })}
                            className="w-4 h-4 rounded border-gray-600 bg-dark-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
                          />
                          <span className="text-xs text-gray-300 group-hover:text-white transition-colors">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        const allChecked = Object.values(checklist).every(Boolean);
                        if (!allChecked) {
                          toast.error(t('admin.ordersPage.completeAllChecks'));
                          return;
                        }
                        updateOrderStatus(selectedOrder._id, 'completed', undefined, undefined, checklist);
                      }}
                      disabled={processing === selectedOrder._id}
                      className="btn-electric flex-1 flex items-center justify-center space-x-2"
                    >
                      {processing === selectedOrder._id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      <span>{selectedOrder.orderType === 'vpn'
                        ? t('admin.ordersPage.approveVpn')
                        : t('admin.ordersPage.approveDeliver')}</span>
                    </button>
                    <button
                      onClick={() => setShowRejectDialog(true)}
                      disabled={processing === selectedOrder._id}
                      className="btn-danger flex-1 flex items-center justify-center space-x-2"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>{t('admin.ordersPage.reject')}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Reject Reason Dialog */}
              {showRejectDialog && selectedOrder && (
                <div className="p-4 bg-red-500/5 rounded-xl border border-red-500/20 space-y-3">
                  <p className="text-sm font-semibold text-red-400">{t('admin.ordersPage.rejectReasonRequired')}</p>
                  <textarea
                    value={rejectReasonInput}
                    onChange={(e) => setRejectReasonInput(e.target.value)}
                    placeholder={t('admin.ordersPage.rejectPlaceholder')}
                    className="w-full px-3 py-2 text-sm bg-dark-800 border border-red-500/20 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-red-500"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (!rejectReasonInput.trim()) {
                          toast.error(t('admin.ordersPage.rejectReasonNeeded'));
                          return;
                        }
                        updateOrderStatus(selectedOrder._id, 'rejected', undefined, rejectReasonInput.trim());
                      }}
                      disabled={processing === selectedOrder._id}
                      className="px-4 py-2 text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-red-400 transition-all disabled:opacity-50"
                    >
                      {processing === selectedOrder._id ? <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> : null}
                      {t('admin.ordersPage.confirmReject')}
                    </button>
                    <button
                      onClick={() => { setShowRejectDialog(false); setRejectReasonInput(''); }}
                      className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
                    >
                      {t('admin.ordersPage.cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Orders Table */}
      {loading ? (
        <div className="game-card p-12 text-center">
          <Loader2 className="w-10 h-10 text-purple-500 animate-spin mx-auto" />
        </div>
      ) : orders.length === 0 ? (
        <div className="game-card p-16 text-center">
          <Clock className="w-16 h-16 text-dark-600 mx-auto mb-4" />
          <h3 className="text-xl text-gray-300 font-medium">{t('admin.ordersPage.noOrdersFound')}</h3>
        </div>
      ) : (
        <div className="game-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase border-b border-dark-700 bg-dark-800/50">
                  <th className="p-4 w-10">
                    <button onClick={toggleSelectAll} className="text-gray-400 hover:text-purple-400 transition-colors">
                      {selectedIds.size === orders.length && orders.length > 0 ? <CheckSquare className="w-4 h-4 text-purple-400" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <th className="p-4 font-semibold">{t('admin.ordersPage.customer')}</th>
                  <th className="p-4 font-semibold">{t('admin.ordersPage.product')}</th>
                  <th className="p-4 font-semibold">{t('admin.ordersPage.amount')}</th>
                  <th className="p-4 font-semibold">{t('admin.ordersPage.payment')}</th>
                  <th className="p-4 font-semibold">OCR</th>
                  <th className="p-4 font-semibold">{t('admin.ordersPage.status')}</th>
                  <th className="p-4 font-semibold">{t('admin.ordersPage.date')}</th>
                  <th className="p-4 font-semibold text-right">{t('admin.ordersPage.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {orders.map((order) => (
                  <tr
                    key={order._id}
                    className={`text-gray-200 hover:bg-purple-500/5 transition-colors ${selectedIds.has(order._id) ? 'bg-purple-500/10' : ''}`}
                  >
                    <td className="p-4 w-10">
                      <button onClick={() => toggleSelect(order._id)} className="text-gray-400 hover:text-purple-400 transition-colors">
                        {selectedIds.has(order._id) ? <CheckSquare className="w-4 h-4 text-purple-400" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-white">
                          {order.user?.name || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {order.user?.email}
                        </p>
                      </div>
                    </td>
                    <td className="p-4">
                      {order.orderType === 'vpn' && order.vpnPlan ? (
                        <div>
                          <span className="inline-flex items-center mr-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">VPN</span>
                          {order.vpnPlan.devices}D / {order.vpnPlan.months}M
                        </div>
                      ) : (
                        order.product?.name || 'Product'
                      )}
                    </td>
                    <td className="p-4 font-bold text-purple-400">
                      {order.totalAmount?.toLocaleString()}
                    </td>
                    <td className="p-4 uppercase text-xs font-medium">
                      {order.paymentMethod}
                    </td>
                    <td className="p-4">
                      {order.ocrVerified ? (
                        <span className="text-green-400 text-sm">✓</span>
                      ) : (
                        <span className="text-dark-600 text-sm">–</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold ${
                            order.status === 'completed'
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : order.status === 'rejected'
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : order.status === 'verifying'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {order.status}
                        </span>
                        {order.requiresManualReview && (order.status === 'pending' || order.status === 'verifying') && (
                          <span className="p-1 rounded bg-amber-500/10 border border-amber-500/20" title="Requires review">
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                          </span>
                        )}
                        {order.fraudFlags && order.fraudFlags.length > 0 && (
                          <span className="p-1 rounded bg-red-500/10 border border-red-500/20" title={order.fraudFlags.join(', ')}>
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-xs text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="p-2 text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-all"
                        title="View Details"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
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
