'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Search,
  Filter,
  User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/language';

interface Ticket {
  _id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  user: { _id: string; name: string; email: string; avatar?: string };
  assignedTo?: { _id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

const statusColors: Record<string, string> = {
  open: 'bg-blue-500/20 text-blue-300 border-blue-500/20',
  'in-progress': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/20',
  resolved: 'bg-green-500/20 text-green-300 border-green-500/20',
  closed: 'bg-gray-500/20 text-gray-400 border-gray-500/20',
};

const priorityColors: Record<string, string> = {
  low: 'text-gray-400',
  medium: 'text-yellow-400',
  high: 'text-red-400',
};

const statusIcons: Record<string, React.ReactNode> = {
  open: <AlertCircle className="w-3.5 h-3.5" />,
  'in-progress': <Clock className="w-3.5 h-3.5" />,
  resolved: <CheckCircle className="w-3.5 h-3.5" />,
  closed: <CheckCircle className="w-3.5 h-3.5" />,
};

export default function AdminSupportPage() {
  const { t } = useLanguage();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ open: 0, inProgress: 0 });
  const [filter, setFilter] = useState({ status: '', category: '', priority: '' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchTickets();
  }, [filter, page]);

  async function fetchTickets() {
    try {
      const params = new URLSearchParams();
      if (filter.status) params.set('status', filter.status);
      if (filter.category) params.set('category', filter.category);
      if (filter.priority) params.set('priority', filter.priority);
      params.set('page', String(page));

      const res = await fetch(`/api/admin/support?${params}`);
      const data = await res.json();
      if (data.success) {
        setTickets(data.data.tickets);
        setStats(data.data.stats);
        setTotalPages(data.data.pagination.pages);
      }
    } catch {
      toast.error('Failed to fetch tickets');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Header + Stats */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">{t('support.admin.title')}</h1>
        <p className="text-sm text-gray-500">{t('support.admin.subtitle')}</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
          <div className="p-4 bg-blue-500/10 border border-blue-500/15 rounded-xl">
            <p className="text-2xl font-bold text-blue-300">{stats.open}</p>
            <p className="text-xs text-gray-500">{t('support.admin.openTickets')}</p>
          </div>
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/15 rounded-xl">
            <p className="text-2xl font-bold text-yellow-300">{stats.inProgress}</p>
            <p className="text-xs text-gray-500">{t('support.admin.inProgressTickets')}</p>
          </div>
          <div className="p-4 bg-purple-500/10 border border-purple-500/15 rounded-xl">
            <p className="text-2xl font-bold text-purple-300">{tickets.length > 0 ? tickets.length : '—'}</p>
            <p className="text-xs text-gray-500">{t('support.admin.showing')}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <select
          value={filter.status}
          onChange={(e) => { setFilter({ ...filter, status: e.target.value }); setPage(1); }}
          className="px-3 py-1.5 bg-white/5 border border-purple-500/15 rounded-lg text-sm text-gray-300 focus:outline-none"
        >
          <option value="" className="bg-[#0c0c20]">{t('support.admin.allStatuses')}</option>
          {['open', 'in-progress', 'resolved', 'closed'].map((s) => (
            <option key={s} value={s} className="bg-[#0c0c20]">{s}</option>
          ))}
        </select>

        <select
          value={filter.category}
          onChange={(e) => { setFilter({ ...filter, category: e.target.value }); setPage(1); }}
          className="px-3 py-1.5 bg-white/5 border border-purple-500/15 rounded-lg text-sm text-gray-300 focus:outline-none"
        >
          <option value="" className="bg-[#0c0c20]">{t('support.admin.allCategories')}</option>
          {['order', 'payment', 'vpn', 'account', 'other'].map((c) => (
            <option key={c} value={c} className="bg-[#0c0c20]">{c}</option>
          ))}
        </select>

        <select
          value={filter.priority}
          onChange={(e) => { setFilter({ ...filter, priority: e.target.value }); setPage(1); }}
          className="px-3 py-1.5 bg-white/5 border border-purple-500/15 rounded-lg text-sm text-gray-300 focus:outline-none"
        >
          <option value="" className="bg-[#0c0c20]">{t('support.admin.allPriorities')}</option>
          {['low', 'medium', 'high'].map((p) => (
            <option key={p} value={p} className="bg-[#0c0c20]">{p}</option>
          ))}
        </select>
      </div>

      {/* Tickets Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-20">
          <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">{t('support.admin.noTickets')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-purple-500/10">
                <th className="text-left py-3 px-3 font-medium">#</th>
                <th className="text-left py-3 px-3 font-medium">{t('support.subject')}</th>
                <th className="text-left py-3 px-3 font-medium">{t('support.admin.user')}</th>
                <th className="text-left py-3 px-3 font-medium">{t('support.category')}</th>
                <th className="text-left py-3 px-3 font-medium">{t('admin.status')}</th>
                <th className="text-left py-3 px-3 font-medium">{t('support.admin.priority')}</th>
                <th className="text-left py-3 px-3 font-medium">{t('admin.date')}</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr
                  key={ticket._id}
                  className="border-b border-purple-500/5 hover:bg-white/[0.03] cursor-pointer transition-colors"
                  onClick={() => window.location.href = `/admin/support/${ticket._id}`}
                >
                  <td className="py-3 px-3 font-mono text-xs text-gray-500">{ticket.ticketNumber}</td>
                  <td className="py-3 px-3">
                    <span className="text-white font-medium truncate block max-w-[200px]">{ticket.subject}</span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                        <User className="w-3 h-3 text-gray-400" />
                      </div>
                      <span className="text-gray-300 text-xs">{ticket.user?.name || ticket.user?.email}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-xs text-gray-400 capitalize">{ticket.category}</td>
                  <td className="py-3 px-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[ticket.status]}`}>
                      {statusIcons[ticket.status]}
                      {ticket.status}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`text-xs font-semibold capitalize ${priorityColors[ticket.priority]}`}>
                      {ticket.priority}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-xs text-gray-500">
                    {new Date(ticket.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${
                page === p
                  ? 'bg-purple-500/20 text-purple-300'
                  : 'text-gray-500 hover:bg-white/5'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
