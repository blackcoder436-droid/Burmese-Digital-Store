'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Hash,
  Search,
  ShieldCheck,
  Download,
  Copy,
  Check,
} from 'lucide-react';
import MyKeys from '@/components/MyKeys';
import VpnKeyDisplay from '@/components/VpnKeyDisplay';
import PaymentCountdown from '@/components/PaymentCountdown';
import { useLanguage } from '@/lib/language';
import { useScrollFade } from '@/hooks/useScrollFade';
import toast from 'react-hot-toast';

interface OrderDetail {
  _id: string;
  orderNumber: string;
  product: {
    _id: string;
    name: string;
    category: string;
    price: number;
    image?: string;
  } | null;
  orderType: 'product' | 'vpn';
  quantity: number;
  totalAmount: number;
  paymentMethod: string;
  paymentScreenshot: string;
  status: 'pending' | 'verifying' | 'completed' | 'rejected' | 'refunded';
  deliveredKeys: {
    serialKey?: string;
    loginEmail?: string;
    loginPassword?: string;
    additionalInfo?: string;
  }[];
  vpnPlan?: { serverId: string; planId: string; devices: number; months: number };
  vpnKey?: {
    clientEmail: string;
    subLink: string;
    configLink: string;
    protocol: string;
    expiryTime: number;
    provisionedAt?: string;
  };
  vpnProvisionStatus?: string;
  couponCode?: string;
  discountAmount?: number;
  rejectReason?: string;
  adminNote?: string;
  paymentExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function OrderDetailPage() {
  const { t, tr } = useLanguage();
  const containerRef = useScrollFade();
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [copiedOrderNumber, setCopiedOrderNumber] = useState(false);

  useEffect(() => {
    if (orderId) fetchOrder();
  }, [orderId]);

  async function fetchOrder() {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      const data = await res.json();
      if (!data.success) {
        if (res.status === 401) router.push('/login');
        return;
      }
      setOrder(data.data.order);
    } catch {
      toast.error('Failed to load order');
    } finally {
      setLoading(false);
    }
  }

