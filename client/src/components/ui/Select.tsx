import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/cn';

export type SelectOption = {
  value: string;
  label: string;
  /** Другий рядок — одиниця виміру, підказка тощо. */
  hint?: string;
  /** Заголовок групи, під яким показувати опцію. */
  group?: string;
};

/**
 * Власний select замість нативного.
 *
 * Нативний `<select>` на десктопі показує системний список без пошуку, а
 * каталог біомаркерів — це десятки пунктів, у яких без пошуку не зорієнтуєшся.
 * Тут: пошук усередині, групування, клавіатурна навігація і тач-цілі 44px.
 *
 * На мобільному список розкривається шторкою знизу — тягтися до випадайки
 * вгорі екрана великим пальцем незручно.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder,
  searchable,
  disabled,
  id,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** За замовчуванням пошук вмикається сам, коли пунктів багато. */
  searchable?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const withSearch = searchable ?? options.length > 8;
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.hint?.toLowerCase().includes(q) ||
        o.group?.toLowerCase().includes(q),
    );
  }, [options, query]);

  // Групи в порядку появи: порядок задає той, хто передав options
  // (для категорій це sortOrder адміністратора), і сортувати його заново
  // означало б цей намір загубити.
  const groups = useMemo(() => {
    const map = new Map<string, SelectOption[]>();
    for (const o of filtered) {
      const key = o.group ?? '';
      const list = map.get(key);
      if (list) list.push(o);
      else map.set(key, [o]);
    }
    return [...map];
  }, [filtered]);

  // Плаский порядок для навігації стрілками — саме той, у якому пункти
  // намальовані, інакше «вниз» стрибало б між групами непередбачувано.
  const flat = useMemo(() => groups.flatMap(([, items]) => items), [groups]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const i = flat.findIndex((o) => o.value === value);
    setActiveIndex(i >= 0 ? i : 0);
    // Фокус у пошук лише на десктопі: на мобільному це підняло б клавіатуру
    // поверх списку, який користувач щойно відкрив.
    if (withSearch && window.matchMedia('(min-width: 640px)').matches) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
    // flat навмисно не в залежностях: скидати позицію треба на відкриття,
    // а не на кожну зміну фільтра.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Клік поза межами й Escape закривають список.
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

  // Активний пункт тримаємо у зоні видимості при навігації з клавіатури.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  function commit(next: string) {
    onChange(next);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = flat[activeIndex];
      if (opt) commit(opt.value);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(flat.length - 1);
    }
  }

  let index = -1;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        className={cn(
          'flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3.5',
          'text-left text-base text-ink transition-colors sm:text-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          'disabled:opacity-50',
        )}
      >
        <span className={cn('min-w-0 truncate', !selected && 'text-muted')}>
          {selected ? selected.label : (placeholder ?? t('addResult.choose'))}
        </span>
        <ChevronDown
          size={16}
          className={cn('shrink-0 text-muted transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <>
          {/* Затемнення лише на мобільному — там список іде шторкою. */}
          <div className="fixed inset-0 z-40 bg-ink/20 sm:hidden" aria-hidden />
          <div
            className={cn(
              'z-50 flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card',
              'fixed inset-x-0 bottom-0 max-h-[70dvh] rounded-b-none pb-[env(safe-area-inset-bottom)]',
              'sm:absolute sm:inset-x-auto sm:bottom-auto sm:mt-1 sm:max-h-72 sm:w-full sm:rounded-xl sm:pb-0',
            )}
          >
            {withSearch && (
              <div className="relative shrink-0 border-b border-line p-2">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={onKeyDown}
                  placeholder={t('select.search')}
                  className={cn(
                    'h-10 w-full rounded-lg bg-paper pl-8 pr-3 text-base text-ink sm:text-sm',
                    'placeholder:text-muted focus-visible:outline-none',
                  )}
                />
              </div>
            )}

            <div ref={listRef} id={listId} role="listbox" className="min-h-0 flex-1 overflow-y-auto p-1">
              {flat.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-muted">{t('select.notFound')}</p>
              )}

              {groups.map(([group, items]) => (
                <div key={group || '_'}>
                  {group && (
                    <p className="px-3 pb-1 pt-2 text-[11px] uppercase tracking-wide text-muted">
                      {group}
                    </p>
                  )}
                  {items.map((o) => {
                    index += 1;
                    const i = index;
                    const isSelected = o.value === value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        data-index={i}
                        onPointerEnter={() => setActiveIndex(i)}
                        onClick={() => commit(o.value)}
                        className={cn(
                          'flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left',
                          i === activeIndex ? 'bg-paper' : 'bg-transparent',
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm">{o.label}</span>
                          {o.hint && (
                            <span className="block truncate text-xs text-muted">{o.hint}</span>
                          )}
                        </span>
                        {isSelected && <Check size={16} className="shrink-0 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
