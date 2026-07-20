/**
 * Зіставлення рядка бланка з показником каталогу.
 *
 * Винесено з ai.service окремо й без залежностей від Prisma — саме тут
 * найлегше тихо зіпсувати дані: неправильний збіг не падає, а кладе значення
 * не в той показник, і помітити це можна лише за дивним трендом через місяці.
 */

export type MatchTarget = {
  slug: string;
  loincCode: string | null;
  names: string[];
  shorts: (string | null)[];
};

export type MatchConfidence = 'exact' | 'fuzzy';

/**
 * Нормалізація для порівняння: без регістру, розділових знаків і пробілів.
 *
 * Дужки прибираються РАЗОМ із вмістом, і це не косметика: у каталозі назва
 * часто містить абревіатуру («Тиреотропний гормон (ТТГ)»), а в бланку її може
 * не бути. Без цього кроку такий рядок не збігався б ані точно, ані підрядково.
 */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/**
 * Мінімальна довжина ключа для підрядкового збігу.
 *
 * Коротка назва на 2–3 літери знаходиться всередині чужої («ТГ» усередині
 * «ТТГ»), і рядок мовчки лягав би не в той показник. Точний збіг цього
 * обмеження не має — там неоднозначності немає.
 */
export const FUZZY_MIN_LENGTH = 4;

export function buildMatcher(targets: MatchTarget[]) {
  const byLoinc = new Map<string, MatchTarget>();
  const byName = new Map<string, MatchTarget>();
  const byShort = new Map<string, MatchTarget>();

  for (const t of targets) {
    if (t.loincCode) byLoinc.set(t.loincCode, t);
    // Порожній ключ зловив би будь-що через includes() — відкидаємо.
    for (const n of t.names) if (n && norm(n)) byName.set(norm(n), t);
    for (const s of t.shorts) if (s && norm(s)) byShort.set(norm(s), t);
  }

  const fuzzy = (map: Map<string, MatchTarget>, needle: string) =>
    [...map.entries()].find(([k]) => k.length >= FUZZY_MIN_LENGTH && needle.includes(k))?.[1];

  return function match(
    name: string,
    loinc?: string | null,
  ): { target: MatchTarget; confidence: MatchConfidence } | null {
    const needle = norm(name);
    const exact = (loinc && byLoinc.get(loinc)) || byName.get(needle) || byShort.get(needle);
    if (exact) return { target: exact, confidence: 'exact' };

    const approx = fuzzy(byShort, needle) ?? fuzzy(byName, needle);
    return approx ? { target: approx, confidence: 'fuzzy' } : null;
  };
}
