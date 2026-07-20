import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type WellbeingEntry } from '@/lib/api';
import { useIsMobile } from '@/lib/useIsMobile';
import { Button, Field, Input } from './ui/primitives';
import { DatePicker } from './ui/DatePicker';
import { cn } from '@/lib/cn';

const SCALES = ['energy', 'sleepQuality', 'mood', 'digestion'] as const;
type ScaleKey = (typeof SCALES)[number];

const isoToday = () => new Date().toISOString().slice(0, 10);

/**
 * «Відмітити день» — головна дія екрана самопочуття.
 *
 * Чек-ін живе в шиті, а не просто на сторінці: це разова дія на день, і
 * тримати чотири шкали, години сну й нотатку постійно розгорнутими означало б
 * віддати їм увесь екран, лишивши тренди — те, заради чого сюди повертаються —
 * нижче за згин.
 *
 * Дата за замовчуванням сьогоднішня: у переважній більшості випадків людина
 * відмічає саме поточний день, і жоден зайвий тап тут не потрібен. Заднім
 * числом — можна, наперед — ні.
 */
export function MarkDaySheet({ trigger }: { trigger: ReactNode }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(isoToday);
  const [draft, setDraft] = useState<Partial<WellbeingEntry>>({});

  // Значення саме того дня, який зараз обрано в шиті. Запит окремий від
  // огляду: людина може гортати дати всередині шита, і кожна має підтягувати
  // свої відмітки.
  const { data: entry, isFetching } = useQuery({
    queryKey: ['wellbeing', date],
    queryFn: () => api.wellbeing(date),
    enabled: open,
  });

  // Чернетку перезаписуємо на кожну зміну дня: інакше оцінки попереднього дня
  // «перетікали» б у наступний і тихо перезаписали б його при збереженні.
  useEffect(() => {
    if (open) setDraft(entry ?? {});
  }, [entry, date, open]);

  const save = useMutation({
    mutationFn: () =>
      api.saveWellbeing({
        date,
        energy: draft.energy ?? null,
        sleepQuality: draft.sleepQuality ?? null,
        sleepHours: draft.sleepHours ?? null,
        mood: draft.mood ?? null,
        digestion: draft.digestion ?? null,
        note: draft.note ?? null,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wellbeing'] });
      setOpen(false);
    },
  });

  const marked = !!entry;
  // Порожній чек-ін зберігати нема сенсу — це створило б запис-привид, який
  // виглядає як відмічений день, але нічого не каже.
  const hasAnything =
    SCALES.some((k) => draft[k] != null) || draft.sleepHours != null || !!draft.note?.trim();

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <div className="fixed inset-x-0 bottom-0 z-50 sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(460px,92vw)] sm:-translate-x-1/2 sm:-translate-y-1/2">
                <motion.div
                  className="max-h-[92dvh] overflow-y-auto rounded-t-2xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-card sm:rounded-2xl sm:p-6 sm:pb-6"
                  initial={isMobile ? { y: '100%' } : { opacity: 0, y: 12, scale: 0.98 }}
                  animate={isMobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
                  exit={isMobile ? { y: '100%' } : { opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                >
                  <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" />

                  <div className="mb-4 flex items-center justify-between">
                    <Dialog.Title className="text-lg font-semibold">{t('wellbeing.markDay')}</Dialog.Title>
                    <Dialog.Close asChild>
                      <Button variant="ghost" className="h-10 w-10 shrink-0 p-0 sm:h-8 sm:w-8">
                        <X size={18} />
                      </Button>
                    </Dialog.Close>
                  </div>

                  <div className="space-y-4">
                    <Field label={t('wellbeing.day')}>
                      {/* Спільний DatePicker: на мобільному це шит із великим
                          календарем, а не браузерний контрол, який іде за
                          мовою браузера, а не застосунку. */}
                      <DatePicker value={date} onChange={setDate} max={isoToday()} />
                    </Field>

                    {marked && !isFetching && (
                      <p className="rounded-xl bg-primary-soft p-3 text-xs text-primary-ink">
                        {t('wellbeing.savedForDay')}
                      </p>
                    )}

                    {SCALES.map((key) => (
                      <ScaleRow
                        key={key}
                        label={t(`wellbeing.scale.${key}`)}
                        value={draft[key] ?? null}
                        onChange={(v) => setDraft((d) => ({ ...d, [key]: v }))}
                      />
                    ))}

                    <Field label={t('wellbeing.sleepHours')}>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        min={0}
                        max={24}
                        value={draft.sleepHours ?? ''}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            sleepHours: e.target.value === '' ? null : Number(e.target.value),
                          }))
                        }
                      />
                    </Field>

                    <Field label={t('wellbeing.note')}>
                      <Input
                        value={draft.note ?? ''}
                        onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                        placeholder={t('wellbeing.notePlaceholder')}
                      />
                    </Field>

                    <Button
                      className="h-12 w-full"
                      disabled={!hasAnything || save.isPending}
                      onClick={() => save.mutate()}
                    >
                      {save.isPending ? t('app.saving') : t('wellbeing.confirm')}
                      {!save.isPending && <Check size={17} />}
                    </Button>
                    {save.isError && (
                      <p className="text-sm text-alert">{(save.error as Error).message}</p>
                    )}
                  </div>
                </motion.div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

/**
 * Шкала 1..5 великими кнопками.
 *
 * h-12 і flex-1 замість дрібних контролів: це головний елемент вводу на
 * екрані, і на телефоні в нього цілять пальцем. Повторне натискання знімає
 * оцінку — інакше помилковий тап не скасувати.
 */
function ScaleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted">{label}</p>
      <div role="group" aria-label={label} className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={active}
              aria-label={t('wellbeing.scaleValue', { label, n })}
              onClick={() => onChange(active ? null : n)}
              className={cn(
                'h-12 flex-1 rounded-xl text-base font-medium transition-colors',
                active
                  ? 'bg-primary text-white'
                  : 'bg-surface text-muted ring-1 ring-line hover:bg-line/40 hover:text-ink',
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type { ScaleKey };
export { SCALES };
