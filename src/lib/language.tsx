'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Language = 'my' | 'en';

type LanguageContextValue = {
  lang: Language;
  setLang: (language: Language) => void;
  tr: (enText: string, myText: string) => string;
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
