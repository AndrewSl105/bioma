import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { uk } from './uk';
import { en } from './en';

/** Мова застосунку за замовчуванням. Мусить збігатися з DEFAULT_LOCALE бекенда. */
export const DEFAULT_LOCALE = 'uk';

/** Підтримувані мови. Додати нову — дописати словник і SUPPORTED_LOCALES бекенда. */
export const SUPPORTED_LOCALES = ['uk', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  uk: 'Українська',
  en: 'English',
};

/** Ключ у localStorage. Той самий читає api.ts, щоб слати X-Locale ще до React. */
export const LOCALE_STORAGE_KEY = 'bioma.locale';

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Поточна локаль поза React-деревом — потрібна в api.ts, який шле заголовок
 * X-Locale і не має доступу до хуків. Джерело те саме, що й в i18next.
 */
export function currentLocale(): Locale {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  return isSupportedLocale(stored) ? stored : DEFAULT_LOCALE;
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { uk: { translation: uk }, en: { translation: en } },
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: [...SUPPORTED_LOCALES],
    // Без цього 'uk-UA' від браузера не знайде словник 'uk'.
    load: 'languageOnly',
    detection: {
      // Явний вибір користувача важливіший за мову браузера, тому localStorage
      // попереду navigator. ?lang= лишаємо першим — для шеринга посилань.
      order: ['querystring', 'localStorage', 'navigator'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: LOCALE_STORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
  });

export default i18n;
