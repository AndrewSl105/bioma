import { useState, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { api, type BodyMetricKind } from '@/lib/api';
import { useIsMobile } from '@/lib/useIsMobile';
import { Button, Field, Input } from './ui/primitives';
import { Select } from './ui/Select';
import { DatePicker } from './ui/DatePicker';

/** Метрики, які вводяться одним числом. Тиск — окрема гілка (два поля). */
const SIMPLE: BodyMetricKind[] = ['WEIGHT', 'WAIST', 'RESTING_HR'];

/**
 * Додавання тілесної метрики.
 *
 * Тиск — той самий діалог, але з ДВОМА полями й однією датою: це один вимір,
 * і просити внести його двома окремими записами означало б розсинхрон дат уже
 * на другому кроці, а картку «120/—» — на першому.
 *
 * ІМТ у списку немає свідомо: він похідний від ваги і зросту, і вводити його
 * руками означало б завести третє джерело правди, яке одразу розійдеться.
 */
export function AddBodyMetricDialog({ trigger }: { trigger: ReactNode }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string>('WEIGHT');
  const [value, setValue] = useState('');
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const bp = kind === 'BP';

  const reset = () => {
    setValue('');
    setSystolic('');
    setDiastolic('');
  };

  const mutation = useMutation({
    mutationFn: () =>
      bp
        ? api.addBloodPressure({
            systolic: Number(systolic),
            diastolic: Number(diastolic),
            measuredAt: date,
          })
        : api.addBodyMetric({ kind: kind as BodyMetricKind, value: Number(value), measuredAt: date }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['body'] });
      setOpen(false);
      reset();
    },
  });

  const num = (s: string) => s !== '' && !Number.isNaN(Number(s));
  const canSubmit = bp ? num(systolic) && num(diastolic) : num(value);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
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
              <div className="fixed inset-x-0 bottom-0 z-50 sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(440px,92vw)] sm:-translate-x-1/2 sm:-translate-y-1/2">
                <motion.div
                  className="max-h-[90dvh] overflow-y-auto rounded-t-2xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-card sm:rounded-2xl sm:p-6 sm:pb-6"
                  initial={isMobile ? { y: '100%' } : { opacity: 0, y: 12, scale: 0.98 }}
                  animate={isMobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
                  exit={isMobile ? { y: '100%' } : { opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                >
                  <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" />

                  <div className="mb-5 flex items-center justify-between">
                    <Dialog.Title className="text-lg font-semibold">{t('body.addTitle')}</Dialog.Title>
                    <Dialog.Close asChild>
                      <Button variant="ghost" className="h-10 w-10 shrink-0 p-0 sm:h-8 sm:w-8">
                        <X size={18} />
                      </Button>
                    </Dialog.Close>
                  </div>

                  <div className="space-y-4">
                    <Field label={t('body.metric')}>
                      <Select
                        value={kind}
                        onChange={(v) => {
                          setKind(v);
                          reset();
                        }}
                        options={[
                          ...SIMPLE.map((k) => ({ value: k, label: t(`body.kind.${k}`) })),
                          { value: 'BP', label: t('body.kind.BP') },
                        ]}
                      />
                    </Field>

                    {bp ? (
                      // Два поля в один ряд із «/» між ними — так віджет читається
                      // як звичний запис тиску, а не як дві незалежні метрики.
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <Field label={t('body.systolic')}>
                            <Input
                              type="number"
                              inputMode="numeric"
                              value={systolic}
                              onChange={(e) => setSystolic(e.target.value)}
                              placeholder="120"
                            />
                          </Field>
                        </div>
                        <span aria-hidden className="pb-2.5 text-xl text-muted">/</span>
                        <div className="flex-1">
                          <Field label={t('body.diastolic')}>
                            <Input
                              type="number"
                              inputMode="numeric"
                              value={diastolic}
                              onChange={(e) => setDiastolic(e.target.value)}
                              placeholder="80"
                            />
                          </Field>
                        </div>
                      </div>
                    ) : (
                      <Field label={t(`body.kind.${kind}`)}>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                        />
                      </Field>
                    )}

                    <Field label={t('addResult.date')}>
                      {/* max — сьогодні: вимір із майбутнього ввести не можна. */}
                      <DatePicker value={date} onChange={setDate} max={new Date().toISOString().slice(0, 10)} />
                    </Field>

                    {mutation.isError && (
                      // Текст із сервера, а не загальне «помилка»: там саме межі
                      // («50–300 мм рт. ст.»), тобто єдина підказка по суті.
                      <p className="text-sm text-alert">{(mutation.error as Error).message}</p>
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
