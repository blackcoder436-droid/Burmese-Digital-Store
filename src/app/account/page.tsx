'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  User,
  ShoppingBag,
  Key,
  Clock,
  CheckCircle,
  AlertCircle,
  LogOut,
  Settings,
  Camera,
  Loader2,
  Trash2,
  Edit3,
  Lock,
  Phone,
  Save,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/language';
import { useScrollFade } from '@/hooks/useScrollFade';

interface UserData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  balance: number;
  avatar: string | null;
  createdAt: string;
}

interface SessionInfo {
  issuedAt: string | null;
  expiresAt: string | null;
  remainingSeconds: number | null;
}

export default function AccountPage() {
  const { t } = useLanguage();
  const containerRef = useScrollFade();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<UserData | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState({
    totalOrders: 0,
    completed: 0,
    pending: 0,
  });

  // Profile editing state
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', phone: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingPassword, setSavingPassword] = useState(false);

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  useEffect(() => {
    if (!sessionInfo || sessionInfo.remainingSeconds === null) return;
    const timer = setInterval(() => {
      setSessionInfo((prev) => {
        if (!prev || prev.remainingSeconds === null) return prev;
        return { ...prev, remainingSeconds: Math.max(0, prev.remainingSeconds - 60) };
      });
    }, 60000);
    return () => clearInterval(timer);
  }, [sessionInfo?.remainingSeconds]);

  function formatRemainingTime(seconds: number | null): string {
    if (seconds === null) return t('account.sessionUnknown');
    if (seconds <= 0) return t('account.sessionExpired');

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  async function fetchUserData() {
    try {
      const [userRes, ordersRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/orders?limit=1000'),
      ]);

      const userData = await userRes.json();
      const ordersData = await ordersRes.json();

      if (!userData.success) {
        router.push('/login');
        return;
      }

      setUser(userData.data.user);
      setSessionInfo(userData.data.session || null);

      if (ordersData.success) {
        const orders = ordersData.data.orders;
        const total = ordersData.data.pagination?.total ?? orders.length;
        setStats({
          totalOrders: total,
          completed: orders.filter((o: any) => o.status === 'completed').length,
          pending: orders.filter(
            (o: any) => o.status === 'pending' || o.status === 'verifying'
          ).length,
        });
      }
    } catch {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('account.fileTooLarge'));
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const res = await fetch('/api/auth/avatar', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setUser((prev) => prev ? { ...prev, avatar: data.data.avatar } : prev);
        toast.success(t('account.avatarUpdated'));
      } else {
        toast.error(data.error || t('account.uploadFailed'));
      }
    } catch {
      toast.error(t('account.somethingWrong'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleAvatarRemove() {
    setUploading(true);
    try {
      const res = await fetch('/api/auth/avatar', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setUser((prev) => prev ? { ...prev, avatar: null } : prev);
        toast.success(t('account.avatarRemoved'));
      }
    } catch {
      toast.error(t('account.somethingWrong'));
    } finally {
      setUploading(false);
    }
  }

  function startEditProfile() {
    if (!user) return;
    setProfileForm({ name: user.name, phone: user.phone || '' });
    setEditingProfile(true);
  }

  async function handleSaveProfile() {
    if (!profileForm.name.trim()) {
      toast.error(t('account.nameRequired'));
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileForm.name, phone: profileForm.phone }),
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.data.user);
        setEditingProfile(false);
        toast.success(t('account.profileUpdated'));
      } else {
        toast.error(data.error || t('account.updateFailed'));
      }
    } catch {
      toast.error(t('account.somethingWrong'));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword() {
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      toast.error(t('account.fillAllFields'));
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error(t('account.passwordMinLength'));
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error(t('account.passwordsMismatch'));
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowPasswordForm(false);
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        toast.success(t('account.passwordChanged'));
      } else {
        toast.error(data.error || t('account.passwordChangeFailed'));
      }
    } catch {
      toast.error(t('account.somethingWrong'));
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'DELETE') {
      toast.error(t('account.typeDeleteToConfirm'));
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch('/api/auth/delete-account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword, confirmation: deleteConfirmText }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t('account.accountDeleted'));
        window.location.href = '/';
      } else {
        toast.error(data.error || t('account.deleteFailed'));
      }
    } catch {
      toast.error(t('account.somethingWrong'));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen pt-8 pb-12 relative z-[1]" ref={containerRef}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="scroll-fade mb-8 sm:mb-12">
          <div className="flex flex-col sm:flex-row items-center sm:items-center gap-3 sm:gap-5">
            {/* Avatar */}
            <div className="relative group shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-purple-500/30 to-cyan-500/30 border-2 border-purple-500/20">
                {user.avatar ? (
                  <Image
                    src={user.avatar}
                    alt={user.name}
                    width={72}
                    height={72}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-black text-white uppercase">
                    {user.name.charAt(0)}
                  </div>
                )}
              </div>
              {/* Upload overlay */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 rounded-2xl bg-black/50 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
              >
                {uploading ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Camera className="w-5 h-5 text-white" />
                )}
              </button>
              {/* Remove button */}
              {user.avatar && !uploading && (
                <button
                  onClick={handleAvatarRemove}
                  className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-red-400"
                  title={t('account.removeAvatar')}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="text-center sm:text-left w-full">
              <h1 className="text-4xl sm:text-5xl font-black leading-tight text-white">{t('account.myAccount')}</h1>
              <p className="text-gray-400 mt-2 text-sm sm:text-base leading-relaxed break-words max-w-md mx-auto sm:mx-0">
                {t('account.welcomeBack')} <span className="text-purple-400 font-semibold">{user.name}</span>!
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-5 mb-10">
          {[
            { icon: ShoppingBag, label: t('account.totalOrders'), value: stats.totalOrders, color: 'text-purple-400', bg: 'bg-purple-500/20' },
            { icon: CheckCircle, label: t('account.completed'), value: stats.completed, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
            { icon: Clock, label: t('account.pending'), value: stats.pending, color: 'text-amber-400', bg: 'bg-amber-500/20' },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="scroll-fade game-card p-2.5 sm:p-6" data-delay={`${i * 100}`}>
                <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:space-x-4 text-center sm:text-left">
                  <div className={`w-10 h-10 sm:w-14 sm:h-14 ${stat.bg} rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0`}>
                    <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-lg sm:text-3xl font-black text-white leading-none">{stat.value}</p>
                    <p className="text-[11px] sm:text-sm text-gray-500 font-medium leading-snug break-words">{stat.label}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="scroll-fade game-card p-4 mb-6 sm:mb-8" data-delay="120">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-sm text-gray-300 flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              {t('account.session')}: <span className="font-semibold text-white">{formatRemainingTime(sessionInfo?.remainingSeconds ?? null)}</span>
            </p>
            <p className="text-xs text-gray-500">
              {t('account.sessionExpiresAt')} {sessionInfo?.expiresAt ? new Date(sessionInfo.expiresAt).toLocaleString() : t('account.sessionUnknown')}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Link href="/account/orders" className="scroll-fade game-card p-6 group" data-delay="100">
            <div className="flex items-center space-x-5">
              <div className="w-14 h-14 bg-purple-500/20 rounded-2xl flex items-center justify-center group-hover:bg-purple-500/30 group-hover:shadow-glow-sm transition-all">
                <Key className="w-7 h-7 text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{t('account.myOrdersKeys')}</h3>
                <p className="text-sm text-gray-500">{t('account.viewPurchasedItems')}</p>
              </div>
            </div>
          </Link>

          <div className="scroll-fade game-card p-6" data-delay="200">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-5">
                <div className="w-14 h-14 bg-gray-500/20 rounded-2xl flex items-center justify-center">
                  <User className="w-7 h-7 text-gray-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{t('account.profileDetails')}</h3>
                  {!editingProfile ? (
                    <div className="text-sm text-gray-500 space-y-1 mt-1">
                      <p>{user.name}</p>
                      <p>{user.email}</p>
                      {user.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" /> {user.phone}</p>}
                      <p>{t('account.memberSince')} {new Date(user.createdAt).toLocaleDateString()}</p>
                    </div>
                  ) : (
                    <div className="space-y-3 mt-3">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">{t('account.name')}</label>
                        <input
                          type="text"
                          value={profileForm.name}
                          onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                          className="input-field text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">{t('account.phone')}</label>
                        <input
                          type="text"
                          value={profileForm.phone}
                          onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                          placeholder="09xxxxxxxxx"
                          className="input-field text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleSaveProfile} disabled={savingProfile} className="btn-electric text-xs flex items-center gap-1.5">
                          {savingProfile ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          {t('account.save')}
                        </button>
                        <button onClick={() => setEditingProfile(false)} className="btn-primary text-xs flex items-center gap-1.5">
                          <X className="w-3 h-3" /> {t('account.cancel')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {!editingProfile && (
                <button onClick={startEditProfile} className="p-2 text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-all" title={t('account.editProfile')}>
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Change Password Section */}
        <div className="scroll-fade game-card p-6 mt-5" data-delay="300">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-5">
              <div className="w-14 h-14 bg-amber-500/20 rounded-2xl flex items-center justify-center">
                <Lock className="w-7 h-7 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{t('account.changePassword')}</h3>
                <p className="text-sm text-gray-500">{t('account.updateYourPassword')}</p>
              </div>
            </div>
            {!showPasswordForm && (
              <button onClick={() => setShowPasswordForm(true)} className="btn-primary text-xs flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> {t('account.change')}
              </button>
            )}
          </div>
          {showPasswordForm && (
            <div className="mt-4 space-y-3 pt-4 border-t border-dark-700">
              <div>
                <label className="text-xs text-gray-400 block mb-1">{t('account.currentPassword')}</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">{t('account.newPassword')}</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder={t('account.minChars')}
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">{t('account.confirmNewPassword')}</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="input-field text-sm"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleChangePassword} disabled={savingPassword} className="btn-electric text-xs flex items-center gap-1.5">
                  {savingPassword ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />}
                  {t('account.updatePassword')}
                </button>
                <button onClick={() => { setShowPasswordForm(false); setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }} className="btn-primary text-xs flex items-center gap-1.5">
                  <X className="w-3 h-3" /> {t('account.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Delete Account Section */}
        <div className="scroll-fade game-card p-6 mt-5 border border-red-500/10" data-delay="400">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-5">
              <div className="w-14 h-14 bg-red-500/20 rounded-2xl flex items-center justify-center">
                <Trash2 className="w-7 h-7 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{t('account.deleteAccount')}</h3>
                <p className="text-sm text-gray-500">{t('account.permanentlyDeleteData')}</p>
              </div>
            </div>
            {!showDeleteConfirm && (
              <button onClick={() => setShowDeleteConfirm(true)} className="text-xs px-3 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-all flex items-center gap-1.5">
                <Trash2 className="w-3 h-3" /> {t('account.delete')}
              </button>
            )}
          </div>
          {showDeleteConfirm && (
            <div className="mt-4 space-y-3 pt-4 border-t border-red-500/10">
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-sm text-red-300">
                  <AlertCircle className="w-4 h-4 inline mr-1.5" />
                  {t('account.irreversibleWarning')}
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">{t('account.enterPassword')}</label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">{t('account.typeDeleteLabel')}</label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="input-field text-sm"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting || deleteConfirmText !== 'DELETE'}
                  className="text-xs px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all flex items-center gap-1.5"
                >
                  {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  {t('account.permanentlyDelete')}
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteConfirmText(''); }}
                  className="btn-primary text-xs flex items-center gap-1.5"
                >
                  <X className="w-3 h-3" /> {t('account.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
