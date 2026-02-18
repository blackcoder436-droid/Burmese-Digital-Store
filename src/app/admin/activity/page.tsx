'use client';

import { useEffect, useState } from 'react';
import {
  History,
  ShoppingCart,
  Package,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
} from 'lucide-react';
import { useLanguage } from '@/lib/language';

interface ActivityLog {
  _id: string;
  admin: { _id: string; name: string; email: string; avatar?: string };
  action: string;
  target: string;
  details?: string;
  createdAt: string;
}

const actionConfig: Record<string, { icon: any; color: string; label: string; labelMy: string }> = {
  order_approved: { icon: ShoppingCart, color: 'text-emerald-400 bg-emerald-500/20', label: 'Order Approved', labelMy: 'အော်ဒါအတည်ပြု' },
  order_rejected: { icon: ShoppingCart, color: 'text-red-400 bg-red-500/20', label: 'Order Rejected', labelMy: 'အော်ဒါပယ်ချ' },
  order_refunded: { icon: ShoppingCart, color: 'text-amber-400 bg-amber-500/20', label: 'Order Refunded', labelMy: 'အော်ဒါပြန်အမ်း' },
  product_created: { icon: Package, color: 'text-blue-400 bg-blue-500/20', label: 'Product Created', labelMy: 'ပစ္စည်းအသစ်' },
  product_updated: { icon: Package, color: 'text-purple-400 bg-purple-500/20', label: 'Product Updated', labelMy: 'ပစ္စည်းပြင်ဆင်' },
  product_deleted: { icon: Package, color: 'text-red-400 bg-red-500/20', label: 'Product Deleted', labelMy: 'ပစ္စည်းဖျက်' },
  user_promoted: { icon: Users, color: 'text-cyan-400 bg-cyan-500/20', label: 'User Promoted', labelMy: 'အသုံးပြုသူတိုး' },
  user_demoted: { icon: Users, color: 'text-orange-400 bg-orange-500/20', label: 'User Demoted', labelMy: 'အသုံးပြုသူလျှော့' },
  user_deleted: { icon: Users, color: 'text-red-400 bg-red-500/20', label: 'User Deleted', labelMy: 'အသုံးပြုသူဖျက်' },
  settings_updated: { icon: Settings, color: 'text-gray-400 bg-gray-500/20', label: 'Settings Updated', labelMy: 'ဆက်တင်ပြင်ဆင်' },
};

export default function ActivityLogPage() {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterAction, setFilterAction] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [page, filterAction]);

  async function fetchLogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (filterAction) params.set('action', filterAction);

      const res = await fetch(`/api/admin/activity?${params}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.data.logs);
        setTotalPages(data.data.pagination.pages);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  function timeAgo(date: string) {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return t('admin.activityPage.justNow');
    if (seconds < 3600) return `${Math.floor(seconds / 60)}${t('admin.activityPage.mAgo')}`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}${t('admin.activityPage.hAgo')}`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}${t('admin.activityPage.dAgo')}`;
    return new Date(date).toLocaleDateString();
  }

  const actionFilters = [
    { value: '', label: t('admin.activityPage.allActions') },
    { value: 'order_approved', label: t('admin.activityPage.approved') },
    { value: 'order_rejected', label: t('admin.activityPage.rejected') },
    { value: 'product_created', label: t('admin.activityPage.productCreated') },
    { value: 'product_updated', label: t('admin.activityPage.productUpdated') },
    { value: 'user_promoted', label: t('admin.activityPage.userPromoted') },
    { value: 'user_deleted', label: t('admin.activityPage.userDeleted') },
    { value: 'settings_updated', label: t('admin.activityPage.settingsUpdated') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
            <History className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{t('admin.activityPage.title')}</h1>
            <p className="text-xs text-gray-500">{t('admin.activityPage.subtitle')}</p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
            className="bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm text-gray-300 focus:border-purple-500 focus:outline-none"
          >
            {actionFilters.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Log List */}
      <div className="game-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20">
            <History className="w-10 h-10 text-dark-600 mx-auto mb-3" />
            <p className="text-gray-500">{t('admin.activityPage.noLogs')}</p>
          </div>
        ) : (
          <div className="divide-y divide-dark-600/50">
            {logs.map((log) => {
              const config = actionConfig[log.action] || { icon: History, color: 'text-gray-400 bg-gray-500/20', label: log.action, labelMy: log.action };
              const Icon = config.icon;
              return (
                <div key={log._id} className="flex items-start gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${config.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{t(`admin.activityPage.actions.${log.action}`)}</span>
                      <span className="text-xs text-gray-500">•</span>
                      <span className="text-xs text-gray-500">{log.admin?.name || 'Admin'}</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-0.5 truncate">{log.target}</p>
                    {log.details && (
                      <p className="text-xs text-gray-500 mt-1">{log.details}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-600 shrink-0 whitespace-nowrap">{timeAgo(log.createdAt)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2 rounded-lg bg-dark-800 border border-dark-600 text-gray-400 hover:text-white disabled:opacity-30 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-500 px-3">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-2 rounded-lg bg-dark-800 border border-dark-600 text-gray-400 hover:text-white disabled:opacity-30 transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
