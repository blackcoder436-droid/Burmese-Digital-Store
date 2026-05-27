'use client';

import { useState } from 'react';
import { Copy, Check, Globe, Clock, Shield, ExternalLink } from 'lucide-react';
import { useLanguage } from '@/lib/language';

interface VpnKeyProps {
  vpnKey: {
    clientEmail: string;
    subLink: string;
    protocol: string;
    expiryTime: number;
    provisionedAt?: string;
  };
  vpnPlan?: {
    serverId: string;
    planId: string;
    devices: number;
    months: number;
  };
  multiSubToken?: string;
}

export default function VpnKeyDisplay({ vpnKey, vpnPlan, multiSubToken }: VpnKeyProps) {
  const { t } = useLanguage();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
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

  const expiryDate = new Date(vpnKey.expiryTime);
  const now = new Date();
  const daysLeft = Math.max(0, Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const isExpired = daysLeft === 0;

  // Compute sublink: prefer aggregated link if available
  const appUrl = (typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL) || 'https://burmesedigital.store';
  const displaySubLink = multiSubToken ? `${appUrl}/api/vpn/sub/${multiSubToken}` : vpnKey.subLink;

  const serverNames: Record<string, string> = {
    sg1: '🇸🇬 Singapore 1',
    sg2: '🇸🇬 Singapore 2',
    sg3: '🇸🇬 Singapore 3',
    us1: '🇺🇸 United States',
  };

  return (
    <div className="game-card p-3 sm:p-5 space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 sm:w-9 sm:h-9 bg-purple-500/20 rounded-lg flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400" />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-white">
            {t('components.vpnKey.yourVpnKey')}
          </h3>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] sm:text-xs ${
          isExpired
            ? 'bg-red-500/10 border-red-500/20 text-red-400'
            : daysLeft <= 7
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        }`}>
          <Clock className="w-3 h-3" />
          {isExpired ? t('components.vpnKey.expired') : `${daysLeft} ${t('components.vpnKey.daysLeft')}`}
        </span>
      </div>

      {/* Info row */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
        {vpnPlan && (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded-md text-purple-300">
            <Globe className="w-3 h-3" />
            {serverNames[vpnPlan.serverId] || vpnPlan.serverId}
          </span>
        )}
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-md text-cyan-300">
          {vpnKey.protocol.toUpperCase()}
        </span>
        {vpnPlan && (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-dark-800 border border-dark-600 rounded-md text-gray-300">
            📱 {vpnPlan.devices} Device{vpnPlan.devices > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Subscription Link */}
      <div className="p-3 sm:p-4 bg-dark-900 border border-dark-600/50 rounded-lg">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider">
            {multiSubToken ? 'MULTI-SERVER SUBSCRIPTION LINK' : t('components.vpnKey.subscriptionLink')}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => copyToClipboard(displaySubLink, 'sub')}
              className="flex items-center gap-1 px-2 py-1 text-[10px] sm:text-xs font-medium bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-md text-cyan-300 transition-all"
            >
              {copiedField === 'sub' ? (
                <><Check className="w-3.5 h-3.5 text-emerald-400" /> {t('components.vpnKey.copied')}</>
              ) : (
                <><Copy className="w-3.5 h-3.5" /> {t('components.vpnKey.copy')}</>
              )}
            </button>
            <a
              href={displaySubLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 text-[10px] sm:text-xs font-medium bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded-md text-gray-300 transition-all"
            >
              <ExternalLink className="w-3 h-3" />
              {t('components.vpnKey.open')}
            </a>
          </div>
        </div>
        <code className="text-xs sm:text-sm text-cyan-400 font-mono break-all leading-relaxed block">
          {displaySubLink}
        </code>
      </div>

      {/* Usage instructions */}
      <div className="p-3 sm:p-4 bg-dark-900 border border-dark-600/50 rounded-lg text-xs sm:text-sm text-gray-400 space-y-1.5">
        <p className="font-semibold text-white text-xs sm:text-sm mb-1.5">📱 {t('components.vpnKey.howToUse')}</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>{t('components.vpnKey.step1')}</li>
          <li>{t('components.vpnKey.step2')}</li>
          <li>{t('components.vpnKey.step3')}</li>
          <li>{t('components.vpnKey.step4')}</li>
        </ol>
      </div>

      {/* Expiry info */}
      <p className="text-xs text-gray-600">
        {t('components.vpnKey.expires')} {expiryDate.toLocaleDateString()} {expiryDate.toLocaleTimeString()}
      </p>
    </div>
  );
}
