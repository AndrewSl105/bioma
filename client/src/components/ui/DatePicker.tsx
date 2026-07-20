import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { currentLocale } from '@/i18n';

/** ISO-дата (YYYY-MM-DD) без зсуву часового поясу — саме її очікує API. */
function toISO(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Розбір ISO без `new Date('YYYY-MM-DD')`: той парсить рядок як UTC, і на
 * від'ємних зсувах календар показував би попередній день.
 */
function fromISO(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Перший день тижня для локалі. Intl.Locale.getWeekInfo є не всюди, тож
 * для української фіксуємо понеділок явно — календар із неділі там
 * читається як помилка.
 */
function firstWeekday(locale: string): number {
  return locale.startsWith('en') ? 0 : 1;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Власний вибір дати замість нативного `<input type="date">`.
 *
 * Нативний контрол на десктопі відкриває браузерний календар, який не
 * підпорядковується ні дизайн-системі, ні локалі застосунку (він іде за
 * мовою браузера). Тут: великі тач-цілі, свій формат, тиждень із понеділка
 * для української і перемикання місяця/року з клавіатури.
 */
export function DatePicker({
  value,
  onChange,
  id,
  max,
  min,
  disabled,
  className,
}: {
  /** ISO YYYY-MM-DD. */
  value: string;
  onChange: (iso: string) => void;
  id?: string;
  max?: string;
  min?: string;
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const [open, setOpen] = useState(false);
  const selected = fromISO(value);
  const [view, setView] = useState<Date>(() => selected ?? new Date());
  const rootRef = useRef<HTMLDivElement>(null);

  const maxDate = max ? fromISO(max) : null;
  const minDate = min ? fromISO(min) : null;

  useEffect(() => {
    if (open && selected) setView(selected);
    // Перечитуємо лише на відкриття: інакше гортання місяців скидалось би
    // назад до обраної дати.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    const start = firstWeekday(locale);
    // 2024-01-07 — неділя; від неї відлічуємо потрібний старт тижня.
    return Array.from({ length: 7 }, (_, i) =>
      fmt.format(new Date(2024, 0, 7 + ((start + i) % 7))),
    );
  }, [locale]);

  const days = useMemo(() => {
    const year = view.getFullYear();
    const month = view.getMonth();
    const first = new Date(year, month, 1);
    // Скільки порожніх клітинок до першого числа, з урахуванням старту тижня.
    const lead = (first.getDay() - firstWeekday(locale) + 7) % 7;
    const total = new Date(year, month + 1, 0).getDate();

    const cells: Array<Date | null> = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= total; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [view, locale]);

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(view),
    [view, locale],
  );

  const display = selected
    ? new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(
        selected,
      )
    : '';

  function isDisabled(d: Date) {
    if (maxDate && d > maxDate) return true;
    if (minDate && d < minDate) return true;
    return false;
  }

  function shiftMonth(delta: number) {
    setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1));
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3.5',
          'text-left text-base text-ink transition-colors sm:text-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50',
        )}
      >
        <span className={cn('truncate', !display && 'text-muted')}>
          {display || t('datePicker.choose')}
        </span>
        <CalendarDays size={16} className="shrink-0 text-muted" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-ink/20 sm:hidden" aria-hidden />
          <div
            className={cn(
              'z-50 rounded-2xl border border-line bg-surface p-3 shadow-card',
              'fixed inset-x-0 bottom-0 rounded-b-none pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
              'sm:absolute sm:inset-x-auto sm:bottom-auto sm:mt-1 sm:w-[19rem] sm:rounded-xl sm:pb-3',
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label={t('datePicker.prevMonth')}
                onClick={() => shiftMonth(-1)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-line/40 hover:text-ink"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="min-w-0 truncate text-sm font-medium capitalize">{monthLabel}</span>
              <button
                type="button"
                aria-label={t('datePicker.nextMonth')}
                onClick={() => shiftMonth(1)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-line/40 hover:text-ink"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {weekdays.map((w) => (
                <div key={w} className="pb-1 text-center text-[11px] uppercase text-muted">
                  {w}
                </div>
              ))}
              {days.map((d, i) => {
                if (!d) return <div key={`pad-${i}`} />;
                const isSelected = selected && sameDay(d, selected);
                const isToday = sameDay(d, new Date());
                const off = isDisabled(d);
                return (
                  <button
                    key={d.getTime()}
                    type="button"
                    disabled={off}
                    onClick={() => {
                      onChange(toISO(d));
                      setOpen(false);
                    }}
                    className={cn(
                      // aspect-square + min-h: на мобільному клітинка виходить
                      // ~44px, на десктопі не роздувається.
                      'flex aspect-square min-h-10 items-center justify-center rounded-xl text-sm transition-colors',
                      isSelected
                        ? 'bg-primary font-medium text-white'
                        : isToday
                          ? 'bg-primary-soft text-primary-ink'
                          : 'hover:bg-line/40',
                      off && 'cursor-not-allowed opacity-30 hover:bg-transparent',
                    )}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                onChange(toISO(new Date()));
                setOpen(false);
              }}
              className="mt-2 h-11 w-full rounded-xl text-sm font-medium text-primary transition-colors hover:bg-primary-soft"
            >
              {t('datePicker.today')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
