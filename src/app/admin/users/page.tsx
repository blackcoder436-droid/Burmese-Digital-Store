'use client';

import { useEffect, useState } from 'react';
import {
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
  Mail,
  User,
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

export default function AdminUsersPage() {
  const { tr } = useLanguage();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  useEffect(() => {
    fetchUsers();
  }, [roleFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => fetchUsers(), 400);
    return () => clearTimeout(timer);
  }, [search]);

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
      toast.error(tr('Failed to fetch users', 'အသုံးပြုသူများကိုရယူရန် မအောင်မြင်ပါ'));
    } finally {
      setLoading(false);
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
            ? tr('Promoted to admin!', 'Admin သို့တိုးမြှင့်ပြီး!')
            : tr('Demoted to user!', 'User သို့ပြောင်းပြီး!')
        );
        fetchUsers(pagination.page);
        if (selectedUser?._id === userId) {
          setSelectedUser({ ...selectedUser, role: newRole });
        }
      } else {
        toast.error(data.error || tr('Failed to update', 'ပြင်ဆင်မှုမအောင်မြင်ပါ'));
      }
    } catch {
      toast.error(tr('Something went wrong', 'တစ်ခုခုမှားယွင်းနေပါသည်'));
    } finally {
      setProcessing(null);
    }
  }

  async function deleteUser(userId: string, userName: string) {
    if (
      !confirm(
        tr(
          `Are you sure you want to delete "${userName}"? This action cannot be undone.`,
          `"${userName}" ကိုဖျက်လိုသည်မှာ သေချာပါသလား? ဤလုပ်ဆောင်ချက်ကို ပြန်ပြင်၍မရပါ။`
        )
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
        toast.success(tr('User deleted', 'အသုံးပြုသူကိုဖျက်ပြီးပါပြီ'));
        setSelectedUser(null);
        fetchUsers(pagination.page);
      } else {
        toast.error(data.error || tr('Failed to delete', 'ဖျက်မှုမအောင်မြင်ပါ'));
      }
    } catch {
      toast.error(tr('Something went wrong', 'တစ်ခုခုမှားယွင်းနေပါသည်'));
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="heading-lg">{tr('User Management', 'အသုံးပြုသူစီမံခန့်ခွဲမှု')}</h1>
        <p className="text-sm text-gray-500">
          {tr('Total:', 'စုစုပေါင်း:')} <span className="text-purple-400 font-bold">{pagination.total}</span> {tr('users', 'ဦး')}
        </p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('Search by name or email...', 'အမည် သို့မဟုတ် အီးမေးလ်ဖြင့်ရှာဖွေပါ...')}
            className="input-field pl-10 !bg-[#12122a]"
          />
        </div>
        <div className="flex gap-2">
          {[
            { value: '', label: tr('All', 'အားလုံး') },
            { value: 'user', label: tr('Users', 'Users') },
            { value: 'admin', label: tr('Admins', 'Admins') },
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

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="game-card w-full max-w-lg p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="heading-sm">{tr('User Details', 'အသုံးပြုသူအသေးစိတ်')}</h2>
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
                  <p className="text-[10px] text-gray-500 uppercase">{tr('Orders', 'အော်ဒါ')}</p>
                </div>
                <div className="bg-dark-800 rounded-xl p-3 text-center">
                  <DollarSign className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-white">{selectedUser.totalSpent.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-500 uppercase">{tr('Spent', 'သုံးငွေ')}</p>
                </div>
                <div className="bg-dark-800 rounded-xl p-3 text-center">
                  <DollarSign className="w-4 h-4 text-sky-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-white">{selectedUser.balance.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-500 uppercase">{tr('Balance', 'လက်ကျန်')}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Calendar className="w-4 h-4" />
                {tr('Joined', 'စတင်သည့်နေ့')} {new Date(selectedUser.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
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
                    <span>{tr('Promote to Admin', 'Admin သို့တိုးမြှင့်')}</span>
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
                    <span>{tr('Demote to User', 'User သို့ပြောင်း')}</span>
                  </button>
                )}
                <button
                  onClick={() => deleteUser(selectedUser._id, selectedUser.name)}
                  disabled={processing === selectedUser._id}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{tr('Delete', 'ဖျက်')}</span>
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
            {tr('No users found', 'အသုံးပြုသူမတွေ့ပါ')}
          </h3>
        </div>
      ) : (
        <>
          <div className="game-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 uppercase border-b border-dark-700 bg-dark-800/50">
                    <th className="p-4 font-semibold">{tr('User', 'အသုံးပြုသူ')}</th>
                    <th className="p-4 font-semibold">{tr('Role', 'ရာထူး')}</th>
                    <th className="p-4 font-semibold">{tr('Orders', 'အော်ဒါ')}</th>
                    <th className="p-4 font-semibold">{tr('Spent', 'သုံးငွေ')}</th>
                    <th className="p-4 font-semibold">{tr('Balance', 'လက်ကျန်')}</th>
                    <th className="p-4 font-semibold">{tr('Joined', 'စတင်သည့်နေ့')}</th>
                    <th className="p-4 font-semibold text-right">{tr('Actions', 'လုပ်ဆောင်ရန်')}</th>
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
                            title={tr('View Details', 'အသေးစိတ်ကြည့်ရန်')}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {user.role === 'user' ? (
                            <button
                              onClick={() => updateRole(user._id, 'admin')}
                              disabled={processing === user._id}
                              className="p-2 text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all"
                              title={tr('Promote to Admin', 'Admin သို့တိုးမြှင့်')}
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
                              title={tr('Demote to User', 'User သို့ပြောင်း')}
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
                            title={tr('Delete User', 'အသုံးပြုသူကိုဖျက်ရန်')}
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
    </div>
  );
}
