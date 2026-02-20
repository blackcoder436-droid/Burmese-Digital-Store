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
  Heart,
  ChevronRight,
  Shield,
  Sparkles,
  Mail,
  CalendarDays,
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

  // Session progress percentage (max 7 days)
  const sessionProgress = sessionInfo?.remainingSeconds
    ? Math.min(100, (sessionInfo.remainingSeconds / (7 * 86400)) * 100)
    : 0;

  return (
    <div className="min-h-screen pb-16 relative z-[1]" ref={containerRef}>
      {/* ===== Hero Header with Gradient Background ===== */}
      <div className="relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-dark-950 to-cyan-900/10" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-[120px]" />
        <div className="absolute top-10 right-1/4 w-72 h-72 bg-cyan-500/5 rounded-full blur-[100px]" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-8">
          <div className="scroll-fade">
            <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-7">
              {/* Avatar - Enhanced */}
              <div className="relative group shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                {/* Glow ring behind avatar */}
                <div className="absolute -inset-1 bg-gradient-to-br from-purple-500/40 to-cyan-500/40 rounded-2xl blur-sm opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-gradient-to-br from-purple-600/40 to-cyan-600/40 border-2 border-purple-500/30 shadow-lg">
                  {user.avatar ? (
                    <Image
                      src={user.avatar}
                      alt={user.name}
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl font-black text-white uppercase bg-gradient-to-br from-purple-600/30 to-cyan-600/30">
                      {user.name.charAt(0)}
                    </div>
                  )}
                </div>
                {/* Upload overlay */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 m-[1px] rounded-2xl bg-black/50 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center justify-center transition-all duration-300 cursor-pointer backdrop-blur-[1px]"
                >
                  {uploading ? (
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  ) : (
                    <Camera className="w-6 h-6 text-white drop-shadow-lg" />
                  )}
                </button>
                {/* Remove button */}
                {user.avatar && !uploading && (
                  <button
                    onClick={handleAvatarRemove}
                    className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300 hover:bg-red-400 shadow-lg shadow-red-500/30"
                    title={t('account.removeAvatar')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="text-center sm:text-left flex-1">
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-purple-400/80">{t('account.myAccount')}</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-black leading-tight text-white">
                  {t('account.welcomeBack')} <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">{user.name}</span>!
                </h1>
                <p className="text-gray-400 mt-2 text-sm sm:text-base leading-relaxed break-words max-w-lg mx-auto sm:mx-0">
                  {user.email}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ===== Session Info Bar ===== */}
        <div className="scroll-fade -mt-2 mb-8" data-delay="50">
          <div className="relative overflow-hidden rounded-2xl bg-dark-800/60 border border-dark-600/40 backdrop-blur-sm p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-300 flex items-center gap-2">
                    {t('account.session')}: <span className="font-bold text-white text-base">{formatRemainingTime(sessionInfo?.remainingSeconds ?? null)}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {t('account.sessionExpiresAt')} {sessionInfo?.expiresAt ? new Date(sessionInfo.expiresAt).toLocaleString() : t('account.sessionUnknown')}
                  </p>
                </div>
              </div>
              {/* Session progress bar */}
              <div className="w-full sm:w-48">
                <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${sessionProgress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== Stats Grid - Enhanced ===== */}
        <div className="grid grid-cols-3 gap-3 sm:gap-5 mb-10">
          {[
            { icon: ShoppingBag, label: t('account.totalOrders'), value: stats.totalOrders, gradient: 'from-purple-500 to-violet-600', bg: 'bg-purple-500/15', ring: 'ring-purple-500/20' },
            { icon: CheckCircle, label: t('account.completed'), value: stats.completed, gradient: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-500/15', ring: 'ring-emerald-500/20' },
            { icon: Clock, label: t('account.pending'), value: stats.pending, gradient: 'from-amber-500 to-orange-600', bg: 'bg-amber-500/15', ring: 'ring-amber-500/20' },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="scroll-fade group relative overflow-hidden rounded-2xl bg-dark-800/70 border border-dark-600/40 p-3.5 sm:p-6 hover:border-dark-500/60 transition-all duration-500"
                data-delay={`${i * 80}`}
              >
                {/* Subtle gradient overlay on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500`} />
                <div className="relative flex flex-col items-center sm:items-start gap-2.5">
                  <div className={`w-11 h-11 sm:w-14 sm:h-14 ${stat.bg} ring-1 ${stat.ring} rounded-xl sm:rounded-2xl flex items-center justify-center`}>
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: stat.gradient.includes('purple') ? '#a78bfa' : stat.gradient.includes('emerald') ? '#34d399' : '#fbbf24' }} />
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="text-2xl sm:text-4xl font-black text-white leading-none tracking-tight">{stat.value}</p>
                    <p className="text-[10px] sm:text-sm text-gray-500 font-medium mt-1 leading-snug break-words">{stat.label}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ===== Quick Action Cards ===== */}
        <div className="scroll-fade mb-3" data-delay="100">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4 px-1">{t('account.myOrdersKeys').split('&')[0].trim()}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 mb-10">
          {/* Orders & Keys Card */}
          <Link href="/account/orders" className="scroll-fade group relative overflow-hidden rounded-2xl bg-dark-800/70 border border-dark-600/40 hover:border-purple-500/40 p-5 sm:p-6 transition-all duration-500 hover:-translate-y-1" data-delay="100">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500/20 to-violet-600/20 ring-1 ring-purple-500/20 rounded-2xl flex items-center justify-center group-hover:ring-purple-500/40 group-hover:shadow-[0_0_20px_rgba(147,51,234,0.15)] transition-all duration-500">
                  <Key className="w-7 h-7 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white group-hover:text-purple-200 transition-colors">{t('account.myOrdersKeys')}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{t('account.viewPurchasedItems')}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-purple-400 group-hover:translate-x-1 transition-all duration-300 shrink-0" />
            </div>
          </Link>

          {/* Wishlist Card */}
          <Link href="/account/wishlist" className="scroll-fade group relative overflow-hidden rounded-2xl bg-dark-800/70 border border-dark-600/40 hover:border-pink-500/40 p-5 sm:p-6 transition-all duration-500 hover:-translate-y-1" data-delay="150">
            <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="w-14 h-14 bg-gradient-to-br from-pink-500/20 to-rose-600/20 ring-1 ring-pink-500/20 rounded-2xl flex items-center justify-center group-hover:ring-pink-500/40 group-hover:shadow-[0_0_20px_rgba(236,72,153,0.15)] transition-all duration-500">
                  <Heart className="w-7 h-7 text-pink-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white group-hover:text-pink-200 transition-colors">{t('account.wishlist')}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{t('account.viewWishlist')}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-pink-400 group-hover:translate-x-1 transition-all duration-300 shrink-0" />
            </div>
          </Link>
        </div>

        {/* ===== Profile Section - Enhanced ===== */}
        <div className="scroll-fade mb-3" data-delay="180">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4 px-1">{t('account.profileDetails')}</h2>
        </div>

        <div className="scroll-fade relative overflow-hidden rounded-2xl bg-dark-800/70 border border-dark-600/40 mb-10" data-delay="200">
          {/* Profile header banner */}
          <div className="h-1 bg-gradient-to-r from-purple-500 via-cyan-500 to-purple-500" />

          <div className="p-5 sm:p-7">
            <div className="flex items-start justify-between mb-5">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-gray-400" />
                {t('account.profileDetails')}
              </h3>
              {!editingProfile && (
                <button
                  onClick={startEditProfile}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg transition-all duration-200"
                  title={t('account.editProfile')}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {t('account.editProfile')}
                </button>
              )}
            </div>

            {!editingProfile ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {[
                  { icon: User, label: t('account.name'), value: user.name },
                  { icon: Mail, label: 'Email', value: user.email },
                  { icon: Phone, label: t('account.phone'), value: user.phone || '—' },
                  { icon: CalendarDays, label: t('account.memberSince'), value: new Date(user.createdAt).toLocaleDateString() },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-dark-900/50 border border-dark-700/50">
                      <div className="w-9 h-9 rounded-lg bg-dark-700/80 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">{item.label}</p>
                        <p className="text-sm text-white font-medium truncate">{item.value}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1.5">{t('account.name')}</label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="input-field text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium block mb-1.5">{t('account.phone')}</label>
                  <input
                    type="text"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="09xxxxxxxxx"
                    className="input-field text-sm"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={handleSaveProfile} disabled={savingProfile} className="btn-electric text-sm flex items-center gap-2 px-5 py-2.5">
                    {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {t('account.save')}
                  </button>
                  <button onClick={() => setEditingProfile(false)} className="btn-secondary text-sm flex items-center gap-2 px-5 py-2.5">
                    <X className="w-4 h-4" /> {t('account.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ===== Security Section ===== */}
        <div className="scroll-fade mb-3" data-delay="250">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4 px-1">Security</h2>
        </div>

        <div className="space-y-4 mb-10">
          {/* Change Password Card */}
          <div className="scroll-fade relative overflow-hidden rounded-2xl bg-dark-800/70 border border-dark-600/40" data-delay="300">
            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 sm:gap-5">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-amber-500/20 to-orange-600/20 ring-1 ring-amber-500/20 rounded-2xl flex items-center justify-center">
                    <Lock className="w-6 h-6 sm:w-7 sm:h-7 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white">{t('account.changePassword')}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{t('account.updateYourPassword')}</p>
                  </div>
                </div>
                {!showPasswordForm && (
                  <button
                    onClick={() => setShowPasswordForm(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-amber-400 hover:from-amber-500/25 hover:to-orange-500/25 ring-1 ring-amber-500/20 hover:ring-amber-500/40 rounded-xl transition-all duration-300"
                  >
                    <Lock className="w-4 h-4" /> {t('account.change')}
                  </button>
                )}
              </div>
              {showPasswordForm && (
                <div className="mt-5 space-y-4 pt-5 border-t border-dark-700/50 max-w-md">
                  <div>
                    <label className="text-xs text-gray-400 font-medium block mb-1.5">{t('account.currentPassword')}</label>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      className="input-field text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-medium block mb-1.5">{t('account.newPassword')}</label>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      placeholder={t('account.minChars')}
                      className="input-field text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-medium block mb-1.5">{t('account.confirmNewPassword')}</label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      className="input-field text-sm"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={handleChangePassword} disabled={savingPassword} className="btn-electric text-sm flex items-center gap-2 px-5 py-2.5">
                      {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                      {t('account.updatePassword')}
                    </button>
                    <button onClick={() => { setShowPasswordForm(false); setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }} className="btn-secondary text-sm flex items-center gap-2 px-5 py-2.5">
                      <X className="w-4 h-4" /> {t('account.cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Delete Account Card */}
          <div className="scroll-fade relative overflow-hidden rounded-2xl bg-dark-800/70 border border-red-500/10 hover:border-red-500/20 transition-colors duration-300" data-delay="400">
            {/* Subtle red accent */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />

            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 sm:gap-5">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-red-500/15 to-rose-600/15 ring-1 ring-red-500/15 rounded-2xl flex items-center justify-center">
                    <Trash2 className="w-6 h-6 sm:w-7 sm:h-7 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white">{t('account.deleteAccount')}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{t('account.permanentlyDeleteData')}</p>
                  </div>
                </div>
                {!showDeleteConfirm && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 ring-1 ring-red-500/15 hover:ring-red-500/30 rounded-xl transition-all duration-300"
                  >
                    <Trash2 className="w-4 h-4" /> {t('account.delete')}
                  </button>
                )}
              </div>
              {showDeleteConfirm && (
                <div className="mt-5 space-y-4 pt-5 border-t border-red-500/10 max-w-md">
                  <div className="bg-red-500/10 border border-red-500/15 rounded-xl p-4">
                    <p className="text-sm text-red-300 flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <span>{t('account.irreversibleWarning')}</span>
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-medium block mb-1.5">{t('account.enterPassword')}</label>
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      className="input-field text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-medium block mb-1.5">{t('account.typeDeleteLabel')}</label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="DELETE"
                      className="input-field text-sm"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleting || deleteConfirmText !== 'DELETE'}
                      className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 active:scale-95 shadow-lg shadow-red-500/20"
                    >
                      {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      {t('account.permanentlyDelete')}
                    </button>
                    <button
                      onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteConfirmText(''); }}
                      className="btn-secondary text-sm flex items-center gap-2 px-5 py-2.5"
                    >
                      <X className="w-4 h-4" /> {t('account.cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
