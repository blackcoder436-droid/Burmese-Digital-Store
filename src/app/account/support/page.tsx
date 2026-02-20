'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Loader2,
  X,
  Send,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/language';
import { useScrollFade } from '@/hooks/useScrollFade';

interface Ticket {
  _id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
}

const statusColors: Record<string, string> = {
  open: 'bg-blue-500/20 text-blue-300',
  'in-progress': 'bg-yellow-500/20 text-yellow-300',
  resolved: 'bg-green-500/20 text-green-300',
  closed: 'bg-gray-500/20 text-gray-400',
};

const statusIcons: Record<string, React.ReactNode> = {
  open: <AlertCircle className="w-3.5 h-3.5" />,
  'in-progress': <Clock className="w-3.5 h-3.5" />,
  resolved: <CheckCircle className="w-3.5 h-3.5" />,
  closed: <CheckCircle className="w-3.5 h-3.5" />,
};

const categoryLabels: Record<string, string> = {
  order: 'Order',
  payment: 'Payment',
  vpn: 'VPN',
  account: 'Account',
  other: 'Other',
};

export default function SupportPage() {
  const { t } = useLanguage();
  const containerRef = useScrollFade();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({ subject: '', category: 'other', message: '' });

  useEffect(() => {
    fetchTickets();
  }, [filter]);

  async function fetchTickets() {
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('status', filter);
      const res = await fetch(`/api/support?${params}`);
      const data = await res.json();
      if (data.success) {
        setTickets(data.data.tickets);
      }
    } catch {
      toast.error(t('account.somethingWrong'));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) {
      toast.error(t('support.fillRequired'));
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t('support.ticketCreated'));
        setShowNewTicket(false);
        setForm({ subject: '', category: 'other', message: '' });
        fetchTickets();
      } else {
        toast.error(data.error || t('support.createFailed'));
      }
    } catch {
      toast.error(t('account.somethingWrong'));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div ref={containerRef} className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/account"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">{t('support.title')}</h1>
            <p className="text-sm text-gray-500">{t('support.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={() => setShowNewTicket(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('support.newTicket')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {['all', 'open', 'in-progress', 'resolved', 'closed'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              filter === s
                ? 'bg-purple-500/20 text-purple-300'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }`}
          >
            {s === 'all' ? t('support.all') : t(`support.status.${s.replace('-', '')}`)}
          </button>
        ))}
      </div>

      {/* Ticket List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-20">
          <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">{t('support.noTickets')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Link
              key={ticket._id}
              href={`/account/support/${ticket._id}`}
              className="block p-4 bg-white/[0.03] border border-purple-500/10 rounded-xl hover:bg-white/[0.06] transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-gray-500">
                      {ticket.ticketNumber}
                    </span>
                    <span className="text-xs text-gray-600">•</span>
                    <span className="text-xs text-gray-500">
                      {categoryLabels[ticket.category] || ticket.category}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white truncate">
                    {ticket.subject}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(ticket.updatedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[ticket.status] || ''}`}>
                  {statusIcons[ticket.status]}
                  {ticket.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* New Ticket Modal */}
      {showNewTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowNewTicket(false)} />
          <div className="relative bg-[#0c0c20] border border-purple-500/15 rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">{t('support.newTicket')}</h2>
              <button onClick={() => setShowNewTicket(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">{t('support.subject')}</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  maxLength={200}
                  className="w-full px-3 py-2 bg-white/5 border border-purple-500/15 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/30"
                  placeholder={t('support.subjectPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">{t('support.category')}</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 bg-white/5 border border-purple-500/15 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/30"
                >
                  {['order', 'payment', 'vpn', 'account', 'other'].map((c) => (
                    <option key={c} value={c} className="bg-[#0c0c20]">
                      {t(`support.categories.${c}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">{t('support.message')}</label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  maxLength={2000}
                  rows={4}
                  className="w-full px-3 py-2 bg-white/5 border border-purple-500/15 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500/30 resize-none"
                  placeholder={t('support.messagePlaceholder')}
                />
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {creating ? t('support.creating') : t('support.submit')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
