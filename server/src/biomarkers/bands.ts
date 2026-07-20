/**
 * Зони інтерпретації (bands) — градації поверх бінарного ResultFlag.
 *
 * Прапорець відповідає на питання «в межах лабораторної норми чи ні»; зона —
 * на питання «наскільки добре», і саме її людина бачить підписом на бейджі
 * («достатній», «ціль високого ризику»). ResultFlag свідомо не чіпаємо: зона
 * ОБЧИСЛЮЄТЬСЯ на читанні, у БД не зберігається і новим значенням енуму не є.
 *
 * Тип живе тут, а не в prisma/catalog.ts, бо його читає рантайм: catalog.ts —
 * файл сіду, і тягнути з нього типи в src означало б, що зона залежить від
 * сідера. Імпорт іде у зворотний бік: catalog.ts бере Band звідси.
 */

export type BandLevel =
  | 'DEFICIENT'
  | 'LOW'
  | 'BELOW_OPTIMAL'
  | 'OPTIMAL'
  | 'NORMAL'
  | 'ABOVE_OPTIMAL'
  | 'HIGH'
  | 'VERY_HIGH'
  | 'CRITICAL';

/**
 * Смуга значень. min/max опційні: крайні смуги відкриті з одного боку
 * (найнижча має лише max, найвища — лише min).
 *
 * label — авторський підпис українською; він лишається КАНОНОМ і відкатом,
 * рівно як canonicalName у самого маркера. labels додає переклади за локаллю.
 *
 * Переклади живуть тут, а не в BiomarkerContent, бо смуга — це поріг плюс його
 * підпис, і рознести їх по двох моделях означало б з'єднувати назад на кожному
 * читанні. Колонка bands і так Json, тож розширення форми не потребує міграції.
 */
export type Band = {
  level: BandLevel;
  label: string;
  /** { en: 'sufficient' } — локаль → підпис. Відсутня локаль відкочується на label. */
  labels?: Record<string, string>;
  min?: number;
  max?: number;
};

export type Zone = { level: BandLevel; label: string };

const LEVELS: readonly BandLevel[] = [
  'DEFICIENT',
  'LOW',
  'BELOW_OPTIMAL',
  'OPTIMAL',
  'NORMAL',
  'ABOVE_OPTIMAL',
  'HIGH',
  'VERY_HIGH',
  'CRITICAL',
];

/**
 * Розбирає Biomarker.bands (Json?) у типізований масив.
 *
 * Json з БД не має гарантій форми — там може лежати що завгодно, включно з
 * контентом, записаним до появи цього формату. Тому валідуємо кожен елемент і
 * мовчки відкидаємо биті: показник без зон має лишитися робочим (UI відкотиться
 * на прапорець), а не впасти на рендері.
 */
export function parseBands(json: unknown, locale?: string): Band[] {
  if (!Array.isArray(json)) return [];
  const bands: Band[] = [];
  for (const raw of json) {
    if (!raw || typeof raw !== 'object') continue;
    const { level, label, labels, min, max } = raw as Record<string, unknown>;
    if (typeof level !== 'string' || !LEVELS.includes(level as BandLevel)) continue;
    if (typeof label !== 'string') continue;
    if (min !== undefined && typeof min !== 'number') continue;
    if (max !== undefined && typeof max !== 'number') continue;
    if (min === undefined && max === undefined) continue; // смуга без меж нічого не класифікує

    // Переклад обраною мовою, інакше авторський підпис. Ланцюжок такий самий
    // короткий, як у назв маркерів: локаль → канон, без проміжної мови.
    const translated =
      locale && labels && typeof labels === 'object' && !Array.isArray(labels)
        ? (labels as Record<string, unknown>)[locale]
        : undefined;

    bands.push({
      level: level as BandLevel,
      label: typeof translated === 'string' && translated.trim() ? translated : label,
      ...(typeof min === 'number' ? { min } : {}),
      ...(typeof max === 'number' ? { max } : {}),
    });
  }
  return bands;
}

/**
 * Класифікує значення за смугами.
 *
 * Межа належить ВЕРХНІЙ смузі — інтервал [min, max). Це не формальність:
 * у каталозі сусідні смуги свідомо ділять спільну межу (LDL: OPTIMAL max 1.4,
 * NORMAL min 1.4), і без єдиної домовленості значення рівно 1.4 підпадало б під
 * обидві, а зона залежала б від порядку в масиві.
 *
 * Повертає null, якщо смуг немає або значення не вкрило жодну (діра в
 * налаштуваннях) — викликач у такому разі показує самий прапорець.
 */
export function computeZone(value: number, bands: Band[]): Zone | null {
  if (!Number.isFinite(value)) return null;
  for (const b of bands) {
    const okMin = b.min === undefined || value >= b.min;
    const okMax = b.max === undefined || value < b.max;
    if (okMin && okMax) return { level: b.level, label: b.label };
  }
  return null;
}

/**
 * Підставляє підписи потрібною мовою у ВЖЕ готові смуги.
 *
 * Потрібен там, де смуги описані в коді, а не лежать у Json (тілесні метрики):
 * ланцюжок відкату має бути той самий, що й для маркерів, інакше половина
 * застосунку локалізувалась би за іншими правилами.
 */
export function localizeBands(bands: Band[], locale?: string): Band[] {
  if (!locale) return bands;
  return bands.map((b) => {
    const t = b.labels?.[locale];
    return t && t.trim() ? { ...b, label: t } : b;
  });
}

/** Зручний шорткат для місць, де на руках сирий Json із БД. */
export function zoneFromJson(value: number, json: unknown, locale?: string): Zone | null {
  return computeZone(value, parseBands(json, locale));
}
