'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, Globe, Clock, Shield, ExternalLink, QrCode } from 'lucide-react';
import { useLanguage } from '@/lib/language';
import QRCode from 'qrcode';

interface VpnKeyProps {
  vpnKey: {
    clientEmail: string;
    subLink: string;
    configLink: string;
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
}

export default function VpnKeyDisplay({ vpnKey, vpnPlan }: VpnKeyProps) {
  const { t } = useLanguage();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (showQr && vpnKey.configLink && !qrDataUrl) {
      QRCode.toDataURL(vpnKey.configLink, {
        width: 280,
        margin: 2,
        color: { dark: '#c084fc', light: '#0a0a1f' },
      }).then(setQrDataUrl).catch(() => {});
    }
  }, [showQr, vpnKey.configLink, qrDataUrl]);

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

  const serverNames: Record<string, string> = {
    sg1: '🇸🇬 Singapore 1',
    sg2: '🇸🇬 Singapore 2',
    sg3: '🇸🇬 Singapore 3',
    us1: '🇺🇸 United States',
  };

  return (
    <div className="game-card p-6 space-y-5">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-purple-400" />
        </div>
        <h3 className="text-lg font-bold text-white">
          {t('components.vpnKey.yourVpnKey')}
        </h3>
      </div>

      {/* Info row */}
      <div className="flex flex-wrap gap-3 text-sm">
        {vpnPlan && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-300">
            <Globe className="w-3.5 h-3.5" />
            {serverNames[vpnPlan.serverId] || vpnPlan.serverId}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-300">
          {vpnKey.protocol.toUpperCase()}
        </span>
        {vpnPlan && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-dark-800 border border-dark-600 rounded-lg text-gray-300">
            📱 {vpnPlan.devices} Device{vpnPlan.devices > 1 ? 's' : ''}
          </span>
        )}
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${
          isExpired
            ? 'bg-red-500/10 border-red-500/20 text-red-400'
            : daysLeft <= 7
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        }`}>
          <Clock className="w-3.5 h-3.5" />
          {isExpired ? t('components.vpnKey.expired') : `${daysLeft} ${t('components.vpnKey.daysLeft')}`}
        </span>
      </div>

      {/* Config Link (VPN Key) */}
      <div className="p-4 bg-dark-900 border border-dark-600/50 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">
            {t('components.vpnKey.vpnKeyLabel')}
          </span>
          <button
            onClick={() => copyToClipboard(vpnKey.configLink, 'config')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg text-purple-300 transition-all"
          >
            {copiedField === 'config' ? (
              <><Check className="w-3.5 h-3.5 text-emerald-400" /> {t('components.vpnKey.copied')}</>
            ) : (
              <><Copy className="w-3.5 h-3.5" /> {t('components.vpnKey.copyKey')}</>
            )}
          </button>
        </div>
        <code className="text-sm text-purple-400 font-mono break-all leading-relaxed block">
          {vpnKey.configLink}
        </code>
        {/* QR toggle */}
        <button
          onClick={() => setShowQr(!showQr)}
          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded-lg text-gray-400 hover:text-purple-300 transition-all"
        >
          <QrCode className="w-3.5 h-3.5" />
          {showQr ? t('components.vpnKey.hideQr') : t('components.vpnKey.showQr')}
        </button>
        {showQr && qrDataUrl && (
          <div className="mt-3 flex justify-center">
            <div className="p-3 bg-dark-800 rounded-xl border border-purple-500/20 inline-block">
              <img src={qrDataUrl} alt="VPN Config QR" className="w-[200px] h-[200px] sm:w-[250px] sm:h-[250px]" />
              <p className="text-[10px] text-gray-600 text-center mt-2">{t('components.vpnKey.scanWith')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Subscription Link */}
      <div className="p-4 bg-dark-900 border border-dark-600/50 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">
            {t('components.vpnKey.subscriptionLink')}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => copyToClipboard(vpnKey.subLink, 'sub')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-lg text-cyan-300 transition-all"
            >
              {copiedField === 'sub' ? (
                <><Check className="w-3.5 h-3.5 text-emerald-400" /> {t('components.vpnKey.copied')}</>
              ) : (
                <><Copy className="w-3.5 h-3.5" /> {t('components.vpnKey.copy')}</>
              )}
            </button>
            <a
              href={vpnKey.subLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded-lg text-gray-300 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t('components.vpnKey.open')}
            </a>
          </div>
        </div>
        <code className="text-sm text-cyan-400 font-mono break-all leading-relaxed block">
          {vpnKey.subLink}
        </code>
      </div>

      {/* Usage instructions */}
      <div className="p-4 bg-dark-900 border border-dark-600/50 rounded-xl text-sm text-gray-400 space-y-2">
        <p className="font-semibold text-white text-sm mb-2">📱 {t('components.vpnKey.howToUse')}</p>
        <ol className="list-decimal list-inside space-y-1.5">
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