  async function downloadInvoice() {
    if (!order) return;
    setDownloadingInvoice(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/invoice`);
      if (!res.ok) {
        toast.error(tr('Failed to generate invoice', 'Invoice ထုတ်၍ မရပါ'));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${order.orderNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(tr('Invoice downloaded', 'Invoice ဒေါင်းပြီးပါပြီ'));
    } catch {
      toast.error(tr('Failed to download invoice', 'Invoice ဒေါင်း၍ မရပါ'));
    } finally {
      setDownloadingInvoice(false);
    }
  }

  async function copyOrderNumber(orderNumber: string) {
    try {
      await navigator.clipboard.writeText(orderNumber);
      setCopiedOrderNumber(true);
      setTimeout(() => setCopiedOrderNumber(false), 1500);
      toast.success(tr('Order ID copied', 'Order ID ကူးပြီးပါပြီ'));
    } catch {
      toast.error(tr('Copy failed', 'ကူး၍မရပါ'));
    }
  }

  const statusIcon = {
    pending: <Clock className="w-3.5 h-3.5" />,
    verifying: <ShieldCheck className="w-3.5 h-3.5" />,
    completed: <CheckCircle className="w-3.5 h-3.5" />,
    rejected: <XCircle className="w-3.5 h-3.5" />,
    refunded: <AlertTriangle className="w-3.5 h-3.5" />,
  };

  const statusLabel = {
    pending: t('account.orders.pending'),
    verifying: t('account.orders.verifying'),
    completed: t('account.orderDetail.completedStatus'),
    rejected: t('account.orderDetail.rejectedStatus'),
    refunded: t('account.orderDetail.refunded'),
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-8 pb-12 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen pt-8 pb-12 relative z-[1]">
        <div className="max-w-3xl mx-auto px-4 text-center py-20">
          <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">{t('account.orderDetail.orderNotFound')}</h1>
          <Link href="/account/orders" className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors mx-auto mt-2" aria-label="Back to orders">
            <ArrowLeft className="w-4 h-4 text-gray-400" />
          </Link>
        </div>
      </div>
    );
  }

  const isExpired = order.paymentExpiresAt && new Date(order.paymentExpiresAt) < new Date() && order.status === 'pending';

  return (
    <div className="min-h-screen pt-6 sm:pt-8 pb-12 relative z-[1]" ref={containerRef}>
      <div className="max-w-3xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Main Order Card — everything in one cohesive card */}
        <div className="scroll-fade game-card overflow-hidden mb-4 sm:mb-6" data-delay="50">
          {/* Header: back icon + product name + order number */}
          <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-dark-600/30">
            <div className="flex items-center gap-3">
              <Link
                href="/account/orders"
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-dark-700/50 border border-dark-600/50 text-gray-400 hover:text-white hover:border-purple-500/40 hover:bg-purple-500/10 transition-all flex-shrink-0"
                title={t('account.orderDetail.backToOrders')}
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div className="min-w-0 flex-1">
                <h1 className="text-sm sm:text-lg font-bold text-white leading-tight">
                  {order.orderType === 'vpn' && order.vpnPlan ? (
                    <span className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">VPN</span>
                      <span>{order.vpnPlan.devices}D / {order.vpnPlan.months}M</span>
                    </span>
                  ) : (
                    order.product?.name || 'Product'
                  )}
                </h1>
              </div>
              <button
                onClick={() => copyOrderNumber(order.orderNumber)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-gray-500 hover:text-purple-300 hover:bg-purple-500/10 transition-all font-mono"
                title={tr('Copy Order ID', 'Order ID ကူးမည်')}
              >
                #{order.orderNumber}
                {copiedOrderNumber ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              {order.status === 'completed' && (
                <button
                  onClick={downloadInvoice}
                  disabled={downloadingInvoice}
                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 transition-all flex-shrink-0 disabled:opacity-50"
                  title={tr('Download Invoice', 'Invoice ဒေါင်းမည်')}
                >
                  {downloadingInvoice ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Compact Status Stepper */}
          <div className="px-4 sm:px-5 py-2.5 sm:py-3 border-b border-dark-600/30">
            <MiniStepper status={order.status} t={t} />
          </div>

          {/* Info Grid — 2x2 compact */}
          <div className="px-4 sm:px-5 py-2.5 sm:py-3 border-b border-dark-600/30">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-xs">{t('account.orderDetail.payment')}</span>
                <span className="font-semibold text-white text-xs">{order.paymentMethod.toUpperCase()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-xs">{t('account.orderDetail.quantity')}</span>
                <span className="font-semibold text-white text-xs">{order.quantity}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-xs">{t('account.orderDetail.date')}</span>
                <span className="font-semibold text-white text-xs">{new Date(order.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-xs">{t('account.orderDetail.total')}</span>
                <span className="font-semibold text-purple-400 text-xs">{order.totalAmount.toLocaleString()} Ks</span>
              </div>
            </div>
            {/* Coupon discount — inline */}
            {order.couponCode && (
              <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-dark-600/20">
                <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold border border-green-500/30">
                  {order.couponCode}
                </span>
                <span className="text-xs text-gray-400">
                  {t('account.orderDetail.discount')}: -{order.discountAmount?.toLocaleString()} Ks
                </span>
              </div>
            )}
          </div>

          {/* Payment Countdown Timer */}
          {order.paymentExpiresAt && order.status === 'pending' && !isExpired && (
            <div className="px-4 sm:px-5 py-2.5 border-b border-dark-600/30">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">{t('account.orderDetail.paymentDeadline')}</p>
                <PaymentCountdown expiresAt={order.paymentExpiresAt} />
              </div>
            </div>
          )}

          {/* Expired Warning */}
          {isExpired && (
            <div className="px-4 sm:px-5 py-2.5 border-b border-dark-600/30 bg-yellow-500/5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
                <p className="text-xs text-yellow-400">{t('account.orderDetail.paymentExpired')}</p>
              </div>
            </div>
          )}

          {/* Reject Reason */}
          {order.status === 'rejected' && order.rejectReason && (
            <div className="px-4 sm:px-5 py-2.5 border-b border-dark-600/30 bg-red-500/5">
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-red-400 mb-0.5">{t('account.orderDetail.rejectionReason')}</p>
                  <p className="text-xs text-gray-400">{order.rejectReason}</p>
                </div>
              </div>
            </div>
          )}

          {/* Admin Note */}
          {order.adminNote && (
            <div className="px-4 sm:px-5 py-2.5 border-b border-dark-600/30">
              <p className="text-[10px] text-gray-500 mb-0.5">{t('account.orderDetail.adminNote')}</p>
              <p className="text-xs text-gray-300">{order.adminNote}</p>
            </div>
          )}
        </div>

        {/* Delivered Keys — separate card */}
        {order.status === 'completed' && order.deliveredKeys?.length > 0 && (
          <div className="scroll-fade mb-4 sm:mb-6" data-delay="150">
            <MyKeys keys={order.deliveredKeys} productName={order.product?.name || 'Product'} />
          </div>
        )}

        {/* VPN Key — separate card */}
        {order.status === 'completed' && order.orderType === 'vpn' && order.vpnKey && (
          <div className="scroll-fade mb-4 sm:mb-6" data-delay="150">
            <VpnKeyDisplay vpnKey={order.vpnKey} vpnPlan={order.vpnPlan} />
          </div>
        )}
      </div>
    </div>
  );
}

/* Compact inline stepper — smaller than the full OrderStatus component */
function MiniStepper({ status, t }: { status: string; t: (key: string) => string }) {
  const steps = [
    { key: 'pending', label: t('order.pending'), icon: Clock },
    { key: 'verifying', label: t('order.verifying'), icon: Search },
    { key: 'completed', label: t('order.completed'), icon: CheckCircle },
  ];

  if (status === 'rejected' || status === 'refunded') {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
        status === 'rejected'
          ? 'bg-red-500/10 border border-red-500/20 text-red-400'
          : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
      }`}>
        {status === 'rejected' ? <XCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
        {status === 'rejected' ? t('order.paymentRejected') : t('order.refunded')}
      </div>
    );
  }

  const currentIndex = steps.findIndex((s) => s.key === status);

  return (
    <div className="flex items-center justify-center">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isComplete = index <= currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all ${
                isComplete
                  ? isCurrent && step.key !== 'completed'
                    ? 'bg-purple-500/20 border border-purple-500 text-purple-400'
                    : 'bg-emerald-500/20 border border-emerald-500 text-emerald-400'
                  : 'bg-dark-800 border border-dark-600 text-gray-600'
              }`}>
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <span className={`text-[10px] mt-1 font-medium ${
                isComplete ? 'text-gray-300' : 'text-gray-600'
              }`}>{step.label}</span>
            </div>
            {index < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1.5 sm:mx-2.5 mb-4 rounded-full ${
                index < currentIndex ? 'bg-emerald-500'
                : index === currentIndex ? 'bg-gradient-to-r from-purple-500/50 to-dark-700'
                : 'bg-dark-700'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
