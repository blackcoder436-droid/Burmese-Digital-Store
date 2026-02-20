'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, Loader2, Zap, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/language';
import { useScrollFade } from '@/hooks/useScrollFade';

function ResetPasswordForm() {
  const { t } = useLanguage();
  const containerRef = useScrollFade();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Redirect to forgot-password if no token
  useEffect(() => {
    if (!token) {
      router.replace('/forgot-password');
    }
  }, [token, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      toast.error(t('auth.resetPage.passwordsDoNotMatch'));
      return;
    }
    if (form.password.length < 6) {
      toast.error(t('auth.resetPage.passwordMinLength'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: form.password }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
      } else {
        toast.error(
          data.error || t('auth.resetPage.failedResetPassword')
        );
      }
    } catch {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden"
      ref={containerRef}
    >
      {/* Background Effects */}
      <div className="absolute inset-0 bg-mesh pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-radial from-purple-500/10 via-transparent to-transparent pointer-events-none" />

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="scroll-fade text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <Image
              src="/logo.jpg"
              alt="Burmese Digital Store"
              width={48}
              height={48}
              priority
              className="rounded-2xl shadow-glow"
            />
          </Link>
          <h1 className="heading-md">
            {success
              ? t('auth.resetPage.passwordReset')
              : t('auth.resetPage.createNewPassword')}
          </h1>
          <p className="text-gray-400 mt-2">
            {success
              ? t('auth.resetPage.passwordUpdatedSuccess')
              : t('auth.resetPage.enterNewPassword')}
          </p>
        </div>

        {success ? (
          /* Success State */
          <div className="scroll-fade glass-panel p-8 text-center" data-delay="150">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <p className="text-gray-300 mb-6">
              {t('auth.resetPage.signInWithNewPassword')}
            </p>
            <Link href="/login" className="btn-electric inline-flex">
              <Zap className="w-5 h-5" />
              {t('auth.resetPage.goToSignIn')}
            </Link>
          </div>
        ) : (
          /* Password Form */
          <div className="scroll-fade glass-panel p-8" data-delay="150">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="input-label">
                  {t('auth.newPassword')}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="••••••••"
                    className="input-field pr-12"
                    required
                    minLength={6}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {form.password && form.password.length < 6 && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    {t('auth.resetPage.atLeast6Chars')}
                  </p>
                )}
              </div>
              <div>
                <label className="input-label">
                  {t('auth.confirmPassword')}
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    placeholder="••••••••"
                    className="input-field pr-12"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {form.confirmPassword && form.password !== form.confirmPassword && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    {t('auth.resetPage.passwordsDoNotMatch')}
                  </p>
                )}
              </div>
              <button type="submit" disabled={loading} className="btn-electric w-full">
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('auth.resetPage.resetting')}
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    {t('auth.resetPage.resetPasswordButton')}
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
