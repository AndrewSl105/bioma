import { ResultFlag, Sex } from '@prisma/client';

interface RangeLike {
  low: number | null;
  high: number | null;
  sex: Sex;
  ageMinYears: number | null;
  ageMaxYears: number | null;
  optimalLow?: number | null;
  optimalHigh?: number | null;
  unit?: string;
  source?: string | null;
}

/** Обирає найдоречніший референсний діапазон під стать/вік користувача. */
export function pickRange<T extends RangeLike>(
  ranges: T[],
  ctx: { sex?: Sex | null; ageYears?: number | null },
): T | undefined {
  const scored = ranges
    .map((r) => {
      let score = 0;
      if (ctx.sex && r.sex === ctx.sex) score += 2;
      else if (r.sex === 'ANY') score += 1;
      else if (ctx.sex) return null; // діапазон для іншої статі — не підходить

      if (ctx.ageYears != null) {
        const okMin = r.ageMinYears == null || ctx.ageYears >= r.ageMinYears;
        const okMax = r.ageMaxYears == null || ctx.ageYears <= r.ageMaxYears;
        if (!okMin || !okMax) return null;
        if (r.ageMinYears != null || r.ageMaxYears != null) score += 1;
      }
      return { r, score };
    })
    .filter(Boolean) as { r: T; score: number }[];

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.r;
}

/** Класифікує значення відносно діапазону. */
export function computeFlag(
  value: number,
  range?: { low: number | null; high: number | null },
): ResultFlag {
  if (!range) return 'UNKNOWN';
  if (range.low != null && value < range.low) return 'LOW';
  if (range.high != null && value > range.high) return 'HIGH';
  return 'NORMAL';
}
