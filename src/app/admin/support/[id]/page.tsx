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
  Tag,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/language';

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
  user: { _id: string; name: string; email: string; avatar?: string };
  messages: Message[];
  relatedOrder?: { _id: string; orderNumber: string; status: string; totalAmount: number };
  assignedTo?: { _id: string; name: string; email: string };
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const statusOptions = ['open', 'in-progress', 'resolved', 'closed'];
const priorityOptions = ['low', 'medium', 'high'];

const statusColors: Record<string, string> = {
  open: 'bg-blue-500/20 text-blue-300',
  'in-progress': 'bg-yellow-500/20 text-yellow-300',
  resolved: 'bg-green-500/20 text-green-300',
  closed: 'bg-gray-500/20 text-gray-400',
};

const priorityColors: Record<string, string> = {
  low: 'text-gray-400',
  medium: 'text-yellow-400',
  high: 'text-red-400',
};

export default function AdminTicketDetailPage() {
  const { t } = useLanguage();
  const params = useParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchTicket();
  }, [params.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages]);

  async function fetchTicket() {
    try {
      const res = await fetch(`/api/admin/support/${params.id}`);
      const data = await res.json();
      if (data.success) {
        setTicket(data.data.ticket);
      } else {
        toast.error(data.error || 'Ticket not found');
      }
    } catch {
      toast.error('Failed to fetch ticket');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(updates: Record<string, string>) {
    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/support/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.success) {
        setTicket(data.data.ticket);
        toast.success('Ticket updated');
      } else {
        toast.error(data.error || 'Update failed');
      }
    } catch {
      toast.error('Failed to update');
    } finally {
      setUpdating(false);
    }
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/support/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: reply }),
      });
      const data = await res.json();
      if (data.success) {
        setTicket(data.data.ticket);
        setReply('');
        toast.success('Reply sent');
      } else {
        toast.error(data.error || 'Reply failed');
      }
    } catch {
      toast.error('Failed to send reply');
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
      <div className="text-center py-20">
        <p className="text-gray-500">Ticket not found</p>
        <Link href="/admin/support" className="text-purple-400 hover:underline text-sm mt-2 inline-block">
          Back to Support
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/support"
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-mono text-gray-500">{ticket.ticketNumber}</span>
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColors[ticket.status]}`}>
              {ticket.status}
            </span>
            <span className={`text-xs font-semibold capitalize ${priorityColors[ticket.priority]}`}>
              ● {ticket.priority}
            </span>
          </div>
          <h1 className="text-lg font-bold text-white truncate">{ticket.subject}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages Column */}
        <div className="lg:col-span-2">
          {/* Messages */}
          <div className="space-y-4 mb-6 max-h-[55vh] overflow-y-auto p-1">
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
                        {msg.sender?.name || (isAdmin ? 'Admin' : 'User')}
                      </span>
                      <span className="text-[10px] text-gray-600">
                        {new Date(msg.createdAt).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className={`inline-block px-3 py-2 rounded-xl text-sm ${
                      isAdmin ? 'bg-purple-500/15 text-gray-200' : 'bg-white/[0.06] text-gray-300'
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
          <form onSubmit={handleReply} className="flex gap-3">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              maxLength={2000}
              rows={2}
              className="flex-1 px-4 py-2.5 bg-white/5 border border-purple-500/15 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500/30 resize-none"
              placeholder="Type admin reply..."
            />
            <button
              type="submit"
              disabled={sending || !reply.trim()}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl transition-colors self-end"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* User Info */}
          <div className="p-4 bg-white/[0.03] border border-purple-500/10 rounded-xl">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Customer</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                <User className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{ticket.user?.name}</p>
                <p className="text-xs text-gray-500">{ticket.user?.email}</p>
              </div>
            </div>
          </div>

          {/* Related Order */}
          {ticket.relatedOrder && (
            <div className="p-4 bg-white/[0.03] border border-purple-500/10 rounded-xl">
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Related Order</h3>
              <Link
                href={`/admin/orders`}
                className="text-sm text-purple-300 font-semibold hover:underline"
              >
                {ticket.relatedOrder.orderNumber}
              </Link>
              <p className="text-xs text-gray-500 mt-1">
                {ticket.relatedOrder.totalAmount?.toLocaleString()} Ks • {ticket.relatedOrder.status}
              </p>
            </div>
          )}

          {/* Status Control */}
          <div className="p-4 bg-white/[0.03] border border-purple-500/10 rounded-xl">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Status</h3>
            <div className="grid grid-cols-2 gap-2">
              {statusOptions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleUpdate({ status: s })}
                  disabled={updating || ticket.status === s}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                    ticket.status === s
                      ? statusColors[s]
                      : 'bg-white/5 text-gray-500 hover:bg-white/10'
                  } disabled:opacity-50`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Priority Control */}
          <div className="p-4 bg-white/[0.03] border border-purple-500/10 rounded-xl">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Priority</h3>
            <div className="flex gap-2">
              {priorityOptions.map((p) => (
                <button
                  key={p}
                  onClick={() => handleUpdate({ priority: p })}
                  disabled={updating || ticket.priority === p}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                    ticket.priority === p
                      ? `bg-white/10 ${priorityColors[p]}`
                      : 'bg-white/5 text-gray-500 hover:bg-white/10'
                  } disabled:opacity-50`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="p-4 bg-white/[0.03] border border-purple-500/10 rounded-xl text-xs text-gray-500 space-y-1.5">
            <div className="flex justify-between">
              <span>Category</span>
              <span className="text-gray-300 capitalize">{ticket.category}</span>
            </div>
            <div className="flex justify-between">
              <span>Created</span>
              <span className="text-gray-300">{new Date(ticket.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Updated</span>
              <span className="text-gray-300">{new Date(ticket.updatedAt).toLocaleDateString()}</span>
            </div>
            {ticket.closedAt && (
              <div className="flex justify-between">
                <span>Closed</span>
                <span className="text-gray-300">{new Date(ticket.closedAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
