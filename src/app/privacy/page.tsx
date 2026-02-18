'use client';

import { useLanguage } from '@/lib/language';
import { useScrollFade } from '@/hooks/useScrollFade';
import { Shield } from 'lucide-react';

export default function PrivacyPage() {
  const { t } = useLanguage();
  const containerRef = useScrollFade();
  
  return (
    <div className="max-w-3xl mx-auto px-4 pt-8 pb-12" ref={containerRef}>
      <div className="scroll-fade text-center mb-12">
        <div className="w-16 h-16 mx-auto mb-5 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-center">
          <Shield className="w-8 h-8 text-purple-400" />
        </div>
        <h1 className="heading-lg mb-3">
          {t('legal.privacy.title')}
        </h1>
        <p className="text-gray-500 text-sm">
          {t('legal.lastUpdatedJan2025')}
        </p>
      </div>
      
      <div className="space-y-6 text-gray-300 leading-relaxed">
        <section className="scroll-fade game-card p-6" data-delay="100">
          <h2 className="heading-sm mb-3">
            {t('legal.privacy.informationCollectTitle')}
          </h2>
          <p>
            {t('legal.privacy.informationCollectBody')}
          </p>
        </section>

        <section className="scroll-fade game-card p-6" data-delay="150">
          <h2 className="heading-sm mb-3">
            {t('legal.privacy.howUseDataTitle')}
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>{t('legal.privacy.howUseDataProcessOrders')}</li>
            <li>{t('legal.privacy.howUseDataVerifyPayments')}</li>
            <li>{t('legal.privacy.howUseDataEmailNotifications')}</li>
            <li>{t('legal.privacy.howUseDataImproveService')}</li>
          </ul>
        </section>

        <section className="scroll-fade game-card p-6" data-delay="200">
          <h2 className="heading-sm mb-3">
            {t('legal.privacy.dataSecurityTitle')}
          </h2>
          <p>
            {t('legal.privacy.dataSecurityBody')}
          </p>
        </section>

        <section className="scroll-fade game-card p-6" data-delay="250">
          <h2 className="heading-sm mb-3">
            {t('legal.privacy.dataRetentionTitle')}
          </h2>
          <p>
            {t('legal.privacy.dataRetentionBody')}
          </p>
        </section>

        <section className="scroll-fade game-card p-6" data-delay="300">
          <h2 className="heading-sm mb-3">
            {t('legal.privacy.cookiesTitle')}
          </h2>
          <p>
            {t('legal.privacy.cookiesBody')}
          </p>
        </section>

        <section className="scroll-fade game-card p-6" data-delay="350">
          <h2 className="heading-sm mb-3">
            {t('legal.privacy.contactTitle')}
          </h2>
          <p>
            {t('legal.privacy.contactBody')}
          </p>
        </section>

      </div>
    </div>
  );
}
