'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getDictionary, t as translate, type TranslationKeys } from '@/lib/i18n';

export type Language = 'my' | 'en';

type LanguageContextValue = {
  lang: Language;
  setLang: (language: Language) => void;
  /** Inline bilingual helper (legacy — prefer `t()` for new code) */
  tr: (enText: string, myText: string) => string;
  /** Dictionary-based translation: t('nav.home') */
  t: (key: string) => string;
  /** Full dictionary for current language */
  dict: TranslationKeys;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('my');

  useEffect(() => {
    const saved = localStorage.getItem('language');
    if (saved === 'my' || saved === 'en') {
      setLangState(saved);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang === 'my' ? 'my' : 'en';
  }, [lang]);

  const value = useMemo(
    () => ({
      lang,
      setLang: setLangState,
      tr: (enText: string, myText: string) => (lang === 'my' ? myText : enText),
      t: (key: string) => translate(key, lang),
      dict: getDictionary(lang),
    }),
    [lang]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
