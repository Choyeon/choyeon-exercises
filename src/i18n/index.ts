import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { zh } from './translations/zh';
import { en } from './translations/en';
import { ja } from './translations/ja';
import { es } from './translations/es';
import { ko } from './translations/ko';
import { fr } from './translations/fr';
import { ru } from './translations/ru';
import { DEFAULT_LANGUAGE } from '@/constants';
import type { LanguageCode } from '@/types';
import { loadSettings } from './settings-sync';

export const SUPPORTED_LANGUAGES: LanguageCode[] = ['zh', 'en', 'ja', 'es', 'ko', 'fr', 'ru'];

export function normalizeLanguage(tag: string | null | undefined): LanguageCode {
  if (!tag) return DEFAULT_LANGUAGE;
  const base = String(tag).trim().toLowerCase().split('-')[0] || DEFAULT_LANGUAGE;
  if (SUPPORTED_LANGUAGES.includes(base as LanguageCode)) {
    return base as LanguageCode;
  }
  return DEFAULT_LANGUAGE;
}

export async function detectInitialLanguage(): Promise<LanguageCode> {
  try {
    const saved = await loadSettings();
    if (saved?.language && SUPPORTED_LANGUAGES.includes(saved.language)) {
      return saved.language;
    }
  } catch {
    /* ignore: fallback to locale */
  }
  const locales = getLocales();
  const first = locales?.[0]?.languageCode;
  return normalizeLanguage(first);
}

export async function bootstrapI18n(): Promise<void> {
  if (i18n.isInitialized) return;
  const lng = await detectInitialLanguage();
  await i18n.use(initReactI18next).init({
    resources: {
      zh: { translation: zh },
      en: { translation: en },
      ja: { translation: ja },
      es: { translation: es },
      ko: { translation: ko },
      fr: { translation: fr },
      ru: { translation: ru },
    },
    lng,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    interpolation: { escapeValue: false },
    returnNull: false,
    returnEmptyString: false,
  });
}

export async function setAppLanguage(lang: LanguageCode): Promise<void> {
  const safe = SUPPORTED_LANGUAGES.includes(lang) ? lang : DEFAULT_LANGUAGE;
  await i18n.changeLanguage(safe);
}

/**
 * Re-export the configured i18next instance for store-level / non-React
 * call sites (zustand actions, utility functions).  Used when
 * `useTranslation()` isn't available but we still need locale strings
 * (for example: default workout session names emitted from the store).
 * Safe to call before bootstrapI18n — returns a sensible fallback string
 * when the resources aren't ready yet.
 */
export { i18n };
