'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/language';
import { useScrollFade } from '@/hooks/useScrollFade';

interface Message {
  _id: string;
  sender: { _id: string; name: string; avatar?: string; role?: string };
  senderRole: 'user' | 'admin';
  content: string;
  createdAt: string;
}

interface Ticket {
  _id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  messages: Message[];
  relatedOrder?: { _id: string; orderNumber: string; status: string };
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

export default function TicketDetailPage() {
  const { t } = useLanguage();
  const containerRef = useScrollFade();
  const params = useParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchTicket();
  }, [params.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages]);

  async function fetchTicket() {
    try {
      const res = await fetch(`/api/support/${params.id}`);
      const data = await res.json();
      if (data.success) {
        setTicket(data.data.ticket);
      } else {
        toast.error(data.error || t('support.ticketNotFound'));
      }
    } catch {
      toast.error(t('account.somethingWrong'));
    } finally {
      setLoading(false);
    }
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/support/${params.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: reply }),
      });
      const data = await res.json();
      if (data.success) {
        setTicket(data.data.ticket);
        setReply('');
        toast.success(t('support.replySent'));
      } else {
        toast.error(data.error || t('support.replyFailed'));
      }
    } catch {
      toast.error(t('account.somethingWrong'));
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-500">{t('support.ticketNotFound')}</p>
        <Link href="/account/support" className="text-purple-400 hover:underline text-sm mt-2 inline-block">
          {t('support.backToTickets')}
        </Link>
      </div>
    );
  }

  const isClosed = ticket.status === 'closed';

  return (
    <div ref={containerRef} className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/account/support"
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-mono text-gray-500">{ticket.ticketNumber}</span>
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColors[ticket.status]}`}>
              {statusIcons[ticket.status]}
              {ticket.status}
            </span>
          </div>
          <h1 className="text-lg font-bold text-white truncate">{ticket.subject}</h1>
        </div>
      </div>

      {/* Related Order */}
      {ticket.relatedOrder && (
        <Link
          href={`/account/orders/${ticket.relatedOrder._id}`}
          className="block mb-4 p-3 bg-white/[0.03] border border-purple-500/10 rounded-xl hover:bg-white/[0.06] transition-colors"
        >
          <span className="text-xs text-gray-500">{t('support.relatedOrder')}:</span>
          <span className="text-sm text-purple-300 ml-2 font-semibold">{ticket.relatedOrder.orderNumber}</span>
        </Link>
      )}

      {/* Messages */}
      <div className="space-y-4 mb-6 max-h-[60vh] overflow-y-auto p-1">
        {ticket.messages.map((msg) => {
          const isAdmin = msg.senderRole === 'admin';
          return (
            <div key={msg._id} className={`flex gap-3 ${isAdmin ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                isAdmin ? 'bg-purple-500/20' : 'bg-white/10'
              }`}>
                {isAdmin ? <Shield className="w-4 h-4 text-purple-400" /> : <User className="w-4 h-4 text-gray-400" />}
              </div>
              <div className={`max-w-[75%] ${isAdmin ? 'text-right' : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold ${isAdmin ? 'text-purple-300' : 'text-gray-300'}`}>
                    {msg.sender?.name || (isAdmin ? 'Admin' : 'You')}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {new Date(msg.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className={`inline-block px-3 py-2 rounded-xl text-sm ${
                  isAdmin
                    ? 'bg-purple-500/15 text-gray-200'
                    : 'bg-white/[0.06] text-gray-300'
                }`}>
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Form */}
      {isClosed ? (
        <div className="text-center py-4 bg-white/[0.03] border border-purple-500/10 rounded-xl">
          <p className="text-sm text-gray-500">{t('support.ticketClosed')}</p>
        </div>
      ) : (
        <form onSubmit={handleReply} className="flex gap-3">
          <input
            type="text"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            maxLength={2000}
            className="flex-1 px-4 py-2.5 bg-white/5 border border-purple-500/15 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500/30"
            placeholder={t('support.typeReply')}
          />
          <button
            type="submit"
            disabled={sending || !reply.trim()}
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl transition-colors"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      )}
    </div>
  );
}
