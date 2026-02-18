'use client';

import { useState } from 'react';
import { Copy, Check, Eye, EyeOff, Key } from 'lucide-react';
import { useLanguage } from '@/lib/language';

interface KeyItem {
  serialKey?: string;
  loginEmail?: string;
  loginPassword?: string;
  additionalInfo?: string;
}

interface MyKeysProps {
  keys: KeyItem[];
  productName: string;
}

export default function MyKeys({ keys, productName }: MyKeysProps) {
  const { t } = useLanguage();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});

  const copyToClipboard = async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const togglePassword = (index: number) => {
    setShowPasswords((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  if (!keys || keys.length === 0) return null;

  return (
    <div className="game-card p-6 space-y-5">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
          <Key className="w-5 h-5 text-purple-400" />
        </div>
        <h3 className="text-lg font-bold text-white">
          {t('account.myKeys')} — {productName}
        </h3>
      </div>

      <div className="space-y-4">
        {keys.map((key, index) => (
          <div
            key={index}
            className="p-5 bg-dark-900 border border-dark-600/50 rounded-xl space-y-3"
          >
            {key.serialKey && (
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-gray-500 font-medium uppercase tracking-wider block mb-1">
                    {t('account.serialKey')}
                  </span>
                  <code className="text-base text-purple-400 font-mono break-all">
                    {key.serialKey}
                  </code>
                </div>
                <button
                  onClick={() =>
                    copyToClipboard(key.serialKey!, `serial-${index}`)
                  }
                  className="ml-4 p-2.5 bg-dark-800 hover:bg-purple-500/10 border border-dark-600 hover:border-purple-500/50 rounded-xl transition-all flex-shrink-0"
                  title={t('common.copy')}
                >
                  {copiedField === `serial-${index}` ? (
                    <Check className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-500" />
                  )}
                </button>
              </div>
            )}

            {key.loginEmail && (
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-slate-500 block mb-0.5">
                    {t('account.emailUsername')}
                  </span>
                  <code className="text-sm text-sky-400 font-mono break-all">
                    {key.loginEmail}
                  </code>
                </div>
                <button
                  onClick={() =>
                    copyToClipboard(key.loginEmail!, `email-${index}`)
                  }
                  className="ml-3 p-2 hover:bg-white/5 rounded-lg transition-colors flex-shrink-0"
                  title={t('common.copy')}
                >
                  {copiedField === `email-${index}` ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-500" />
                  )}
                </button>
              </div>
            )}

            {key.loginPassword && (
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-slate-500 block mb-0.5">
                    {t('auth.password')}
                  </span>
                  <code className="text-sm text-amber-400 font-mono break-all">
                    {showPasswords[index]
                      ? key.loginPassword
                      : '••••••••••••'}
                  </code>
                </div>
                <div className="flex items-center space-x-1 ml-3 flex-shrink-0">
                  <button
                    onClick={() => togglePassword(index)}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                    title={showPasswords[index] ? t('common.hide') : t('common.show')}
                  >
                    {showPasswords[index] ? (
                      <EyeOff className="w-4 h-4 text-slate-500" />
                    ) : (
                      <Eye className="w-4 h-4 text-slate-500" />
                    )}
                  </button>
                  <button
                    onClick={() =>
                      copyToClipboard(key.loginPassword!, `pass-${index}`)
                    }
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                    title={t('common.copy')}
                  >
                    {copiedField === `pass-${index}` ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-500" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {key.additionalInfo && (
              <div className="pt-1.5 border-t border-surface-border">
                <span className="text-xs text-slate-500 block mb-0.5">
                  {t('account.additionalInfo')}
                </span>
                <p className="text-sm text-slate-400">{key.additionalInfo}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
