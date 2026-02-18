'use client';

import { CheckCircle, Clock, Search, XCircle, RotateCcw } from 'lucide-react';
import { useLanguage } from '@/lib/language';

interface OrderStatusProps {
  status: 'pending' | 'verifying' | 'completed' | 'rejected' | 'refunded';
}

const steps = [
  { key: 'pending', label: 'Pending', icon: Clock },
  { key: 'verifying', label: 'Verifying', icon: Search },
  { key: 'completed', label: 'Completed', icon: CheckCircle },
];

export default function OrderStatus({ status }: OrderStatusProps) {
  const { t } = useLanguage();

  const steps = [
    { key: 'pending', label: t('order.pending'), icon: Clock },
    { key: 'verifying', label: t('order.verifying'), icon: Search },
    { key: 'completed', label: t('order.completed'), icon: CheckCircle },
  ];

  if (status === 'rejected' || status === 'refunded') {
    return (
      <div className="flex items-center space-x-3 px-5 py-3 rounded-xl bg-red-500/10 border-2 border-red-500/30">
        {status === 'rejected' ? (
          <XCircle className="w-6 h-6 text-red-400" />
        ) : (
          <RotateCcw className="w-6 h-6 text-amber-400" />
        )}
        <span
          className={`text-sm font-bold ${
            status === 'rejected' ? 'text-red-400' : 'text-amber-400'
          }`}
        >
          {status === 'rejected' ? t('order.paymentRejected') : t('order.refunded')}
        </span>
      </div>
    );
  }

  const currentIndex = steps.findIndex((s) => s.key === status);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isComplete = index <= currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                    isComplete
                      ? isCurrent
                        ? 'bg-purple-500/20 border-2 border-purple-500 text-purple-400 shadow-glow-sm'
                        : 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400'
                      : 'bg-dark-800 border-2 border-dark-600 text-gray-600'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span
                  className={`text-xs mt-2 font-semibold ${
                    isComplete ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-1 mx-3 mb-6 rounded-full transition-all duration-300 ${
                    index < currentIndex
                      ? 'bg-emerald-500'
                      : index === currentIndex
                      ? 'bg-gradient-to-r from-purple-500/50 to-dark-700'
                      : 'bg-dark-700'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
