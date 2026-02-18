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
  Copy,
  CreditCard,
  Calendar,
  Hash,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import OrderStatus from '@/components/OrderStatus';
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
  transactionId?: string;
  status: 'pending' | 'verifying' | 'completed' | 'rejected' | 'refunded';
  ocrVerified: boolean;
  ocrExtractedData?: {
    amount?: string;
    transactionId?: string;
    confidence: number;
  };
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
  const { tr } = useLanguage();
  const containerRef = useScrollFade();
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

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

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success(tr('Copied!', 'ကူးယူပြီး!'));
  }

  const statusIcon = {
    pending: <Clock className="w-5 h-5 text-yellow-400" />,
    verifying: <ShieldCheck className="w-5 h-5 text-blue-400" />,
    completed: <CheckCircle className="w-5 h-5 text-green-400" />,
    rejected: <XCircle className="w-5 h-5 text-red-400" />,
    refunded: <AlertTriangle className="w-5 h-5 text-orange-400" />,
  };

  const statusLabel = {
    pending: tr('Pending', 'စောင့်ဆိုင်းနေသည်'),
    verifying: tr('Verifying', 'စစ်ဆေးနေသည်'),
    completed: tr('Completed', 'ပြီးဆုံးပြီ'),
    rejected: tr('Rejected', 'ပယ်ချခံရသည်'),
    refunded: tr('Refunded', 'ပြန်အမ်းပြီး'),
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-24 pb-12 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen pt-24 pb-12 relative z-[1]">
        <div className="max-w-3xl mx-auto px-4 text-center py-20">
          <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">{tr('Order not found', 'အော်ဒါမရှာတွေ့ပါ')}</h1>
          <Link href="/account/orders" className="text-purple-400 hover:text-purple-300 text-sm">
            ← {tr('Back to Orders', 'အော်ဒါများသို့ပြန်မည်')}
          </Link>
        </div>
      </div>
    );
  }

  const isExpired = order.paymentExpiresAt && new Date(order.paymentExpiresAt) < new Date() && order.status === 'pending';

  return (
    <div className="min-h-screen pt-24 pb-12 relative z-[1]" ref={containerRef}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Link */}
        <div className="scroll-fade mb-6">
          <Link
            href="/account/orders"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-purple-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {tr('Back to Orders', 'အော်ဒါများသို့ပြန်မည်')}
          </Link>
        </div>

        {/* Order Header */}
        <div className="scroll-fade game-card p-6 mb-6" data-delay="50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <Hash className="w-4 h-4" />
                <span className="font-mono">{order.orderNumber}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                {order.orderType === 'vpn' && order.vpnPlan ? (
                  <>
                    <span className="inline-flex items-center px-2 py-0.5 mr-2 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">VPN</span>
                    {order.vpnPlan.devices} Device{order.vpnPlan.devices > 1 ? 's' : ''} / {order.vpnPlan.months} Month{order.vpnPlan.months > 1 ? 's' : ''}
                  </>
                ) : (
                  order.product?.name || 'Product'
                )}
              </h1>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-dark-800 border border-dark-600/50">
              {statusIcon[order.status]}
              <span className="text-sm font-semibold text-white">{statusLabel[order.status]}</span>
            </div>
          </div>

          {/* Status Stepper */}
          <OrderStatus status={order.status} />
        </div>

        {/* Order Info Grid */}
        <div className="scroll-fade grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6" data-delay="100">
          <div className="game-card p-4 text-center">
            <CreditCard className="w-5 h-5 text-purple-400 mx-auto mb-2" />
            <p className="text-xs text-gray-500">{tr('Payment', 'ငွေပေးချေမှု')}</p>
            <p className="text-sm font-bold text-white mt-1">{order.paymentMethod.toUpperCase()}</p>
          </div>
          <div className="game-card p-4 text-center">
            <Package className="w-5 h-5 text-cyan-400 mx-auto mb-2" />
            <p className="text-xs text-gray-500">{tr('Quantity', 'အရေအတွက်')}</p>
            <p className="text-sm font-bold text-white mt-1">{order.quantity}</p>
          </div>
          <div className="game-card p-4 text-center">
            <Calendar className="w-5 h-5 text-blue-400 mx-auto mb-2" />
            <p className="text-xs text-gray-500">{tr('Date', 'ရက်စွဲ')}</p>
            <p className="text-sm font-bold text-white mt-1">
              {new Date(order.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="game-card p-4 text-center">
            <Hash className="w-5 h-5 text-green-400 mx-auto mb-2" />
            <p className="text-xs text-gray-500">{tr('Total', 'စုစုပေါင်း')}</p>
            <p className="text-sm font-bold text-purple-400 mt-1">{order.totalAmount.toLocaleString()} Ks</p>
          </div>
        </div>

        {/* Coupon discount */}
        {order.couponCode && (
          <div className="scroll-fade game-card p-4 mb-6 flex items-center gap-3" data-delay="120">
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-lg font-bold border border-green-500/30">
              {order.couponCode}
            </span>
            <span className="text-sm text-gray-400">
              {tr('Discount', 'လျှော့စျေး')}: -{order.discountAmount?.toLocaleString()} Ks
            </span>
          </div>
        )}

        {/* Transaction ID */}
        {order.transactionId && (
          <div className="scroll-fade game-card p-4 mb-6" data-delay="140">
            <p className="text-xs text-gray-500 mb-1">{tr('Transaction ID', 'ငွေလွှဲ ID')}</p>
            <div className="flex items-center justify-between">
              <code className="text-sm font-mono text-white">{order.transactionId}</code>
              <button
                onClick={() => copyToClipboard(order.transactionId!)}
                className="p-1.5 text-gray-500 hover:text-purple-400 transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Payment Countdown Timer */}
        {order.paymentExpiresAt && order.status === 'pending' && !isExpired && (
          <div className="scroll-fade game-card p-4 mb-6" data-delay="155">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">{tr('Payment Deadline', 'ငွေပေးချေရမည့်အချိန်')}</p>
              <PaymentCountdown expiresAt={order.paymentExpiresAt} />
            </div>
          </div>
        )}

        {/* Expired Warning */}
        {isExpired && (
          <div className="scroll-fade game-card p-4 mb-6 border-yellow-500/30 bg-yellow-500/5" data-delay="160">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
              <p className="text-sm text-yellow-400">
                {tr('Payment window has expired. This order may be auto-rejected.', 'ငွေပေးချေချိန် ကုန်ဆုံးသွားပါပြီ။')}
              </p>
            </div>
          </div>
        )}

        {/* Reject Reason */}
        {order.status === 'rejected' && order.rejectReason && (
          <div className="scroll-fade game-card p-4 mb-6 border-red-500/30 bg-red-500/5" data-delay="160">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-400 mb-1">{tr('Rejection Reason', 'ပယ်ချရသည့်အကြောင်းရင်း')}</p>
                <p className="text-sm text-gray-400">{order.rejectReason}</p>
              </div>
            </div>
          </div>
        )}

        {/* OCR Info */}
        {order.ocrVerified && order.ocrExtractedData && (
          <div className="scroll-fade game-card p-4 mb-6" data-delay="180">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-green-400" />
              <span className="text-sm font-semibold text-green-400">{tr('Auto-verified by OCR', 'OCR ဖြင့်အလိုအလျောက်စစ်ဆေးပြီး')}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-gray-500">{tr('Amount', 'ပမာဏ')}</p>
                <p className="text-white font-mono">{order.ocrExtractedData.amount || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">TxID</p>
                <p className="text-white font-mono">{order.ocrExtractedData.transactionId || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">{tr('Confidence', 'ယုံကြည်မှု')}</p>
                <p className="text-white font-mono">{order.ocrExtractedData.confidence}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Delivered Keys */}
        {order.status === 'completed' && order.deliveredKeys?.length > 0 && (
          <div className="scroll-fade mb-6" data-delay="200">
            <MyKeys keys={order.deliveredKeys} productName={order.product?.name || 'Product'} />
          </div>
        )}

        {/* VPN Key */}
        {order.status === 'completed' && order.orderType === 'vpn' && order.vpnKey && (
          <div className="scroll-fade mb-6" data-delay="200">
            <VpnKeyDisplay vpnKey={order.vpnKey} vpnPlan={order.vpnPlan} />
          </div>
        )}

        {/* Admin Note */}
        {order.adminNote && (
          <div className="scroll-fade game-card p-4 mb-6" data-delay="220">
            <p className="text-xs text-gray-500 mb-1">{tr('Admin Note', 'Admin မှတ်ချက်')}</p>
            <p className="text-sm text-gray-300">{order.adminNote}</p>
          </div>
        )}
      </div>
    </div>
  );
}
