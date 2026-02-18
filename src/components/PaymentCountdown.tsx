'use client';

import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';

// ==========================================
// Payment Countdown Timer - Burmese Digital Store
// Shows live countdown until payment window expires
// ==========================================

interface PaymentCountdownProps {
  expiresAt: string; // ISO date string
  onExpired?: () => void;
}

export default function PaymentCountdown({ expiresAt, onExpired }: PaymentCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      return Math.max(0, Math.floor(diff / 1000));
    };

    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      if (remaining <= 0) {
        setExpired(true);
        onExpired?.();
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  if (expired || timeLeft <= 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
        <Timer className="w-4 h-4 text-red-400" />
        <span className="text-sm font-semibold text-red-400">Payment window expired</span>
      </div>
    );
  }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isUrgent = timeLeft < 120; // Less than 2 minutes

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
      isUrgent
        ? 'bg-red-500/10 border-red-500/20'
        : 'bg-amber-500/10 border-amber-500/20'
    }`}>
      <Timer className={`w-4 h-4 ${isUrgent ? 'text-red-400 animate-pulse' : 'text-amber-400'}`} />
      <span className={`text-sm font-mono font-semibold ${isUrgent ? 'text-red-400' : 'text-amber-400'}`}>
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
      <span className={`text-xs ${isUrgent ? 'text-red-400/70' : 'text-amber-400/70'}`}>
        remaining
      </span>
    </div>
  );
}
