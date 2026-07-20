/**
 * Локаль запиту. Єдине місце, де живе поняття «мова інтерфейсу» — раніше вона
 * була зашита константою UI_LOCALE одразу в кількох сервісах, і додавання мови
 * означало правку кожного з них.
 */

/** Мова застосунку за замовчуванням. */
export const DEFAULT_LOCALE = 'uk';

/**
 * Локаль, якою заповнений канон у БД (canonicalName). Останній відкат, коли
 * перекладу немає ні обраною мовою, ні дефолтною.
 */
export const CANONICAL_LOCALE = 'en';

/** Підтримувані мови. Додати нову — дописати сюди й у словники клієнта. */
export const SUPPORTED_LOCALES = [DEFAULT_LOCALE, CANONICAL_LOCALE] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === 'string' && SUPPORTED_LOCALES.includes(value as Locale);
}

/**
 * Зводить довільний тег до підтримуваної мови: 'uk-UA' → 'uk'. Непідтримувані
 * теги дають null, а не помилку — заголовок приходить від клієнта, і чужа мова
 * має тихо відкотитись на дефолт, а не ламати запит.
 */
export function normalizeLocale(value: string | undefined | null): Locale | null {
  if (!value) return null;
  const base = value.trim().toLowerCase().split(/[-_]/)[0];
  return isSupportedLocale(base) ? base : null;
}

/**
 * Розбирає Accept-Language з урахуванням q-ваг і повертає першу підтримувану
 * мову. Заголовок шлють браузери, тож він — найгірший за пріоритетом варіант,
 * але кращий за сліпий дефолт.
 */
export function fromAcceptLanguage(header: string | undefined): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.find((p) => p.trim().startsWith('q='));
      return { tag, q: q ? Number.parseFloat(q.split('=')[1]) : 1 };
    })
    .filter((x) => Number.isFinite(x.q))
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const locale = normalizeLocale(tag);
    if (locale) return locale;
  }
  return null;
}
