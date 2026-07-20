import type { CyclePhase } from '../generated/prisma/enums';

/**
 * Похідні розрахунки циклу.
 *
 * Усе тут — ОЦІНКА з історії відміток, а не медичний факт. Жодна з цих
 * величин не є діагнозом і не придатна як метод контрацепції; відповідні
 * застереження показує клієнт, а сервер лишає їх явними в назвах полів
 * (`estimated*`) — щоб їх не можна було випадково подати як точні.
 *
 * Чиста функція без Prisma: цю логіку найлегше зіпсувати непомітно, тож вона
 * винесена окремо й покрита тестами.
 */

const DAY = 86_400_000;

/** Типові значення — ЛИШЕ доки немає власної історії. */
export const DEFAULT_CYCLE_LENGTH = 28;
export const DEFAULT_PERIOD_LENGTH = 5;

/** Скільки останніх циклів беремо в середнє. */
const RECENT_CYCLES = 6;

/** Межі правдоподібності — захист від друкарських помилок в історії. */
const MIN_CYCLE = 15;
const MAX_CYCLE = 90;

export type CycleStats = {
  /** Початки менструацій, від найдавнішого. */
  periodStarts: Date[];
  /** Довжини завершених циклів у днях. */
  cycleLengths: number[];
  estimatedCycleLength: number;
  estimatedPeriodLength: number;
  /** true, доки середні беруться з дефолтів, а не з власних даних. */
  usingDefaults: boolean;
};

const atMidnight = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const daysBetween = (a: Date, b: Date) =>
  Math.round((atMidnight(b).getTime() - atMidnight(a).getTime()) / DAY);

/**
 * Початки менструацій: день із isPeriod, перед яким НЕ було такого дня.
 *
 * Саме «перед яким не було», а не «перший у місяці»: цикл не збігається з
 * календарним місяцем, і два початки в одному місяці — нормальна ситуація.
 */
export function findPeriodStarts(days: { date: Date; isPeriod: boolean }[]): Date[] {
  const period = days
    .filter((d) => d.isPeriod)
    .map((d) => atMidnight(d.date))
    .sort((a, b) => a.getTime() - b.getTime());

  const starts: Date[] = [];
  for (const d of period) {
    const prev = starts.length ? period[period.indexOf(d) - 1] : undefined;
    const yesterday = prev && daysBetween(prev, d) === 1;
    if (!yesterday) starts.push(d);
  }
  // Перший день узагалі — завжди початок.
  return starts;
}

export function computeStats(
  days: { date: Date; isPeriod: boolean }[],
  manual?: { avgCycleLength?: number | null; avgPeriodLength?: number | null },
): CycleStats {
  const starts = findPeriodStarts(days);

  const lengths: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const len = daysBetween(starts[i - 1], starts[i]);
    // Аномальні проміжки відкидаємо: пропущений місяць відміток інакше
    // «розтягнув» би середнє й зіпсував усі подальші прогнози.
    if (len >= MIN_CYCLE && len <= MAX_CYCLE) lengths.push(len);
  }

  const recent = lengths.slice(-RECENT_CYCLES);
  const avgFromData = recent.length
    ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length)
    : null;

  // Довжина менструації — з найдовшої безперервної серії isPeriod.
  const periodDates = days
    .filter((d) => d.isPeriod)
    .map((d) => atMidnight(d.date))
    .sort((a, b) => a.getTime() - b.getTime());
  let run = 0;
  let best = 0;
  for (let i = 0; i < periodDates.length; i++) {
    run = i > 0 && daysBetween(periodDates[i - 1], periodDates[i]) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }

  const estimatedCycleLength = manual?.avgCycleLength ?? avgFromData ?? DEFAULT_CYCLE_LENGTH;
  const estimatedPeriodLength = manual?.avgPeriodLength ?? (best || DEFAULT_PERIOD_LENGTH);

  return {
    periodStarts: starts,
    cycleLengths: lengths,
    estimatedCycleLength,
    estimatedPeriodLength,
    usingDefaults: !manual?.avgCycleLength && avgFromData == null,
  };
}

/**
 * Фаза на конкретну дату.
 *
 * Модель навмисно проста й прозора: менструальна — поки триває менструація;
 * овуляція — вікно навколо (довжина циклу − 14); до нього фолікулярна, після
 * лютеїнова. Це загальноприйнята оцінка, а не вимірювання: реальна овуляція
 * зсувається, і без тестів/УЗД її дата невідома.
 *
 * Повертає null, якщо початків менструації ще немає — вигадувати фазу «з
 * нічого» гірше, ніж чесно нічого не показати.
 */
export function phaseOn(
  date: Date,
  stats: CycleStats,
): { phase: CyclePhase; dayOfCycle: number } | null {
  const target = atMidnight(date);
  const start = [...stats.periodStarts].reverse().find((s) => s.getTime() <= target.getTime());
  if (!start) return null;

  const dayOfCycle = daysBetween(start, target) + 1; // 1-based: перший день = 1
  if (dayOfCycle > MAX_CYCLE) return null; // відмітки надто давні, щоб щось стверджувати

  const ovulation = stats.estimatedCycleLength - 14;
  if (dayOfCycle <= stats.estimatedPeriodLength) return { phase: 'MENSTRUAL', dayOfCycle };
  // Вікно овуляції ±1 день навколо оцінки — вужче було б удаваною точністю.
  if (Math.abs(dayOfCycle - ovulation) <= 1) return { phase: 'OVULATION', dayOfCycle };
  if (dayOfCycle < ovulation) return { phase: 'FOLLICULAR', dayOfCycle };
  return { phase: 'LUTEAL', dayOfCycle };
}

/** Прогноз наступної менструації. Саме прогноз — підпис обов'язковий. */
export function predictNextPeriod(stats: CycleStats): Date | null {
  const last = stats.periodStarts.at(-1);
  if (!last) return null;
  return new Date(last.getTime() + stats.estimatedCycleLength * DAY);
}

/**
 * Орієнтовне фертильне вікно: 5 днів до оцінки овуляції та день після.
 *
 * ЦЕ НЕ МЕТОД КОНТРАЦЕПЦІЇ. Вікно спирається на середню довжину циклу, а не
 * на вимірювання овуляції, тож зсувається разом із будь-якою нерегулярністю.
 * Клієнт зобов'язаний показувати застереження поруч зі значенням.
 */
export function estimateFertileWindow(stats: CycleStats): { from: Date; to: Date } | null {
  const last = stats.periodStarts.at(-1);
  if (!last) return null;
  const ovulationDay = stats.estimatedCycleLength - 14;
  if (ovulationDay <= 0) return null;
  const ovulation = new Date(last.getTime() + (ovulationDay - 1) * DAY);
  return {
    from: new Date(ovulation.getTime() - 5 * DAY),
    to: new Date(ovulation.getTime() + 1 * DAY),
  };
}
