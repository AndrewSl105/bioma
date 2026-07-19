import { useState, ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Check, Loader2, X } from 'lucide-react';
import { api, AiExtractResult } from '@/lib/api';
import { Button } from './ui/primitives';
import { fmtNum } from '@/lib/format';

/**
 * AI-додавання аналізів:
 * 1) фото документа → /ai/extract → прев'ю розпізнаних показників
 * 2) користувач звіряє → /ai/commit → значення падають в історію
 */
export function AiUploadDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<AiExtractResult | null>(null);
  const [takenAt, setTakenAt] = useState('');
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const qc = useQueryClient();

  const extract = useMutation({
    mutationFn: (file: File) => api.aiExtract(file),
    onSuccess: (res) => {
      setPreview(res);
      setTakenAt(res.takenAt ?? new Date().toISOString().slice(0, 10));
      const init: Record<number, boolean> = {};
      res.items.forEach((it, i) => (init[i] = !!it.matchedBiomarker));
      setSelected(init);
    },
  });

  const commit = useMutation({
    mutationFn: () => {
      const items = preview!.items
        .map((it, i) => ({ it, i }))
        .filter(({ it, i }) => selected[i] && it.matchedBiomarker)
        .map(({ it }) => ({
          biomarkerSlug: it.matchedBiomarker!.slug,
          value: it.extracted.value,
          unit: it.extracted.unit,
          rawText: it.extracted.rawText,
        }));
      return api.aiCommit({ documentId: preview!.documentId, labName: preview!.labName ?? undefined, takenAt, items });
    },
    onSuccess: () => {
      qc.invalidateQueries();
      reset();
    },
  });

  function reset() {
    setOpen(false);
    setPreview(null);
    setSelected({});
    extract.reset();
    commit.reset();
  }

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => (o ? setOpen(true) : reset())}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                className="fixed left-1/2 top-1/2 z-50 w-[min(560px,94vw)] max-h-[88vh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-surface shadow-card"
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              >
                <div className="flex items-center justify-between border-b border-line px-6 py-4">
                  <Dialog.Title className="text-lg font-semibold">Розпізнати з фото</Dialog.Title>
                  <Dialog.Close asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0"><X size={18} /></Button>
                  </Dialog.Close>
                </div>

                <div className="max-h-[calc(88vh-64px)] overflow-y-auto p-6">
                  {!preview && (
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line py-14 text-center hover:border-primary/50 hover:bg-primary-soft/40">
                      {extract.isPending ? (
                        <>
                          <Loader2 className="animate-spin text-primary" />
                          <span className="text-sm text-muted">AI зчитує показники…</span>
                        </>
                      ) : (
                        <>
                          <Camera className="text-primary" />
                          <span className="text-sm font-medium">Сфотографуйте або завантажте бланк</span>
                          <span className="text-xs text-muted">JPEG, PNG або WebP до 15 МБ</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && extract.mutate(e.target.files[0])}
                      />
                    </label>
                  )}

                  {extract.isError && (
                    <p className="mt-3 text-sm text-alert">Не вдалося розпізнати документ. Спробуйте чіткіше фото.</p>
                  )}

                  {preview && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-muted">Дата дослідження</span>
                        <input type="date" value={takenAt} onChange={(e) => setTakenAt(e.target.value)}
                          className="h-9 rounded-lg border border-line px-2 text-sm" />
                        {preview.labName && <span className="text-muted">· {preview.labName}</span>}
                      </div>

                      <div className="space-y-2">
                        {preview.items.map((it, i) => {
                          const matched = !!it.matchedBiomarker;
                          return (
                            <button
                              key={i}
                              disabled={!matched}
                              onClick={() => setSelected((s) => ({ ...s, [i]: !s[i] }))}
                              className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors ${
                                selected[i] ? 'border-primary bg-primary-soft/50' : 'border-line'
                              } ${!matched ? 'opacity-55' : ''}`}
                            >
                              <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                                selected[i] ? 'border-primary bg-primary text-white' : 'border-line'
                              }`}>
                                {selected[i] && <Check size={14} />}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium">
                                  {it.matchedBiomarker?.name ?? it.extracted.name}
                                </div>
                                <div className="truncate text-xs text-muted">{it.extracted.rawText}</div>
                              </div>
                              <div className="tabnums shrink-0 text-right">
                                <div className="font-display text-base font-semibold">{fmtNum(it.extracted.value)}</div>
                                <div className="text-xs text-muted">{it.extracted.unit}</div>
                              </div>
                              {!matched && <span className="shrink-0 text-[11px] text-alert">невідомий</span>}
                            </button>
                          );
                        })}
                      </div>

                      <Button
                        className="w-full"
                        disabled={selectedCount === 0 || commit.isPending}
                        onClick={() => commit.mutate()}
                      >
                        {commit.isPending ? 'Додавання…' : `Додати в історію (${selectedCount})`}
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
