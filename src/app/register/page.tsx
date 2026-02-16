'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserPlus, Loader2, Zap, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/language';
import { useScrollFade } from '@/hooks/useScrollFade';

export default function RegisterPage() {
  const { tr } = useLanguage();
  const containerRef = useScrollFade();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error(tr('Passwords do not match', 'လျှို့ဝှက်နံပါတ်များ မတူပါ'));
      return;
    }
    if (form.password.length < 6) {
      toast.error(tr('Password must be at least 6 characters', 'လျှို့ဝှက်နံပါတ် အနည်းဆုံး 6 လုံးလိုအပ်သည်'));
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
        toast.success(tr('Account created!', 'အကောင့်ဖွင့်ပြီးပါပြီ!'));
        window.location.href = '/account';
        return;
      } else {
        toast.error(data.error || tr('Registration failed', 'စာရင်းသွင်းမှု မအောင်မြင်ပါ'));
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
          <h1 className="heading-md">{tr('Create Account', 'အကောင့်ဖွင့်မည်')}</h1>
          <p className="text-gray-400 mt-2">
            {tr('Join Burmese Digital today', 'Burmese Digital Store ကိုယနေ့ပဲ စတင်အသုံးပြုပါ')}
          </p>
        </div>

        <div className="scroll-fade glass-panel p-8" data-delay="150">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="input-label">{tr('Full Name', 'အမည်အပြည့်အစုံ')}</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={tr('Your name', 'သင်၏အမည်')}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="input-label">{tr('Email Address', 'အီးမေးလ်လိပ်စာ')}</label>
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
              <label className="input-label">{tr('Password', 'လျှို့ဝှက်နံပါတ်')}</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="input-label">{tr('Confirm Password', 'လျှို့ဝှက်နံပါတ် အတည်ပြုရန်')}</label>
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
                <><Loader2 className="w-5 h-5 animate-spin" /> {tr('Creating account...', 'အကောင့်ဖွင့်နေသည်...')}</>
              ) : (
                <><Zap className="w-5 h-5" /> {tr('Create Account', 'အကောင့်ဖွင့်မည်')}</>
              )}
            </button>
          </form>
        </div>

        <p className="scroll-fade text-center text-gray-500 mt-8" data-delay="250">
          {tr('Already have an account?', 'အကောင့်ရှိပြီးသားလား?')}{' '}
          <Link href="/login" className="text-purple-400 hover:text-purple-300 font-semibold">
            {tr('Sign in', 'ဝင်မည်')}
          </Link>
        </p>
      </div>
      </>
      )}
    </div>
  );
}
