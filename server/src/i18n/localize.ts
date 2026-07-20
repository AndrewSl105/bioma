import { buildImageUrl, type CategoryDto } from '../r2/r2.url';
import type { Locale } from './locale';

/**
 * Локалізація назв біомаркерів і категорій — одне місце на весь застосунок.
 *
 * У БД канон англійський, а клієнт очікує name/shortName обраною мовою. Раніше
 * ця підміна жила лише в каталозі біомаркерів, тому дашборд та історія віддавали
 * англійський канон — назви там фактично не локалізувалися взагалі.
 *
 * Ланцюжок відкату короткий і свідомо БЕЗ проміжної мови за замовчуванням:
 * переклад обраної мови → канон. Відкат на українську ламав би англійську
 * версію — канон уже англійський, тож для en він і є правильною відповіддю,
 * а не «остання надія».
 */

type Translation = { locale: string; name: string; shortName?: string | null };

function pick<T extends { locale: string }>(translations: T[], locale: Locale): T | undefined {
  return translations.find((t) => t.locale === locale);
}

export type LocalizableBiomarker = {
  canonicalName: string;
  canonicalShort: string | null;
  translations: Translation[];
};

/** Назва й коротка назва маркера обраною мовою. */
export function localizeBiomarkerName(b: LocalizableBiomarker, locale: Locale) {
  const t = pick(b.translations, locale);
  // shortName беремо з того ж джерела, що й name: змішувати українську коротку
  // назву з англійською повною — гірше, ніж не мати короткої взагалі.
  return t
    ? { name: t.name, shortName: t.shortName ?? null }
    : { name: b.canonicalName, shortName: b.canonicalShort };
}

export type LocalizableCategory = {
  id: string;
  slug: string;
  name: string;
  imageKey: string | null;
  translations?: { locale: string; name: string }[];
};

/** Категорія у вигляді для клієнта, з назвою обраною мовою. */
export function localizeCategory(
  c: LocalizableCategory | null | undefined,
  locale: Locale,
): CategoryDto | null {
  if (!c) return null;
  const t = pick(c.translations ?? [], locale);
  return {
    id: c.id,
    slug: c.slug,
    name: t?.name ?? c.name,
    imageUrl: buildImageUrl(c.imageKey),
  };
}

/** include для Prisma: без перекладів категорії локалізувати нічого. */
export const CATEGORY_INCLUDE = { include: { translations: true } };
