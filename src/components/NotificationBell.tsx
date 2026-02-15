'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check, CheckCheck, ShoppingBag, AlertCircle, Package } from 'lucide-react';
import { useLanguage } from '@/lib/language';

interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  orderId?: string;
  read: boolean;
  createdAt: string;
}

export default function NotificationBell() {
  const { tr } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=15');
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data.notifications);
        setUnreadCount(data.data.unreadCount);
      }
    } catch {
      // silent fail
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll every 30 seconds for new notifications
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function markAllRead() {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      const data = await res.json();
      if (data.success) {
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }

  async function markOneRead(id: string) {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silent fail
    }
  }

  function getIcon(type: string) {
    switch (type) {
      case 'order_completed':
        return <Check className="w-4 h-4 text-green-400" />;
      case 'order_rejected':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'order_placed':
      case 'order_verifying':
        return <ShoppingBag className="w-4 h-4 text-blue-400" />;
      case 'admin_new_order':
        return <Package className="w-4 h-4 text-purple-400" />;
      default:
        return <Bell className="w-4 h-4 text-gray-400" />;
    }
  }

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return tr('Just now', 'ယခုလေးတင်');
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative p-2.5 rounded-xl bg-dark-800 border border-dark-600 hover:border-purple-500/50 hover:shadow-glow-sm transition-all duration-200"
      >
        <Bell className="w-4.5 h-4.5 text-gray-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 glass-panel shadow-2xl shadow-black/50 overflow-hidden animate-slide-up z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/5 bg-gradient-to-r from-purple-500/10 to-transparent flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">
              {tr('Notifications', 'အသိပေးချက်များ')}
              {unreadCount > 0 && (
                <span className="ml-2 px-2 py-0.5 text-[10px] font-bold bg-purple-500/20 text-purple-400 rounded-full">
                  {unreadCount}
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                disabled={loading}
                className="text-xs text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                {tr('Mark all read', 'အားလုံးဖတ်ပြီး')}
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-8 h-8 text-dark-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  {tr('No notifications yet', 'အသိပေးချက်မရှိသေးပါ')}
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif._id}
                  onClick={() => {
                    if (!notif.read) markOneRead(notif._id);
                    if (notif.orderId) {
                      // Navigate to orders page
                      window.location.href = notif.type === 'admin_new_order'
                        ? '/admin/orders'
                        : '/account/orders';
                      setIsOpen(false);
                    }
                  }}
                  className={`w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/[0.03] last:border-0 ${
                    !notif.read ? 'bg-purple-500/5' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    <div className={`mt-0.5 p-1.5 rounded-lg ${!notif.read ? 'bg-purple-500/10' : 'bg-dark-800'}`}>
                      {getIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm font-semibold truncate ${!notif.read ? 'text-white' : 'text-gray-400'}`}>
                          {notif.title}
                        </p>
                        <span className="text-[10px] text-gray-600 whitespace-nowrap">
                          {timeAgo(notif.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {notif.message}
                      </p>
                    </div>
                    {!notif.read && (
                      <div className="mt-2 w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-white/5 text-center">
              <button
                onClick={() => {
                  window.location.href = '/account/orders';
                  setIsOpen(false);
                }}
                className="text-xs text-purple-400 hover:text-purple-300 font-medium transition-colors"
              >
                {tr('View all orders', 'အော်ဒါအားလုံးကြည့်မည်')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
