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
 * X-Locale і не має доступу до хуків.
 *
 * Джерело мусить збігатися з i18next, інакше застосунок говорить двома мовами
 * одночасно: t() бере мову з детектора (?lang=, браузер), а X-Locale і формат
 * дат ішли лише з localStorage. Поки користувач явно не обрав мову, localStorage
 * порожній — і англомовний браузер отримував англійський інтерфейс, але
 * українські назви показників і підписи зон із сервера.
 *
 * Порядок такий самий, як у детектора: явний вибір користувача важливіший за
 * все, далі те, що визначив i18next, і лише потім мова за замовчуванням.
 */
export function currentLocale(): Locale {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (isSupportedLocale(stored)) return stored;

  // resolvedLanguage вже враховує load: 'languageOnly', тож 'en-GB' тут
  // приходить як 'en'. До завершення init обидва поля порожні — тоді дефолт.
  const detected = i18n.resolvedLanguage ?? i18n.language;
  return isSupportedLocale(detected) ? detected : DEFAULT_LOCALE;
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
