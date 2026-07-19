import { useState, ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Field, Input } from './ui/primitives';

export function AddResultDialog({
  trigger,
  defaultSlug,
}: {
  trigger: ReactNode;
  defaultSlug?: string;
}) {
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState(defaultSlug ?? '');
  const [value, setValue] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const qc = useQueryClient();

  const { data: biomarkers } = useQuery({ queryKey: ['biomarkers'], queryFn: api.biomarkers });

  const mutation = useMutation({
    mutationFn: () =>
      api.addResult({ biomarkerSlug: slug, value: Number(value), measuredAt: date, note: note || undefined }),
    onSuccess: () => {
      qc.invalidateQueries();
      setOpen(false);
      setValue('');
      setNote('');
    },
  });

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
            <Dialog.Content asChild>
              <motion.div
                className="fixed left-1/2 top-1/2 z-50 w-[min(440px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface p-6 shadow-card"
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              >
                <div className="mb-5 flex items-center justify-between">
                  <Dialog.Title className="text-lg font-semibold">Додати значення</Dialog.Title>
                  <Dialog.Close asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0"><X size={18} /></Button>
                  </Dialog.Close>
                </div>

                <div className="space-y-4">
                  <Field label="Показник">
                    <select
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm"
                    >
                      <option value="">Оберіть…</option>
                      {biomarkers?.map((b) => (
                        <option key={b.slug} value={b.slug}>
                          {b.name} ({b.unit})
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Значення">
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="напр. 42.5"
                      />
                    </Field>
                    <Field label="Дата аналізу">
                      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </Field>
                  </div>
                  <Field label="Нотатка (необов'язково)">
                    <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="лабораторія, коментар…" />
                  </Field>

                  {mutation.isError && (
                    <p className="text-sm text-alert">Не вдалося зберегти. Спробуйте ще раз.</p>
                  )}

                  <Button
                    className="w-full"
                    disabled={!canSubmit || mutation.isPending}
                    onClick={() => mutation.mutate()}
                  >
                    {mutation.isPending ? 'Збереження…' : 'Зберегти в історію'}
                  </Button>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
