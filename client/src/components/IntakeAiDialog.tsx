import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Mic, Square, Trash2, X } from 'lucide-react';
import { api, type ProposedIntakeOp } from '@/lib/api';
import { useIsMobile } from '@/lib/useIsMobile';
import { Button, Field, Input } from './ui/primitives';
import { cn } from '@/lib/cn';

/**
 * Додавання ліків голосом або текстом.
 *
 * НІЩО не потрапляє в базу, доки людина не натисне «Підтвердити»: модель лише
 * пропонує список змін, який тут можна відредагувати або викинути повністю.
 *
 * Транскрипт показуємо окремо й дослівно — людина має бачити, що саме
 * «почула» модель, а не лише результат розбору. Помилка розпізнавання інакше
 * виглядала б як помилка застосунку.
 */
export function IntakeAiDialog({ trigger }: { trigger: ReactNode }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [transcript, setTranscript] = useState<string | null>(null);
  const [ops, setOps] = useState<ProposedIntakeOp[] | null>(null);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const reset = () => {
    setText('');
    setTranscript(null);
    setOps(null);
    parseText.reset();
    parseVoice.reset();
    apply.reset();
  };

  const onParsed = (r: { transcript: string; ops: ProposedIntakeOp[] }) => {
    setTranscript(r.transcript);
    setOps(r.ops);
  };

  const parseText = useMutation({ mutationFn: () => api.parseIntakeText(text), onSuccess: onParsed });
  const parseVoice = useMutation({ mutationFn: (b: Blob) => api.parseIntakeVoice(b), onSuccess: onParsed });

  const apply = useMutation({
    mutationFn: () =>
      api.applyIntakeOps(
        (ops ?? []).map((o) => ({
          op: o.op,
          type: o.type,
          name: o.name,
          drugClassKey: o.drugClassKey ?? null,
          dosageText: o.dosageText ?? null,
          note: o.note ?? null,
          targetId: o.targetId ?? null,
        })),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['intakes'] });
      // Плашка на сторінці показника читає ті самі прийоми.
      void qc.invalidateQueries({ queryKey: ['biomarker-content'] });
      setOpen(false);
      reset();
    },
  });

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = () => {
        // Доріжки треба зупинити явно, інакше індикатор мікрофона лишається
        // горіти після закриття діалогу.
        stream.getTracks().forEach((tr) => tr.stop());
        parseVoice.mutate(new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' }));
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      // Доступу до мікрофона немає — текстове поле лишається робочим шляхом.
      setRecording(false);
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  const busy = parseText.isPending || parseVoice.isPending;
  const parseError = parseText.error ?? parseVoice.error;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => (o ? setOpen(true) : (setOpen(false), reset()))}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <div className="fixed inset-x-0 bottom-0 z-50 sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(520px,94vw)] sm:-translate-x-1/2 sm:-translate-y-1/2">
                <motion.div
                  className="flex max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl bg-surface shadow-card sm:rounded-2xl"
                  initial={isMobile ? { y: '100%' } : { opacity: 0, y: 12, scale: 0.98 }}
                  animate={isMobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
                  exit={isMobile ? { y: '100%' } : { opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                >
                  <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" />
                  <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
                    <Dialog.Title className="text-lg font-semibold">{t('intakeAi.title')}</Dialog.Title>
                    <Dialog.Close asChild>
                      <Button variant="ghost" className="h-10 w-10 shrink-0 p-0 sm:h-8 sm:w-8"><X size={18} /></Button>
                    </Dialog.Close>
                  </div>

                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                    {!ops && (
                      <>
                        <p className="text-xs text-muted">{t('intakeAi.hint')}</p>

                        <button
                          type="button"
                          onClick={recording ? stopRecording : startRecording}
                          disabled={busy}
                          className={cn(
                            'flex h-14 w-full items-center justify-center gap-2 rounded-xl text-base font-medium transition-colors',
                            recording ? 'bg-alert text-white' : 'bg-primary text-white',
                            busy && 'opacity-60',
                          )}
                        >
                          {recording ? <Square size={18} /> : <Mic size={19} />}
                          {recording ? t('intakeAi.stop') : t('intakeAi.record')}
                        </button>

                        <div className="flex items-center gap-3 text-xs text-muted">
                          <span className="h-px flex-1 bg-line" /> {t('login.or')} <span className="h-px flex-1 bg-line" />
                        </div>

                        <Field label={t('intakeAi.textLabel')}>
                          <Input
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder={t('intakeAi.textPlaceholder')}
                          />
                        </Field>
                        <Button
                          className="w-full"
                          disabled={!text.trim() || busy}
                          onClick={() => parseText.mutate()}
                        >
                          {busy ? <Loader2 className="animate-spin" size={17} /> : null}
                          {busy ? t('intakeAi.parsing') : t('intakeAi.parse')}
                        </Button>
                      </>
                    )}

                    {parseError && <p className="text-sm text-alert">{(parseError as Error).message}</p>}

                    {ops && (
                      <>
                        {/* Дослівний транскрипт: людина має бачити, що почула
                            модель, інакше помилка STT виглядає як помилка
                            застосунку. */}
                        {transcript && (
                          <div className="rounded-xl bg-line/40 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-muted">{t('intakeAi.heard')}</p>
                            <p className="mt-1 text-sm">{transcript}</p>
                          </div>
                        )}

                        {ops.length === 0 && <p className="text-sm text-muted">{t('intakeAi.nothing')}</p>}

                        {ops.map((o, i) => (
                          <OpCard
                            key={i}
                            op={o}
                            onChange={(next) => setOps((prev) => prev!.map((p, j) => (j === i ? next : p)))}
                            onRemove={() => setOps((prev) => prev!.filter((_, j) => j !== i))}
                          />
                        ))}

                        <p className="text-xs text-muted">{t('intakeAi.disclaimer')}</p>
                      </>
                    )}
                  </div>

                  {ops && ops.length > 0 && (
                    <div className="shrink-0 border-t border-line p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
                      {apply.isError && (
                        <p className="mb-2 text-sm text-alert">{(apply.error as Error).message}</p>
                      )}
                      <Button className="h-12 w-full" disabled={apply.isPending} onClick={() => apply.mutate()}>
                        {apply.isPending ? t('app.saving') : t('intakeAi.confirm', { count: ops.length })}
                      </Button>
                    </div>
                  )}
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
 * Одна пропонована зміна.
 *
 * Для STOP/UPDATE явно named який саме наявний запис зачіпається — інакше
 * легко зупинити не те. Якщо запис не знайшовся, кажемо це прямо, а не
 * ховаємо операцію.
 */
function OpCard({
  op,
  onChange,
  onRemove,
}: {
  op: ProposedIntakeOp;
  onChange: (next: ProposedIntakeOp) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const tone =
    op.op === 'ADD' ? 'bg-normal-soft text-normal' : op.op === 'STOP' ? 'bg-alert-soft text-alert' : 'bg-caution-soft text-caution';

  return (
    <div className="rounded-xl border border-line p-3.5">
      <div className="flex items-start gap-2">
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', tone)}>
          {t(`intakeAi.op.${op.op}`)}
        </span>
        <div className="min-w-0 flex-1">
          <Input
            value={op.name}
            onChange={(e) => onChange({ ...op, name: e.target.value })}
            className="h-9"
          />
        </div>
        <Button variant="ghost" aria-label={t('intakeAi.drop')} className="h-9 w-9 shrink-0 p-0" onClick={onRemove}>
          <Trash2 size={15} />
        </Button>
      </div>

      {op.op !== 'ADD' && (
        <p className="mt-2 text-xs text-muted">
          {op.targetLabel
            ? t('intakeAi.affects', { name: op.targetLabel })
            : t('intakeAi.targetMissing')}
        </p>
      )}

      {op.op !== 'STOP' && (
        <div className="mt-2">
          <Input
            value={op.dosageText ?? ''}
            onChange={(e) => onChange({ ...op, dosageText: e.target.value })}
            placeholder={t('intakeAi.dosagePlaceholder')}
            className="h-9"
          />
        </div>
      )}

      <p className="mt-2 text-[11px] text-muted">
        {op.drugClassKey ? t(`drugClass.${op.drugClassKey}`) : t('intakeAi.classUnknown')}
      </p>
    </div>
  );
}
