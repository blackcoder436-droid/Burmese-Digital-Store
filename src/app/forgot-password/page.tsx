'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, Loader2, ArrowLeft, Package, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/language';
import { useScrollFade } from '@/hooks/useScrollFade';

export default function ForgotPasswordPage() {
  const { t } = useLanguage();
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
        toast.error(data.error || t('common.error'));
      }
    } catch {
      toast.error(t('common.error'));
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
            {t('auth.forgotPage.title')}
          </h1>
          <p className="text-gray-400 mt-2">
            {sent
              ? t('auth.forgotPage.checkEmailForLink')
              : t('auth.forgotPage.enterEmailPrompt')}
          </p>
        </div>

        {sent ? (
          /* Success State */
          <div className="scroll-fade glass-panel p-8 text-center" data-delay="150">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <p className="text-gray-300 mb-2">
              {t('auth.forgotPage.sentMessage')}
            </p>
            <p className="text-gray-500 text-sm mb-6">
              {t('auth.forgotPage.linkExpiresInOneHour')}
            </p>
            <button
              onClick={() => { setSent(false); setEmail(''); }}
              className="text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors"
            >
              {t('auth.forgotPage.sendAgainDifferentEmail')}
            </button>
          </div>
        ) : (
          /* Email Form */
          <div className="scroll-fade glass-panel p-8" data-delay="150">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="input-label">
                  {t('auth.loginPage.emailAddress')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.loginPage.emailPlaceholder')}
                  className="input-field"
                  required
                  autoFocus
                />
              </div>
              <button type="submit" disabled={loading} className="btn-electric w-full">
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('auth.forgotPage.sending')}
                  </>
                ) : (
                  <>
                    <Mail className="w-5 h-5" />
                    {t('auth.forgotPage.sendResetLink')}
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
            {t('auth.forgotPage.backToSignIn')}
          </Link>
        </p>
      </div>
    </div>
  );
}
