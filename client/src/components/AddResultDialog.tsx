import { useEffect, useState, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useIsMobile } from '@/lib/useIsMobile';
import { Button, Field, Input } from './ui/primitives';
import { Select } from './ui/Select';
import { DatePicker } from './ui/DatePicker';

export function AddResultDialog({
  trigger,
  defaultSlug,
}: {
  trigger: ReactNode;
  defaultSlug?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState(defaultSlug ?? '');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const qc = useQueryClient();
  const isMobile = useIsMobile();

  const { user } = useAuth();

  const { data: biomarkers } = useQuery({
    queryKey: ['biomarkers'],
    queryFn: api.biomarkers,
    enabled: !!user,
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.addResult({
        biomarkerSlug: slug,
        value: Number(value),
        // Одиницю надсилаємо лише коли вона не канонічна: порожня означає
        // «як у каталозі», і сервер сам підставить канон.
        unit: unit || undefined,
        measuredAt: date,
        note: note || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries();
      setOpen(false);
      setValue('');
      setUnit('');
      setNote('');
    },
  });

  const units = biomarkers?.find((b) => b.slug === slug)?.units ?? [];

  // Показник змінили — стара одиниця більше не застосовна (на іншому маркері
  // «мг/дл» може бути просто відсутня), тож повертаємось до канону.
  useEffect(() => setUnit(''), [slug]);

  const canSubmit = slug && value !== '' && !Number.isNaN(Number(value));

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 bg-ink/30 backdrop-blur-sm z-40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </Dialog.Overlay>
            {/* Позиціювання — на Dialog.Content (Tailwind), анімація — на вкладеному
                motion.div. Так transform шторки не конфліктує з центруванням на sm:+. */}
            <Dialog.Content asChild>
              <div className="fixed inset-x-0 bottom-0 z-50 sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(440px,92vw)] sm:-translate-x-1/2 sm:-translate-y-1/2">
                <motion.div
                  className="max-h-[90dvh] overflow-y-auto rounded-t-2xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-card sm:rounded-2xl sm:p-6 sm:pb-6"
                  initial={isMobile ? { y: '100%' } : { opacity: 0, y: 12, scale: 0.98 }}
                  animate={isMobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
                  exit={isMobile ? { y: '100%' } : { opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                >
                  {/* grabber — тільки на мобільному */}
                  <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" />

                  <div className="mb-5 flex items-center justify-between">
                    <Dialog.Title className="text-lg font-semibold">{t('addResult.title')}</Dialog.Title>
                    <Dialog.Close asChild>
                      <Button variant="ghost" className="h-10 w-10 shrink-0 p-0 sm:h-8 sm:w-8"><X size={18} /></Button>
                    </Dialog.Close>
                  </div>

                  <div className="space-y-4">
                    <Field label={t('addResult.biomarker')}>
                      <Select
                        value={slug}
                        onChange={setSlug}
                        placeholder={t('addResult.choose')}
                        options={(biomarkers ?? []).map((b) => ({
                          value: b.slug,
                          label: b.name,
                          hint: b.unit,
                          group: b.category?.name,
                        }))}
                      />
                    </Field>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label={t('addResult.value')}>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder={t('addResult.valuePlaceholder')}
                          />
                          {/* Вибір одиниці з'являється лише там, де є з чого
                              обирати: для більшості показників одиниця одна,
                              і селект із єдиним пунктом — зайвий клік. */}
                          {units.length > 1 && (
                            <select
                              aria-label={t('addResult.unit')}
                              value={unit || units[0]}
                              onChange={(e) => setUnit(e.target.value)}
                              className="h-11 shrink-0 rounded-xl border border-line bg-surface px-2 text-sm"
                            >
                              {units.map((u) => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      </Field>
                      <Field label={t('addResult.date')}>
                        {/* max — сьогодні: аналіз не може бути з майбутнього,
                            і краще не дати ввести таку дату, ніж потім її ловити. */}
                        <DatePicker value={date} onChange={setDate} max={new Date().toISOString().slice(0, 10)} />
                      </Field>
                    </div>
                    <Field label={t('addResult.note')}>
                      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('addResult.notePlaceholder')} />
                    </Field>

                    {mutation.isError && (
                      <p className="text-sm text-alert">{t('addResult.error')}</p>
                    )}

                    <Button
                      className="w-full"
                      disabled={!canSubmit || mutation.isPending}
                      onClick={() => mutation.mutate()}
                    >
                      {mutation.isPending ? t('addResult.saving') : t('addResult.submit')}
                    </Button>
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
