/**
 * Нагадування про перездачу.
 *
 * Скоуп свідомо в-застосунковий: бейдж на картці й фільтр на дашборді. Ні
 * push, ні email тут немає — надсилати людині листи про аналізи це окрема
 * розмова про згоду й доставку, а не побічний ефект дашборда.
 */

export type RetestStatus = 'DUE' | 'OVERDUE' | 'OK';

export type Retest = {
  /** Скільки днів між здачами — особистий або типовий. */
  intervalDays: number;
  /** Коли варто перездати: останній вимір + інтервал. */
  nextDueAt: Date;
  status: RetestStatus;
  /** Від'ємне — прострочено на стільки днів. */
  daysLeft: number;
};

const DAY_MS = 86_400_000;

/** «Скоро» — за тиждень до строку. */
const DUE_SOON_DAYS = 7;

/**
 * Рахує строк перездачі.
 *
 * Повертає null, коли нагадування не налаштоване або ще немає жодного виміру:
 * без останньої дати відлічувати нема від чого, а вигадувати «від сьогодні»
 * означало б нагадувати про перездачу того, що жодного разу не здавали.
 *
 * Особистий інтервал перекриває типовий: періодичність залежить від людини й
 * її ситуації, а не від самого показника.
 */
export function computeRetest(
  lastMeasuredAt: Date | null,
  personalIntervalDays: number | null,
  defaultIntervalDays: number | null,
  now: Date = new Date(),
): Retest | null {
  const intervalDays = personalIntervalDays ?? defaultIntervalDays;
  if (!intervalDays || intervalDays <= 0) return null;
  if (!lastMeasuredAt) return null;

  const nextDueAt = new Date(lastMeasuredAt.getTime() + intervalDays * DAY_MS);
  // Округлюємо вгору: пів дня до строку — це ще «лишився день», а не нуль.
  const daysLeft = Math.ceil((nextDueAt.getTime() - now.getTime()) / DAY_MS);

  const status: RetestStatus =
    daysLeft < 0 ? 'OVERDUE' : daysLeft <= DUE_SOON_DAYS ? 'DUE' : 'OK';

  return { intervalDays, nextDueAt, status, daysLeft };
}
