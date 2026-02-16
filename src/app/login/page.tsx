'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { LogIn, Loader2, Zap, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/language';
import { useScrollFade } from '@/hooks/useScrollFade';

function LoginForm() {
  const { tr } = useLanguage();
  const containerRef = useScrollFade();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const target = data.data.user.role === 'admin' ? '/admin' : (redirectTo || '/account');
          window.location.href = target;
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [redirectTo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tr('Welcome back!', 'ပြန်လည်ကြိုဆိုပါသည်!'));
        // Use window.location for reliable redirect after login
        // router.refresh() + router.push() race condition causes redirect to fail
        const safeRedirect = redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : null;
        const target = data.data.user.role === 'admin' ? '/admin' : (safeRedirect || '/account');
        window.location.href = target;
        return;
      } else {
        toast.error(data.error || tr('Login failed', 'ဝင်ရောက်မှု မအောင်မြင်ပါ'));
      }
    } catch {
      toast.error(tr('Something went wrong', 'တစ်ခုခုမှားယွင်းနေပါသည်'));
    } finally {
      setLoading(false);
    }
  }

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
          <h1 className="heading-md">{tr('Welcome Back', 'ပြန်လည်ကြိုဆိုပါသည်')}</h1>
          <p className="text-gray-400 mt-2">
            {tr('Sign in to continue to Burmese Digital Store', 'Burmese Digital Store သို့ဆက်လက်ဝင်ရောက်ရန် sign in လုပ်ပါ')}
          </p>
        </div>

        <div className="scroll-fade glass-panel p-8" data-delay="150">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="input-label">{tr('Email Address', 'အီးမေးလ်လိပ်စာ')}</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder={tr('you@example.com', 'you@example.com')}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="input-label">{tr('Password', 'လျှို့ဝှက်နံပါတ်')}</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                className="input-field"
                required
              />
              <div className="mt-2 text-right">
                <Link
                  href="/forgot-password"
                  className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
                >
                  {tr('Forgot password?', 'လျှို့ဝှက်နံပါတ် မေ့နေပါသလား?')}
                </Link>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-electric w-full">
              {loading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> {tr('Signing in...', 'ဝင်ရောက်နေသည်...')}</>
              ) : (
                <><Zap className="w-5 h-5" /> {tr('Sign In', 'ဝင်မည်')}</>
              )}
            </button>
          </form>
        </div>

        <p className="scroll-fade text-center text-gray-500 mt-8" data-delay="250">
          {tr("Don't have an account?", 'အကောင့်မရှိသေးဘူးလား?')}{' '}
          <Link href="/register" className="text-purple-400 hover:text-purple-300 font-semibold">
            {tr('Create one', 'အခုဖွင့်မည်')}
          </Link>
        </p>
      </div>
      </>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
