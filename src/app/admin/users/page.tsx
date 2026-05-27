'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Gift,
  ChevronLeft,
  ChevronRight,
  Search,
  Shield,
  ShieldOff,
  Trash2,
  Eye,
  X,
  Loader2,
  Users,
  ShoppingBag,
  DollarSign,
  Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/language';

interface UserData {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  balance: number;
  avatar?: string;
  totalOrders: number;
  totalSpent: number;
  createdAt: string;
}

interface FreeTestUser {
  _id: string;
  name: string;
  email: string;
  telegramId?: number;
  telegramUsername?: string;
  freeVpnTestUsedAt: string;
  createdAt: string;
}

interface FreeTestPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function AdminUsersPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [freeUsers, setFreeUsers] = useState<FreeTestUser[]>([]);
  const [freeLoading, setFreeLoading] = useState(false);
  const [freeSearch, setFreeSearch] = useState('');
  const [freePagination, setFreePagination] = useState<FreeTestPagination>({ page: 1, limit: 20, total: 0, pages: 1 });
  const activeView = searchParams.get('view') === 'free-test' ? 'free-test' : 'users';

  useEffect(() => {
    if (activeView !== 'users') return;
    fetchUsers();
  }, [roleFilter, activeView]);

  // Debounced search
  useEffect(() => {
    if (activeView !== 'users') return;
    const timer = setTimeout(() => fetchUsers(), 400);
    return () => clearTimeout(timer);
  }, [search, activeView]);

  useEffect(() => {
    if (activeView !== 'free-test') return;
    fetchFreeTestUsers(1, freeSearch);
  }, [activeView]);

  useEffect(() => {
    if (activeView !== 'free-test') return;
    const timer = setTimeout(() => fetchFreeTestUsers(1, freeSearch), 400);
    return () => clearTimeout(timer);
  }, [freeSearch, activeView]);

  function switchView(nextView: 'users' | 'free-test') {
    setSelectedUser(null);
    if (nextView === 'free-test') {
      router.replace('/admin/users?view=free-test');
    } else {
      router.replace('/admin/users');
    }
  }

  async function fetchUsers(page = 1) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '20', page: String(page) });
      if (search.trim()) params.set('search', search.trim());
      if (roleFilter) params.set('role', roleFilter);

      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.data.users);
        setPagination(data.data.pagination);
      }
    } catch {
      toast.error(t('admin.usersPage.failedFetchUsers'));
    } finally {
      setLoading(false);
    }
  }

  async function fetchFreeTestUsers(page = 1, searchValue = freeSearch) {
    setFreeLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(freePagination.limit),
      });
      if (searchValue.trim()) params.set('search', searchValue.trim());

      const res = await fetch(`/api/admin/free-test-users?${params}`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch free test users');
      }

      setFreeUsers(data.data.users || []);
      setFreePagination(data.data.pagination || { page: 1, limit: 20, total: 0, pages: 1 });
    } catch {
      toast.error('Failed to load free test users');
    } finally {
      setFreeLoading(false);
    }
  }

  async function updateRole(userId: string, newRole: 'user' | 'admin') {
    setProcessing(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          newRole === 'admin'
            ? t('admin.usersPage.promotedToAdmin')
            : t('admin.usersPage.demotedToUser')
        );
        fetchUsers(pagination.page);
        if (selectedUser?._id === userId) {
          setSelectedUser({ ...selectedUser, role: newRole });
        }
      } else {
        toast.error(data.error || t('admin.usersPage.failedUpdate'));
      }
    } catch {
      toast.error(t('common.error'));
    } finally {
      setProcessing(null);
    }
  }

  async function deleteUser(userId: string, userName: string) {
    if (
      !confirm(
        t('admin.usersPage.confirmDelete').replace('{name}', userName)
      )
    )
      return;

    setProcessing(userId);
    try {
      const res = await fetch(`/api/admin/users?userId=${userId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t('admin.usersPage.userDeleted'));
        setSelectedUser(null);
        fetchUsers(pagination.page);
      } else {
        toast.error(data.error || t('admin.usersPage.failedDelete'));
      }
    } catch {
      toast.error(t('common.error'));
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="heading-lg">{t('admin.usersPage.title')}</h1>
        <p className="text-sm text-gray-500">
          {activeView === 'users' ? (
            <>
              {t('admin.usersPage.totalPrefix')} <span className="text-purple-400 font-bold">{pagination.total}</span> {t('admin.usersPage.totalSuffix')}
            </>
          ) : (
            <>
              Free test records: <span className="text-purple-400 font-bold">{freePagination.total}</span>
            </>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => switchView('users')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeView === 'users'
              ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-glow-sm'
              : 'bg-[#12122a] text-gray-400 hover:text-white border border-purple-500/[0.15] hover:border-purple-500/50'
          }`}
        >
          <Users className="w-4 h-4" />
          Users
        </button>
        <button
          onClick={() => switchView('free-test')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeView === 'free-test'
              ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-glow-sm'
              : 'bg-[#12122a] text-gray-400 hover:text-white border border-purple-500/[0.15] hover:border-purple-500/50'
          }`}
        >
          <Gift className="w-4 h-4" />
          Free Test Users
        </button>
      </div>

      {activeView === 'users' ? (
        <>
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('admin.usersPage.searchPlaceholder')}
                className="input-field pl-10 !bg-[#12122a]"
              />
            </div>
            <div className="flex gap-2">
              {[
                { value: '', label: t('shop.page.all') },
                { value: 'user', label: t('admin.users') },
                { value: 'admin', label: t('admin.usersPage.admins') },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setRoleFilter(f.value)}
                  className={`px-4 py-2 text-sm rounded-xl font-medium transition-all ${
                    roleFilter === f.value
                      ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-glow-sm'
                      : 'bg-[#12122a] text-gray-400 hover:text-white border border-purple-500/[0.15] hover:border-purple-500/50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={freeSearch}
              onChange={(e) => setFreeSearch(e.target.value)}
              placeholder="Search by name, email, Telegram username or Telegram ID"
              className="input-field pl-10 !bg-[#12122a]"
            />
          </div>
          <p className="text-sm text-gray-500">
            Total: <span className="text-purple-400 font-bold">{freePagination.total}</span>
          </p>
        </div>
      )}

      {activeView === 'free-test' ? (
        <div className="space-y-6">
          {freeLoading ? (
            <div className="game-card p-12 text-center">
              <Loader2 className="w-10 h-10 text-purple-500 animate-spin mx-auto" />
            </div>
          ) : freeUsers.length === 0 ? (
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
                      {freeUsers.map((user) => (
                        <tr key={user._id} className="text-gray-200 hover:bg-purple-500/5 transition-colors">
                          <td className="p-4 font-medium">{user.name}</td>
                          <td className="p-4 text-gray-300">{user.email}</td>
                          <td className="p-4 text-gray-300">
                            {user.telegramUsername ? `@${user.telegramUsername}` : '-'}
                            {user.telegramId ? <span className="text-xs text-gray-500 ml-2">({user.telegramId})</span> : null}
                          </td>
                          <td className="p-4 text-cyan-300">{new Date(user.freeVpnTestUsedAt).toLocaleString('en-US', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="p-4 text-gray-400">{new Date(user.createdAt).toLocaleString('en-US', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => fetchFreeTestUsers(freePagination.page - 1, freeSearch)}
                  disabled={freePagination.page <= 1 || freeLoading}
                  className="p-2 rounded-lg border border-purple-500/20 text-gray-300 disabled:opacity-40 hover:bg-purple-500/10"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-400 px-2">
                  Page {freePagination.page} / {Math.max(1, freePagination.pages)}
                </span>
                <button
                  onClick={() => fetchFreeTestUsers(freePagination.page + 1, freeSearch)}
                  disabled={freePagination.page >= freePagination.pages || freeLoading}
                  className="p-2 rounded-lg border border-purple-500/20 text-gray-300 disabled:opacity-40 hover:bg-purple-500/10"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {activeView === 'users' ? (
        <>
      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="game-card w-full max-w-lg p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="heading-sm">{t('admin.usersPage.userDetails')}</h2>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-dark-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Avatar & Name */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-purple-500/30 to-cyan-500/30 flex items-center justify-center shrink-0">
                  {selectedUser.avatar ? (
                    <img src={selectedUser.avatar} alt={selectedUser.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-black text-white uppercase">{selectedUser.name.charAt(0)}</span>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedUser.name}</h3>
                  <p className="text-sm text-gray-400">{selectedUser.email}</p>
                  <span
                    className={`inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold ${
                      selectedUser.role === 'admin'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                    }`}
                  >
                    <Shield className="w-3 h-3" />
                    {selectedUser.role.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-dark-800 rounded-xl p-3 text-center">
                  <ShoppingBag className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-white">{selectedUser.totalOrders}</p>
                  <p className="text-[10px] text-gray-500 uppercase">{t('admin.orders')}</p>
                </div>
                <div className="bg-dark-800 rounded-xl p-3 text-center">
                  <DollarSign className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-white">{selectedUser.totalSpent.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-500 uppercase">{t('admin.usersPage.spent')}</p>
                </div>
                <div className="bg-dark-800 rounded-xl p-3 text-center">
                  <DollarSign className="w-4 h-4 text-sky-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-white">{selectedUser.balance.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-500 uppercase">{t('admin.usersPage.balance')}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Calendar className="w-4 h-4" />
                {t('admin.usersPage.joined')} {new Date(selectedUser.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-dark-700">
                {selectedUser.role === 'user' ? (
                  <button
                    onClick={() => updateRole(selectedUser._id, 'admin')}
                    disabled={processing === selectedUser._id}
                    className="btn-electric flex-1 flex items-center justify-center gap-2"
                  >
                    {processing === selectedUser._id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Shield className="w-4 h-4" />
                    )}
                    <span>{t('admin.usersPage.promoteToAdmin')}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => updateRole(selectedUser._id, 'user')}
                    disabled={processing === selectedUser._id}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all"
                  >
                    {processing === selectedUser._id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ShieldOff className="w-4 h-4" />
                    )}
                    <span>{t('admin.usersPage.demoteToUser')}</span>
                  </button>
                )}
                <button
                  onClick={() => deleteUser(selectedUser._id, selectedUser.name)}
                  disabled={processing === selectedUser._id}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{t('common.delete')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      {loading ? (
        <div className="game-card p-12 text-center">
          <Loader2 className="w-10 h-10 text-purple-500 animate-spin mx-auto" />
        </div>
      ) : users.length === 0 ? (
        <div className="game-card p-16 text-center">
          <Users className="w-16 h-16 text-dark-600 mx-auto mb-4" />
          <h3 className="text-xl text-gray-300 font-medium">
            {t('admin.usersPage.noUsersFound')}
          </h3>
        </div>
      ) : (
        <>
          <div className="game-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 uppercase border-b border-dark-700 bg-dark-800/50">
                    <th className="p-4 font-semibold">{t('admin.user')}</th>
                    <th className="p-4 font-semibold">{t('admin.usersPage.role')}</th>
                    <th className="p-4 font-semibold">{t('admin.orders')}</th>
                    <th className="p-4 font-semibold">{t('admin.usersPage.spent')}</th>
                    <th className="p-4 font-semibold">{t('admin.usersPage.balance')}</th>
                    <th className="p-4 font-semibold">{t('admin.usersPage.joined')}</th>
                    <th className="p-4 font-semibold text-right">{t('admin.usersPage.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700">
                  {users.map((user) => (
                    <tr
                      key={user._id}
                      className="text-gray-200 hover:bg-purple-500/5 transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl overflow-hidden bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center shrink-0">
                            {user.avatar ? (
                              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-sm font-bold text-white uppercase">{user.name.charAt(0)}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-white truncate">{user.name}</p>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold ${
                            user.role === 'admin'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="p-4 text-gray-300">{user.totalOrders}</td>
                      <td className="p-4 font-medium text-purple-400">
                        {user.totalSpent.toLocaleString()}
                      </td>
                      <td className="p-4 text-gray-300">
                        {user.balance.toLocaleString()}
                      </td>
                      <td className="p-4 text-xs text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedUser(user)}
                            className="p-2 text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-all"
                            title={t('admin.usersPage.viewDetails')}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {user.role === 'user' ? (
                            <button
                              onClick={() => updateRole(user._id, 'admin')}
                              disabled={processing === user._id}
                              className="p-2 text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all"
                              title={t('admin.usersPage.promoteToAdmin')}
                            >
                              {processing === user._id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Shield className="w-4 h-4" />
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={() => updateRole(user._id, 'user')}
                              disabled={processing === user._id}
                              className="p-2 text-amber-400 hover:text-gray-400 hover:bg-amber-500/10 rounded-lg transition-all"
                              title={t('admin.usersPage.demoteToUser')}
                            >
                              {processing === user._id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <ShieldOff className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => deleteUser(user._id, user.name)}
                            disabled={processing === user._id}
                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                            title={t('admin.usersPage.deleteUser')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => fetchUsers(page)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                    pagination.page === page
                      ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-glow-sm'
                      : 'bg-[#12122a] text-gray-400 hover:text-white border border-purple-500/[0.15]'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
          )}
        </>
      )}
        </>
      ) : null}
    </div>
  );
}
