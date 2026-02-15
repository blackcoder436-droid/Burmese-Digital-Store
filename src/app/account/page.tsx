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

export default function AccountPage() {
  const { tr } = useLanguage();
  const containerRef = useScrollFade();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<UserData | null>(null);
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

  useEffect(() => {
    fetchUserData();
  }, []);

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
      toast.error(tr('File too large. Max 2MB', 'ဖိုင်ကြီးလွန်းသည်။ အများဆုံး 2MB'));
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
        toast.success(tr('Avatar updated!', 'ပရိုဖိုင်ပုံ ပြင်ဆင်ပြီးပါပြီ!'));
      } else {
        toast.error(data.error || tr('Upload failed', 'Upload မအောင်မြင်ပါ'));
      }
    } catch {
      toast.error(tr('Something went wrong', 'တစ်ခုခုမှားယွင်းနေပါသည်'));
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
        toast.success(tr('Avatar removed', 'ပရိုဖိုင်ပုံ ဖယ်ရှားပြီးပါပြီ'));
      }
    } catch {
      toast.error(tr('Something went wrong', 'တစ်ခုခုမှားယွင်းနေပါသည်'));
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
      toast.error(tr('Name is required', 'နာမည်ထည့်ပါ'));
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
        toast.success(tr('Profile updated!', 'ပရိုဖိုင် ပြင်ဆင်ပြီးပါပြီ!'));
      } else {
        toast.error(data.error || tr('Failed to update', 'ပြင်ဆင်ရန် မအောင်မြင်ပါ'));
      }
    } catch {
      toast.error(tr('Something went wrong', 'တစ်ခုခုမှားယွင်းနေပါသည်'));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword() {
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      toast.error(tr('Please fill in all fields', 'အကွက်အားလုံးဖြည့်ပါ'));
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error(tr('New password must be at least 6 characters', 'စကားဝှက်အသစ် အနည်းဆုံး ၆ လုံးရှိရမည်'));
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error(tr('Passwords do not match', 'စကားဝှက်များ မတူပါ'));
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
        toast.success(tr('Password changed!', 'စကားဝှက် ပြောင်းလဲပြီးပါပြီ!'));
      } else {
        toast.error(data.error || tr('Failed to change password', 'စကားဝှက်ပြောင်းရန် မအောင်မြင်ပါ'));
      }
    } catch {
      toast.error(tr('Something went wrong', 'တစ်ခုခုမှားယွင်းနေပါသည်'));
    } finally {
      setSavingPassword(false);
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
    <div className="min-h-screen pt-24 pb-12 relative z-[1]" ref={containerRef}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="scroll-fade flex flex-col sm:flex-row items-start sm:items-center justify-between mb-12 gap-4">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="relative group shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-purple-500/30 to-cyan-500/30 border-2 border-purple-500/20">
                {user.avatar ? (
                  <Image
                    src={user.avatar}
                    alt={user.name}
                    width={80}
                    height={80}
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
                className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
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
                  className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-400"
                  title={tr('Remove avatar', 'ပရိုဖိုင်ပုံဖယ်ရှား')}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
            <div>
              <h1 className="heading-lg">{tr('My Account', 'ကျွန်ုပ်အကောင့်')}</h1>
              <p className="text-gray-400 mt-2">
                {tr('Welcome back,', 'ပြန်လည်ကြိုဆိုပါသည်,')} <span className="text-purple-400 font-semibold">{user.name}</span>!
              </p>
            </div>
          </div>
          <Link href="/shop" className="btn-primary">
            <ShoppingBag className="w-5 h-5" />
            {tr('Browse Shop', 'ဆိုင်ကြည့်မည်')}
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
          {[
            { icon: ShoppingBag, label: tr('Total Orders', 'အော်ဒါစုစုပေါင်း'), value: stats.totalOrders, color: 'text-purple-400', bg: 'bg-purple-500/20' },
            { icon: CheckCircle, label: tr('Completed', 'ပြီးဆုံးသည်'), value: stats.completed, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
            { icon: Clock, label: tr('Pending', 'စောင့်ဆိုင်းနေသည်'), value: stats.pending, color: 'text-amber-400', bg: 'bg-amber-500/20' },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="scroll-fade game-card p-6" data-delay={`${i * 100}`}>
                <div className="flex items-center space-x-4">
                  <div className={`w-14 h-14 ${stat.bg} rounded-2xl flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-3xl font-black text-white">{stat.value}</p>
                    <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Link href="/account/orders" className="scroll-fade game-card p-6 group" data-delay="100">
            <div className="flex items-center space-x-5">
              <div className="w-14 h-14 bg-purple-500/20 rounded-2xl flex items-center justify-center group-hover:bg-purple-500/30 group-hover:shadow-glow-sm transition-all">
                <Key className="w-7 h-7 text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{tr('My Orders & Keys', 'ကျွန်ုပ်၏အော်ဒါများ & Key များ')}</h3>
                <p className="text-sm text-gray-500">{tr('View your purchased items and delivery keys', 'ဝယ်ယူထားသောပစ္စည်းများနှင့်ပို့ပြီးသော key များကိုကြည့်ပါ')}</p>
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
                  <h3 className="text-lg font-bold text-white">{tr('Profile Details', 'ကိုယ်ရေးအချက်အလက်')}</h3>
                  {!editingProfile ? (
                    <div className="text-sm text-gray-500 space-y-1 mt-1">
                      <p>{user.name}</p>
                      <p>{user.email}</p>
                      {user.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" /> {user.phone}</p>}
                      <p>{tr('Member since', 'အသုံးပြုသူဖြစ်သည့်နေ့')} {new Date(user.createdAt).toLocaleDateString()}</p>
                    </div>
                  ) : (
                    <div className="space-y-3 mt-3">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">{tr('Name', 'နာမည်')}</label>
                        <input
                          type="text"
                          value={profileForm.name}
                          onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                          className="input-field text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">{tr('Phone', 'ဖုန်းနံပါတ်')}</label>
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
                          {tr('Save', 'သိမ်းမည်')}
                        </button>
                        <button onClick={() => setEditingProfile(false)} className="btn-primary text-xs flex items-center gap-1.5">
                          <X className="w-3 h-3" /> {tr('Cancel', 'မလုပ်တော့ပါ')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {!editingProfile && (
                <button onClick={startEditProfile} className="p-2 text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-all" title={tr('Edit Profile', 'ပရိုဖိုင်ပြင်ဆင်မည်')}>
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
                <h3 className="text-lg font-bold text-white">{tr('Change Password', 'စကားဝှက်ပြောင်းမည်')}</h3>
                <p className="text-sm text-gray-500">{tr('Update your account password', 'အကောင့်စကားဝှက်ကို ပြောင်းလဲပြီးနည်းပါ')}</p>
              </div>
            </div>
            {!showPasswordForm && (
              <button onClick={() => setShowPasswordForm(true)} className="btn-primary text-xs flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> {tr('Change', 'ပြောင်းမည်')}
              </button>
            )}
          </div>
          {showPasswordForm && (
            <div className="mt-4 space-y-3 pt-4 border-t border-dark-700">
              <div>
                <label className="text-xs text-gray-400 block mb-1">{tr('Current Password', 'လက်ရှိစကားဝှက်')}</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">{tr('New Password', 'စကားဝှက်အသစ်')}</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder={tr('Min 6 characters', 'အနည်းဆုံး ၆ လုံး')}
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">{tr('Confirm New Password', 'စကားဝှက်အသစ် အတည်ပြု')}</label>
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
                  {tr('Update Password', 'စကားဝှက်ပြောင်းမည်')}
                </button>
                <button onClick={() => { setShowPasswordForm(false); setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }} className="btn-primary text-xs flex items-center gap-1.5">
                  <X className="w-3 h-3" /> {tr('Cancel', 'မလုပ်တော့ပါ')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
