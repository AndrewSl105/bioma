import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { api, type WellbeingEntry } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useOnline } from '@/lib/useOnline';
import { offlineHint } from '@/lib/offline';
import { Button, Card, Field, Input } from '@/components/ui/primitives';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/cn';

/** Шкали 1..5. sleepHours не тут — це години, а не оцінка. */
const SCALES = ['energy', 'sleepQuality', 'mood', 'digestion'] as const;
type ScaleKey = (typeof SCALES)[number];

const isoToday = () => new Date().toISOString().slice(0, 10);

/** Останні 30 днів — вікно, у якому тренд ще читається на телефоні. */
function rangeDates() {
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 86_400_000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

/**
 * Щоденний чек-ін самопочуття.
 *
 * Ми нічого не трактуємо: показуємо назад те, що людина сама відзначила.
 * Жодних висновків на кшталт «низька енергія через залізо» — поруч у часі
 * ще не означає «через».
 */
export function WellbeingPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const online = useOnline();
  const qc = useQueryClient();
  const [date, setDate] = useState(isoToday);
  const { from, to } = rangeDates();

  const { data: entry } = useQuery({
    queryKey: ['wellbeing', date],
    queryFn: () => api.wellbeing(date),
    enabled: !!user,
  });

  const { data: history } = useQuery({
    queryKey: ['wellbeing', 'range', from, to],
    queryFn: () => api.wellbeingRange(from, to),
    enabled: !!user,
  });

  const [draft, setDraft] = useState<Partial<WellbeingEntry>>({});

  // Чернетку скидаємо, коли з сервера приїхав інший день: інакше оцінки
  // вчорашнього дня «перетікали» б у сьогоднішній чек-ін.
  useEffect(() => setDraft(entry ?? {}), [entry, date]);

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
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['wellbeing'] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">{t('wellbeing.title')}</h1>
        <p className="text-sm text-muted">{t('wellbeing.subtitle')}</p>
      </div>

      <Card className="space-y-5 p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <Field label={t('wellbeing.day')}>
              <Input type="date" value={date} max={isoToday()} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          {entry && <p className="mb-2.5 text-xs text-muted">{t('wellbeing.savedForDay')}</p>}
        </div>

        {SCALES.map((key) => (
          <ScaleRow
            key={key}
            label={t(`wellbeing.scale.${key}`)}
            value={draft[key] ?? null}
            onChange={(v) => setDraft((d) => ({ ...d, [key]: v }))}
          />
        ))}

        <div className="w-44">
          <Field label={t('wellbeing.sleepHours')}>
            <Input
              type="number"
              inputMode="decimal"
              step="0.5"
              min={0}
              max={24}
              value={draft.sleepHours ?? ''}
              onChange={(e) =>
                setDraft((d) => ({ ...d, sleepHours: e.target.value === '' ? null : Number(e.target.value) }))
              }
            />
          </Field>
        </div>

        <Field label={t('wellbeing.note')}>
          <Input
            value={draft.note ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            placeholder={t('wellbeing.notePlaceholder')}
          />
        </Field>

        <Button disabled={save.isPending || !online} title={online ? undefined : offlineHint()} onClick={() => save.mutate()}>
          {save.isPending ? t('app.saving') : t('wellbeing.save')}
          {save.isSuccess && !save.isPending && <Check size={16} />}
        </Button>
      </Card>

      {!!history?.length && <History entries={history} />}
    </div>
  );
}

/**
 * Шкала 1..5 кнопками.
 *
 * Кнопки, а не слайдер: на телефоні влучити пальцем у поділку слайдера важче,
 * ніж натиснути одну з п'яти цілей, а проміжних значень тут і не буває.
 * Повторне натискання знімає оцінку — інакше помилковий тик не скасувати.
 */
function ScaleRow({
  label, value, onChange,
}: { label: string; value: number | null; onChange: (v: number | null) => void }) {
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
                'h-11 flex-1 rounded-xl text-sm font-medium transition-colors',
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

/** Тренд по кожній шкалі — просто ряд крапок за днями, без інтерпретацій. */
function History({ entries }: { entries: WellbeingEntry[] }) {
  const { t } = useTranslation();
  return (
    <Card className="space-y-4 p-5">
      <h2 className="text-sm font-medium">{t('wellbeing.history')}</h2>
      {SCALES.map((key) => {
        const points = entries.filter((e) => e[key] != null);
        if (!points.length) return null;
        return (
          <div key={key}>
            <p className="mb-1.5 text-xs text-muted">{t(`wellbeing.scale.${key}`)}</p>
            <div className="flex items-end gap-1 overflow-x-auto">
              {entries.map((e) => {
                const v = e[key] as number | null;
                return (
                  <div
                    key={e.date}
                    // title, а не самі стовпчики: дата й оцінка мають бути
                    // доступні, але підписувати кожен із 30 днів нічим.
                    title={`${fmtDate(e.date)}: ${v ?? '—'}`}
                    className="flex h-16 w-3 shrink-0 items-end"
                  >
                    <div
                      className={cn('w-full rounded-sm', v ? 'bg-primary' : 'bg-line')}
                      style={{ height: v ? `${(v / 5) * 100}%` : '4px' }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="text-xs text-muted">{t('wellbeing.historyHint')}</p>
    </Card>
  );
}
