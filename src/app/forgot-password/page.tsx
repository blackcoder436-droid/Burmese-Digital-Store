'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, Loader2, ArrowLeft, Package, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/language';
import { useScrollFade } from '@/hooks/useScrollFade';

export default function ForgotPasswordPage() {
  const { tr } = useLanguage();
  const containerRef = useScrollFade();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        setSent(true);
      } else {
        toast.error(data.error || tr('Something went wrong', 'တစ်ခုခုမှားယွင်းနေပါသည်'));
      }
    } catch {
      toast.error(tr('Something went wrong', 'တစ်ခုခုမှားယွင်းနေပါသည်'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden" ref={containerRef}>
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
          <h1 className="heading-md">
            {tr('Reset Password', 'လျှို့ဝှက်နံပါတ် ပြန်လည်သတ်မှတ်ရန်')}
          </h1>
          <p className="text-gray-400 mt-2">
            {sent
              ? tr(
                  'Check your email for the reset link',
                  'Reset link အတွက် သင့်အီးမေးလ်ကို စစ်ဆေးပါ'
                )
              : tr(
                  'Enter your email and we\'ll send you a reset link',
                  'သင့်အီးမေးလ်ကို ထည့်ပါ၊ reset link ပို့ပေးပါမည်'
                )}
          </p>
        </div>

        {sent ? (
          /* Success State */
          <div className="scroll-fade glass-panel p-8 text-center" data-delay="150">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <p className="text-gray-300 mb-2">
              {tr(
                'If an account exists with that email, you\'ll receive a password reset link shortly.',
                'ထိုအီးမေးလ်ဖြင့် အကောင့်ရှိပါက password reset link ကို မကြာမီ ရရှိပါမည်။'
              )}
            </p>
            <p className="text-gray-500 text-sm mb-6">
              {tr(
                'The link will expire in 1 hour.',
                'Link သည် 1 နာရီအတွင်း သက်တမ်းကုန်ပါမည်။'
              )}
            </p>
            <button
              onClick={() => { setSent(false); setEmail(''); }}
              className="text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors"
            >
              {tr('Send again with different email', 'အခြားအီးမေးလ်ဖြင့် ထပ်ပို့မည်')}
            </button>
          </div>
        ) : (
          /* Email Form */
          <div className="scroll-fade glass-panel p-8" data-delay="150">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="input-label">
                  {tr('Email Address', 'အီးမေးလ်လိပ်စာ')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={tr('you@example.com', 'you@example.com')}
                  className="input-field"
                  required
                  autoFocus
                />
              </div>
              <button type="submit" disabled={loading} className="btn-electric w-full">
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {tr('Sending...', 'ပို့နေသည်...')}
                  </>
                ) : (
                  <>
                    <Mail className="w-5 h-5" />
                    {tr('Send Reset Link', 'Reset Link ပို့မည်')}
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        <p className="scroll-fade text-center text-gray-500 mt-8" data-delay="250">
          <Link
            href="/login"
            className="text-purple-400 hover:text-purple-300 font-semibold inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {tr('Back to Sign In', 'Sign In သို့ ပြန်သွားမည်')}
          </Link>
        </p>
      </div>
    </div>
  );
}
