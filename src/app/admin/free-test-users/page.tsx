'use client';

import { useEffect, useState } from 'react';
import { Gift, Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface FreeTestUser {
  _id: string;
  name: string;
  email: string;
  telegramId?: number;
  telegramUsername?: string;
  freeVpnTestUsedAt: string;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function AdminFreeTestUsersPage() {
  const [users, setUsers] = useState<FreeTestUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 1 });

  useEffect(() => {
    fetchUsers(1, search);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(1, search);
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  async function fetchUsers(page = 1, searchValue = '') {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pagination.limit),
      });

      if (searchValue.trim()) params.set('search', searchValue.trim());

      const res = await fetch(`/api/admin/free-test-users?${params}`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch free test users');
      }

      setUsers(data.data.users || []);
      setPagination(data.data.pagination || { page: 1, limit: 20, total: 0, pages: 1 });
    } catch {
      toast.error('Failed to load free test users');
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="heading-lg flex items-center gap-2">
            <Gift className="w-6 h-6 text-purple-400" />
            Free Test Users
          </h1>
          <p className="text-sm text-gray-500 mt-1">Users who already claimed free VPN test key</p>
        </div>
        <p className="text-sm text-gray-500">
          Total: <span className="text-purple-400 font-bold">{pagination.total}</span>
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, Telegram username or Telegram ID"
          className="input-field pl-10 !bg-[#12122a]"
        />
      </div>

      {loading ? (
        <div className="game-card p-12 text-center">
          <Loader2 className="w-10 h-10 text-purple-500 animate-spin mx-auto" />
        </div>
      ) : users.length === 0 ? (
        <div className="game-card p-16 text-center">
          <Gift className="w-16 h-16 text-dark-600 mx-auto mb-4" />
          <h3 className="text-xl text-gray-300 font-medium">No free test records found</h3>
        </div>
      ) : (
        <>
          <div className="game-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 uppercase border-b border-dark-700 bg-dark-800/50">
                    <th className="p-4 font-semibold">User</th>
                    <th className="p-4 font-semibold">Email</th>
                    <th className="p-4 font-semibold">Telegram</th>
                    <th className="p-4 font-semibold">Free Key Claimed At</th>
                    <th className="p-4 font-semibold">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700">
                  {users.map((user) => (
                    <tr key={user._id} className="text-gray-200 hover:bg-purple-500/5 transition-colors">
                      <td className="p-4 font-medium">{user.name}</td>
                      <td className="p-4 text-gray-300">{user.email}</td>
                      <td className="p-4 text-gray-300">
                        {user.telegramUsername ? `@${user.telegramUsername}` : '-'}
                        {user.telegramId ? <span className="text-xs text-gray-500 ml-2">({user.telegramId})</span> : null}
                      </td>
                      <td className="p-4 text-cyan-300">{formatDate(user.freeVpnTestUsedAt)}</td>
                      <td className="p-4 text-gray-400">{formatDate(user.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => fetchUsers(pagination.page - 1, search)}
              disabled={pagination.page <= 1 || loading}
              className="p-2 rounded-lg border border-purple-500/20 text-gray-300 disabled:opacity-40 hover:bg-purple-500/10"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-400 px-2">
              Page {pagination.page} / {Math.max(1, pagination.pages)}
            </span>
            <button
              onClick={() => fetchUsers(pagination.page + 1, search)}
              disabled={pagination.page >= pagination.pages || loading}
              className="p-2 rounded-lg border border-purple-500/20 text-gray-300 disabled:opacity-40 hover:bg-purple-500/10"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
