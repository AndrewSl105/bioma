import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Info, ShieldOff, Trash2 } from 'lucide-react';
import { api, type CycleOverview, type FlowLevel } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useOnline } from '@/lib/useOnline';
import { Button, Card } from '@/components/ui/primitives';
import { currentLocale } from '@/i18n';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/cn';

const SYMPTOMS = [
  'cramps', 'headache', 'bloating', 'backache', 'tender_breasts',
  'fatigue', 'nausea', 'acne', 'cravings', 'insomnia',
] as const;
const FLOWS: FlowLevel[] = ['SPOTTING', 'LIGHT', 'MEDIUM', 'HEAVY'];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Понеділок як перший день тижня для української — як у DatePicker. */
const firstWeekday = (locale: string) => (locale.startsWith('uk') ? 1 : 0);

/**
 * Цикл.
 *
 * Найчутливіший розділ застосунку: показується лише жіночим профілям, збирає
 * дані лише після явної згоди, і всі дані можна видалити окремо, не чіпаючи
 * решту акаунта.
 *
 * Усі похідні величини — ОЦІНКА з історії відміток. Фертильне вікно
 * супроводжується застереженням, яке не можна закрити: воно спирається на
 * середню довжину циклу, а не на вимірювання овуляції.
 */
export function CyclePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const online = useOnline();
  const qc = useQueryClient();
  const [month, setMonth] = useState(() => new Date());
  const [picked, setPicked] = useState<string | null>(null);

  const { data: settings } = useQuery({
    queryKey: ['cycle', 'settings'],
    queryFn: api.cycleSettings,
    enabled: !!user,
  });

  const { data } = useQuery({
    queryKey: ['cycle'],
    queryFn: () => api.cycle(),
    enabled: !!user && !!settings?.enabled,
  });

  const setEnabled = useMutation({
    mutationFn: (enabled: boolean) => api.updateCycleSettings({ enabled }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['cycle'] }),
  });

  const wipe = useMutation({
    mutationFn: () => api.deleteCycleData(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['cycle'] }),
  });

  if (!settings?.enabled) {
    return (
      <div className="space-y-6">
        <Header />
        <Card className="space-y-4 p-6">
          <p className="text-sm">{t('cycle.consentBody')}</p>
          <p className="text-xs text-muted">{t('cycle.consentPrivacy')}</p>
          <Button disabled={!online || setEnabled.isPending} onClick={() => setEnabled.mutate(true)}>
            {t('cycle.enable')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header />
      <MonthGrid
        month={month}
        onMonth={setMonth}
        data={data}
        picked={picked}
        onPick={setPicked}
      />
      {picked && <DayEditor date={picked} data={data} onClose={() => setPicked(null)} />}
      {data && <Summary data={data} />}

      <Card className="space-y-3 p-5">
        <p className="text-sm font-medium">{t('cycle.privacyTitle')}</p>
        <p className="text-xs text-muted">{t('cycle.privacyBody')}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!online} onClick={() => setEnabled.mutate(false)}>
            <ShieldOff size={15} /> {t('cycle.disable')}
          </Button>
          <Button
            variant="outline"
            disabled={!online || wipe.isPending}
            onClick={() => {
              if (confirm(t('cycle.deleteConfirm'))) wipe.mutate();
            }}
          >
            <Trash2 size={15} /> {t('cycle.deleteAll')}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Header() {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight">{t('cycle.title')}</h1>
      <p className="text-sm text-muted">{t('cycle.subtitle')}</p>
    </div>
  );
}

/** Сітка місяця. Свій компонент, а не DatePicker: тут не вибір дати, а карта. */
function MonthGrid({
  month, onMonth, data, picked, onPick,
}: {
  month: Date;
  onMonth: (d: Date) => void;
  data?: CycleOverview;
  picked: string | null;
  onPick: (d: string) => void;
}) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const start = firstWeekday(locale);

  const byDate = useMemo(
    () => new Map((data?.days ?? []).map((d) => [d.date.slice(0, 10), d])),
    [data],
  );
  const fertile = data?.estimatedFertileWindow;
  const next = data?.estimatedNextPeriod?.slice(0, 10);

  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 7 + ((start + i) % 7))));
  }, [locale, start]);

  const cells = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    const lead = (new Date(y, m, 1).getDay() - start + 7) % 7;
    const total = new Date(y, m + 1, 0).getDate();
    const out: (Date | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= total; d++) out.push(new Date(y, m, d));
    return out;
  }, [month, start]);

  const inFertile = (d: string) =>
    !!fertile && d >= fertile.from.slice(0, 10) && d <= fertile.to.slice(0, 10);

  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" aria-label={t('datePicker.prevMonth')} className="h-10 w-10 p-0"
          onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
          <ChevronLeft size={18} />
        </Button>
        <span className="font-medium">
          {new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(month)}
        </span>
        <Button variant="ghost" aria-label={t('datePicker.nextMonth')} className="h-10 w-10 p-0"
          onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
          <ChevronRight size={18} />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted">
        {weekdays.map((w) => <div key={w} className="py-1">{w}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const key = iso(d);
          const day = byDate.get(key);
          const isToday = key === iso(new Date());
          return (
            <button
              key={key}
              type="button"
              onClick={() => onPick(key)}
              // Тач-ціль 44px: сітка місяця на телефоні інакше не натискається.
              className={cn(
                'relative flex h-11 items-center justify-center rounded-lg text-sm transition-colors',
                day?.isPeriod ? 'bg-alert text-white' : 'hover:bg-line/50',
                picked === key && 'ring-2 ring-primary',
                isToday && !day?.isPeriod && 'font-bold text-primary',
              )}
            >
              {d.getDate()}
              {/* Фертильне вікно — крапка, а не заливка: це ОЦІНКА, і
                  візуально вона не має важити стільки ж, як факт відмітки. */}
              {!day?.isPeriod && inFertile(key) && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-caution" />
              )}
              {key === next && !day?.isPeriod && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-alert/50" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-alert" />{t('cycle.legendPeriod')}</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-caution" />{t('cycle.legendFertile')}</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-alert/50" />{t('cycle.legendNext')}</span>
      </div>
    </Card>
  );
}

/** Редактор одного дня: менструація, інтенсивність, симптоми. */
function DayEditor({ date, data, onClose }: { date: string; data?: CycleOverview; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const existing = data?.days.find((d) => d.date.slice(0, 10) === date);
  const [isPeriod, setIsPeriod] = useState(existing?.isPeriod ?? false);
  const [flow, setFlow] = useState<FlowLevel | null>(existing?.flow ?? null);
  const [symptoms, setSymptoms] = useState<string[]>(existing?.symptoms ?? []);

  const save = useMutation({
    mutationFn: () => api.upsertCycleDay({ date, isPeriod, flow, symptoms }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cycle'] });
      onClose();
    },
  });

  const toggle = (s: string) =>
    setSymptoms((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  return (
    <Card className="space-y-4 p-5">
      <p className="font-medium">{fmtDate(date)}</p>

      <button
        type="button"
        onClick={() => setIsPeriod((v) => !v)}
        className={cn(
          'h-12 w-full rounded-xl text-sm font-medium transition-colors',
          isPeriod ? 'bg-alert text-white' : 'bg-surface text-muted ring-1 ring-line',
        )}
      >
        {isPeriod ? t('cycle.isPeriodOn') : t('cycle.isPeriodOff')}
      </button>

      {isPeriod && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">{t('cycle.flow')}</p>
          <div className="flex gap-1.5">
            {FLOWS.map((f) => (
              <button key={f} type="button" onClick={() => setFlow(flow === f ? null : f)}
                className={cn('h-11 flex-1 rounded-xl text-xs font-medium transition-colors',
                  flow === f ? 'bg-primary text-white' : 'bg-surface text-muted ring-1 ring-line')}>
                {t(`cycle.flowValue.${f}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">{t('cycle.symptoms')}</p>
        <div className="flex flex-wrap gap-1.5">
          {SYMPTOMS.map((s) => (
            <button key={s} type="button" onClick={() => toggle(s)}
              className={cn('h-10 rounded-full px-3.5 text-xs font-medium transition-colors',
                symptoms.includes(s) ? 'bg-primary text-white' : 'bg-surface text-muted ring-1 ring-line')}>
              {t(`cycle.symptom.${s}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button className="flex-1" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? t('app.saving') : t('cycle.saveDay')}
        </Button>
        <Button variant="outline" onClick={onClose}>{t('intakes.cancel')}</Button>
      </div>
    </Card>
  );
}

/** Похідні величини — з обов'язковим застереженням про їхню природу. */
function Summary({ data }: { data: CycleOverview }) {
  const { t } = useTranslation();
  const { stats, current } = data;
  return (
    <Card className="space-y-3 p-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t('cycle.dayOfCycle')} value={current ? String(current.dayOfCycle) : '—'} />
        <Stat label={t('cycle.phase')} value={current ? t(`cycle.phaseValue.${current.phase}`) : '—'} />
        <Stat label={t('cycle.avgCycle')} value={t('cycle.days', { count: stats.estimatedCycleLength })} />
        <Stat label={t('cycle.avgPeriod')} value={t('cycle.days', { count: stats.estimatedPeriodLength })} />
      </div>

      {stats.usingDefaults && <p className="text-xs text-muted">{t('cycle.usingDefaults')}</p>}

      {data.estimatedNextPeriod && (
        <p className="text-sm">
          {t('cycle.nextPeriod', { date: fmtDate(data.estimatedNextPeriod) })}
        </p>
      )}

      {/* Застереження поруч зі значенням, а не в підвалі сторінки: саме воно
          відрізняє орієнтир від методу контрацепції. Закрити його не можна. */}
      {data.estimatedFertileWindow && (
        <div className="rounded-xl bg-caution-soft p-3">
          <p className="text-sm text-caution">
            {t('cycle.fertileWindow', {
              from: fmtDate(data.estimatedFertileWindow.from),
              to: fmtDate(data.estimatedFertileWindow.to),
            })}
          </p>
          <p className="mt-1 flex gap-1.5 text-xs text-caution">
            <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
            <span>{t('cycle.fertileDisclaimer')}</span>
          </p>
        </div>
      )}

      <p className="text-xs text-muted">{t('cycle.estimateDisclaimer')}</p>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="font-display text-lg font-semibold">{value}</p>
    </div>
  );
}
