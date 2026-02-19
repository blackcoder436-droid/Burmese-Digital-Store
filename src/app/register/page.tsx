'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Loader2, Zap, Package, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/language';
import { useScrollFade } from '@/hooks/useScrollFade';

export default function RegisterPage() {
  const { t } = useLanguage();
  const containerRef = useScrollFade();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');

  // Password strength checks
  const passwordChecks = useMemo(() => {
    const p = form.password;
    return [
      { label: t('auth.registerPage.reqAtLeast8'), pass: p.length >= 8 },
      { label: t('auth.registerPage.reqUpper'), pass: /[A-Z]/.test(p) },
      { label: t('auth.registerPage.reqLower'), pass: /[a-z]/.test(p) },
      { label: t('auth.registerPage.reqNumber'), pass: /[0-9]/.test(p) },
      { label: t('auth.registerPage.reqSpecial'), pass: /[^A-Za-z0-9]/.test(p) },
    ];
  }, [form.password, t]);
  const passedCount = passwordChecks.filter((c) => c.pass).length;
  const strengthPercent = (passedCount / passwordChecks.length) * 100;
  const strengthColor = strengthPercent <= 40 ? 'bg-red-500' : strengthPercent <= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  const strengthLabel = strengthPercent <= 40
    ? t('auth.registerPage.weak')
    : strengthPercent <= 80
      ? t('auth.registerPage.medium')
      : t('auth.registerPage.strong');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          window.location.href = data.data.user.role === 'admin' ? '/admin' : '/account';
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, []);

  useEffect(() => {
    fetch('/api/auth/google/config', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data?.data?.enabled && data?.data?.clientId) {
          setGoogleClientId(String(data.data.clientId));
        }
      })
      .catch(() => {
        setGoogleClientId('');
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error(t('auth.registerPage.passwordsNoMatch'));
      return;
    }
    if (passedCount < passwordChecks.length) {
      toast.error(t('auth.registerPage.passwordReqError'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t('auth.registerPage.accountCreated'));
        window.location.href = '/account';
        return;
      } else {
        toast.error(data.error || t('auth.registerPage.registrationFailed'));
      }
    } catch {
      toast.error(t('auth.registerPage.somethingWrong'));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin(credential: string) {
    setGoogleLoading(true);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t('auth.registerPage.welcomeToast'));
        window.location.href = data.data.user.role === 'admin' ? '/admin' : '/account';
      } else {
        toast.error(data.error || t('auth.registerPage.googleSignupFailed'));
      }
    } catch {
      toast.error(t('auth.registerPage.somethingWrong'));
    } finally {
      setGoogleLoading(false);
    }
  }

  // Initialize Google Sign-In
  useEffect(() => {
    if (checking || !googleClientId) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).google?.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response: { credential: string }) => {
          handleGoogleLogin(response.credential);
        },
      });
      const btnContainer = document.getElementById('google-signup-btn');
      if (btnContainer) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).google?.accounts.id.renderButton(btnContainer, {
          theme: 'filled_black',
          size: 'large',
          width: '100%',
          text: 'signup_with',
          shape: 'rectangular',
          logo_alignment: 'center',
        });
      }
    };
    document.head.appendChild(script);
    return () => { script.remove(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking, googleClientId]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden" ref={containerRef}>
      {checking ? (
        <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
      ) : (
      <>
      {/* Background Effects */}
      <div className="absolute inset-0 bg-mesh pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-radial from-purple-500/10 via-transparent to-transparent pointer-events-none" />
      
      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="scroll-fade text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-cyan-500 rounded-2xl flex items-center justify-center shadow-glow">
              <Package className="w-6 h-6 text-white" />
            </div>
          </Link>
          <h1 className="heading-md">{t('auth.registerPage.heading')}</h1>
          <p className="text-gray-400 mt-2">
            {t('auth.registerPage.subtitle')}
          </p>
        </div>

        <div className="scroll-fade glass-panel p-8" data-delay="150">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="input-label">{t('auth.registerPage.fullName')}</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('auth.registerPage.yourName')}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="input-label">{t('auth.registerPage.emailAddress')}</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="input-label">{t('auth.registerPage.passwordLabel')}</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                className="input-field"
                required
              />
              {/* Password Strength Indicator */}
              {form.password.length > 0 && (
                <div className="mt-3 space-y-2">
                  {/* Strength bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-dark-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${strengthColor}`}
                        style={{ width: `${strengthPercent}%` }}
                      />
                    </div>
                    <span className={`text-xs font-semibold ${
                      strengthPercent <= 40 ? 'text-red-400' : strengthPercent <= 80 ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {strengthLabel}
                    </span>
                  </div>
                  {/* Checklist */}
                  <div className="grid grid-cols-1 gap-1">
                    {passwordChecks.map((check, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs">
                        {check.pass ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                        )}
                        <span className={check.pass ? 'text-emerald-400' : 'text-gray-500'}>
                          {check.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="input-label">{t('auth.registerPage.confirmPasswordLabel')}</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                placeholder="••••••••"
                className="input-field"
                required
              />
            </div>
            <button type="submit" disabled={loading} className="btn-electric w-full">
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> {t('auth.registerPage.creatingAccount')}</>
              ) : (
                <><Zap className="w-5 h-5" /> {t('auth.registerPage.createAccountButton')}</>
              )}
            </button>
          </form>

          {/* Google Sign-Up */}
          <>
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-dark-600" />
              <span className="text-xs text-gray-500">{t('auth.registerPage.or')}</span>
              <div className="flex-1 h-px bg-dark-600" />
            </div>
            <div id="google-signup-btn" className="flex justify-center min-h-[40px]" />
            {!googleClientId && (
              <p className="text-xs text-amber-400 text-center mt-2">
                {t('auth.registerPage.googleNotConfigured')}
              </p>
            )}
            {googleLoading && (
              <div className="flex items-center justify-center mt-3">
                <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
              </div>
            )}
          </>
        </div>

        <p className="scroll-fade text-center text-gray-500 mt-8" data-delay="250">
          {t('auth.registerPage.hasAccountQuestion')}{' '}
          <Link href="/login" className="text-purple-400 hover:text-purple-300 font-semibold">
            {t('auth.registerPage.signIn')}
          </Link>
        </p>
      </div>
      </>
      )}
    </div>
  );
}
