// ==========================================
// i18n Index — Burmese Digital Store
// Dictionary-based translation system
// ==========================================

import en, { type TranslationKeys } from './en';
import my from './my';

export type Language = 'en' | 'my';

const dictionaries: Record<Language, TranslationKeys> = { en, my };

/**
 * Get the full dictionary for a language.
 */
export function getDictionary(lang: Language): TranslationKeys {
  return dictionaries[lang] || dictionaries.my;
}

/**
 * Get a nested translation value by dot-separated key.
 * Example: t('nav.home', 'my') → 'မူလ'
 */
export function t(key: string, lang: Language): string {
  const dict = getDictionary(lang);
  const keys = key.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = dict;
  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = current[k];
    } else {
      return key; // Fallback: return key itself if not found
    }
  }
  return typeof current === 'string' ? current : key;
}

export type { TranslationKeys };
export { en, my };
