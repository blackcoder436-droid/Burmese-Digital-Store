'use client';

// ==========================================
// Share Product Button
// Phase 10.9 — Quick UX Improvements
// Uses Web Share API with clipboard fallback
// ==========================================

import { useState } from 'react';
import { Share2, Check, Link as LinkIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/language';

interface ShareButtonProps {
  title: string;
  text?: string;
  url?: string;
  className?: string;
  compact?: boolean;
}

export function ShareButton({ title, text, url, className = '', compact = false }: ShareButtonProps) {
  const { tr } = useLanguage();
  const [copied, setCopied] = useState(false);

  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
  const shareText = text || title;

  async function handleShare() {
    // Try Web Share API first (mobile-friendly)
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (err) {
        // User cancelled or API failed — fall through to clipboard
        if ((err as Error).name === 'AbortError') return;
      }
    }

    // Fallback: copy link to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success(tr('Link copied!', 'Link ကူးပြီးပါပြီ!'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(tr('Failed to copy link', 'Link ကူး၍မရပါ'));
    }
  }

  if (compact) {
    return (
      <button
        onClick={handleShare}
        className={`w-10 h-10 flex items-center justify-center rounded-xl bg-dark-700/50 border border-dark-600/50 text-gray-400 hover:text-white hover:border-purple-500/40 hover:bg-purple-500/10 transition-all ${className}`}
        title={tr('Share', 'မျှဝေမယ်')}
        aria-label={tr('Share product', 'ပစ္စည်းမျှဝေမယ်')}
      >
        {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
      </button>
    );
  }

  return (
    <button
      onClick={handleShare}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-dark-700/50 border border-dark-600/50 text-gray-400 hover:text-white hover:border-purple-500/40 hover:bg-purple-500/10 transition-all text-sm ${className}`}
      aria-label={tr('Share product', 'ပစ္စည်းမျှဝေမယ်')}
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 text-emerald-400" />
          <span className="text-emerald-400">{tr('Copied!', 'ကူးပြီး!')}</span>
        </>
      ) : (
        <>
          <Share2 className="w-4 h-4" />
          <span>{tr('Share', 'မျှဝေမယ်')}</span>
        </>
      )}
    </button>
  );
}
