'use client';

import { useLanguage } from '@/lib/language';
import { useScrollFade } from '@/hooks/useScrollFade';
import { RotateCcw } from 'lucide-react';

export default function RefundPolicyPage() {
  const { t } = useLanguage();
  const containerRef = useScrollFade();
  
  return (
    <div className="max-w-3xl mx-auto px-4 pt-8 pb-12" ref={containerRef}>
      <div className="scroll-fade text-center mb-12">
        <div className="w-16 h-16 mx-auto mb-5 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-center">
          <RotateCcw className="w-8 h-8 text-purple-400" />
        </div>
        <h1 className="heading-lg mb-3">
          {t('legal.refund.title')}
        </h1>
        <p className="text-gray-500 text-sm">
          {t('legal.lastUpdatedJan2025')}
        </p>
      </div>
      
      <div className="space-y-6 text-gray-300 leading-relaxed">
        <section className="scroll-fade game-card p-6" data-delay="100">
          <h2 className="heading-sm mb-3">
            {t('legal.refund.digitalProductRefundsTitle')}
          </h2>
          <p>
            {t('legal.refund.digitalProductRefundsBody')}
          </p>
        </section>

        <section className="scroll-fade game-card p-6" data-delay="150">
          <h2 className="heading-sm mb-3">
            {t('legal.refund.eligibleCasesTitle')}
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>{t('legal.refund.eligibleCaseInvalidKey')}</li>
            <li>{t('legal.refund.eligibleCaseWrongProduct')}</li>
            <li>{t('legal.refund.eligibleCaseNoKeyProvided')}</li>
            <li>{t('legal.refund.eligibleCaseDuplicateCharge')}</li>
          </ul>
        </section>

        <section className="scroll-fade game-card p-6" data-delay="200">
          <h2 className="heading-sm mb-3">
            {t('legal.refund.processTitle')}
          </h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>{t('legal.refund.processStepContact')}</li>
            <li>{t('legal.refund.processStepProof')}</li>
            <li>{t('legal.refund.processStepReview')}</li>
            <li>{t('legal.refund.processStepApproved')}</li>
          </ol>
        </section>

        <section className="scroll-fade game-card p-6" data-delay="250">
          <h2 className="heading-sm mb-3">
            {t('legal.refund.nonRefundableTitle')}
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>{t('legal.refund.nonRefundableChangeMind')}</li>
            <li>{t('legal.refund.nonRefundableSystemReq')}</li>
            <li>{t('legal.refund.nonRefundableThirdParty')}</li>
          </ul>
        </section>

        <section className="scroll-fade game-card p-6" data-delay="300">
          <h2 className="heading-sm mb-3">
            {t('legal.refund.timelineTitle')}
          </h2>
          <p>
            {t('legal.refund.timelineBody')}
          </p>
        </section>

      </div>
    </div>
  );
}
