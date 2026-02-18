'use client';

import { useLanguage } from '@/lib/language';
import { useScrollFade } from '@/hooks/useScrollFade';
import { FileText } from 'lucide-react';

export default function TermsPage() {
  const { t } = useLanguage();
  const containerRef = useScrollFade();
  
  return (
    <div className="max-w-3xl mx-auto px-4 pt-8 pb-12" ref={containerRef}>
      <div className="scroll-fade text-center mb-12">
        <div className="w-16 h-16 mx-auto mb-5 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-center">
          <FileText className="w-8 h-8 text-purple-400" />
        </div>
        <h1 className="heading-lg mb-3">
          {t('legal.terms.title')}
        </h1>
        <p className="text-gray-500 text-sm">
          {t('legal.lastUpdatedJan2025')}
        </p>
      </div>
      
      <div className="space-y-6 text-gray-300 leading-relaxed">
        <section className="scroll-fade game-card p-6" data-delay="100">
          <h2 className="heading-sm mb-3">
            {t('legal.terms.acceptanceTitle')}
          </h2>
          <p>
            {t('legal.terms.acceptanceBody')}
          </p>
        </section>

        <section className="scroll-fade game-card p-6" data-delay="150">
          <h2 className="heading-sm mb-3">
            {t('legal.terms.digitalProductsTitle')}
          </h2>
          <p>
            {t('legal.terms.digitalProductsBody')}
          </p>
        </section>

        <section className="scroll-fade game-card p-6" data-delay="200">
          <h2 className="heading-sm mb-3">
            {t('legal.terms.paymentsTitle')}
          </h2>
          <p>
            {t('legal.terms.paymentsBody')}
          </p>
        </section>

        <section className="scroll-fade game-card p-6" data-delay="250">
          <h2 className="heading-sm mb-3">
            {t('legal.terms.accountResponsibilityTitle')}
          </h2>
          <p>
            {t('legal.terms.accountResponsibilityBody')}
          </p>
        </section>

        <section className="scroll-fade game-card p-6" data-delay="300">
          <h2 className="heading-sm mb-3">
            {t('legal.terms.prohibitedActivitiesTitle')}
          </h2>
          <p>
            {t('legal.terms.prohibitedActivitiesBody')}
          </p>
        </section>

        <section className="scroll-fade game-card p-6" data-delay="350">
          <h2 className="heading-sm mb-3">
            {t('legal.terms.changesToTermsTitle')}
          </h2>
          <p>
            {t('legal.terms.changesToTermsBody')}
          </p>
        </section>

      </div>
    </div>
  );
}
