import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CloudOff, Plus, Ruler } from 'lucide-react';
import { api, type BmiCard, type BloodPressureCard, type BodyMetricCard, type Flag, type Zone } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useOnline } from '@/lib/useOnline';
import { offlineHint } from '@/lib/offline';
import { Button, Card, Field, Input } from '@/components/ui/primitives';
import { ZoneBadge } from '@/components/ZoneBadge';
import { AddBodyMetricDialog } from '@/components/AddBodyMetricDialog';
import { fmtDate, fmtNum } from '@/lib/format';

/**
 * Екран «Тіло»: вага, талія, пульс у спокої, тиск і похідний ІМТ.
 *
 * Тілесні метрики свідомо живуть окремо від лабораторних показників: у них
 * немає бланка й лабораторії, вводить їх людина сама і значно частіше.
 */
export function BodyPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const online = useOnline();

  const { data, isLoading } = useQuery({
    queryKey: ['body'],
    queryFn: api.body,
    enabled: !!user,
  });

  if (!data && !online) {
    return (
      <Card className="p-10 text-center">
        <CloudOff className="mx-auto mb-3 text-muted" />
        <p className="font-medium">{t('offline.noSavedData')}</p>
        <p className="mt-1 text-sm text-muted">{t('offline.connectToLoad')}</p>
      </Card>
    );
  }

  if (isLoading || !data) return <p className="text-sm text-muted">{t('app.loading')}</p>;

  const hasAnything =
    data.bloodPressure || data.metrics.some((m) => m.latest) || data.bmi;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight">{t('body.title')}</h1>
          <p className="text-sm text-muted">{t('body.subtitle')}</p>
        </div>
        <AddBodyMetricDialog
          trigger={
            <Button className="w-full sm:w-auto" disabled={!online} title={online ? undefined : offlineHint()}>
              <Plus size={17} /> {t('body.add')}
            </Button>
          }
        />
      </div>

      <HeightCard heightCm={data.heightCm} />

      {!hasAnything && (
        <Card className="p-10 text-center">
          <p className="font-medium">{t('body.emptyTitle')}</p>
          <p className="mt-1 text-sm text-muted">{t('body.emptyHint')}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.bloodPressure && <BloodPressureTile bp={data.bloodPressure} />}
        {data.bmi && <BmiTile bmi={data.bmi} />}
        {data.metrics.filter((m) => m.latest).map((m) => (
          <MetricTile key={m.kind} metric={m} />
        ))}
      </div>
    </div>
  );
}

/**
 * Зріст — на профілі, а не часовим рядом: у дорослого він практично не
 * змінюється, а потрібен постійно, бо без нього не порахувати ІМТ.
 */
function HeightCard({ heightCm }: { heightCm: number | null }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const online = useOnline();
  const [draft, setDraft] = useState(heightCm?.toString() ?? '');

  // Значення з сервера — джерело правди: після успішного збереження чи
  // оновлення ззовні поле має показувати його, а не застряглий чернетковий стан.
  useEffect(() => setDraft(heightCm?.toString() ?? ''), [heightCm]);

  const save = useMutation({
    mutationFn: () => api.setHeight(draft === '' ? null : Number(draft)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['body'] }),
  });

  const changed = draft !== (heightCm?.toString() ?? '');

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-end gap-3">
        <Ruler size={18} className="mb-2.5 shrink-0 text-muted" />
        <div className="w-32">
          <Field label={t('body.height')}>
            <Input
              type="number"
              inputMode="numeric"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="175"
            />
          </Field>
        </div>
        <Button
          variant="outline"
          className="mb-0.5"
          disabled={!changed || save.isPending || !online}
          onClick={() => save.mutate()}
        >
          {save.isPending ? t('app.saving') : t('body.saveHeight')}
        </Button>
        {!heightCm && <p className="mb-2 text-xs text-muted">{t('body.heightForBmi')}</p>}
      </div>
      {save.isError && <p className="mt-2 text-sm text-alert">{(save.error as Error).message}</p>}
    </Card>
  );
}

function Tile({
  title, value, unit, when, zone, flag, hint,
}: {
  title: string; value: string; unit: string; when: string;
  zone: Zone | null; flag?: Flag; hint?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted">{title}</p>
        {/* Бейдж лише коли зона є. У ваги смуг немає навмисне — «нормальної»
            ваги без зросту не буває, — і відкат на «Немає референсу» тут
            повідомляв би про порожнечу замість того, щоб мовчати. */}
        {zone && <ZoneBadge zone={zone} flag={flag ?? 'UNKNOWN'} className="max-w-[10rem] shrink-0" />}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="tabnums font-display text-3xl font-bold">{value}</span>
        <span className="text-sm text-muted">{unit}</span>
      </div>
      <p className="mt-1 text-xs text-muted">{when}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

/** Тиск — однією карткою «120/80»: це один вимір, а не дві метрики. */
function BloodPressureTile({ bp }: { bp: BloodPressureCard }) {
  const { t } = useTranslation();
  return (
    <Tile
      title={t('body.kind.BP')}
      value={`${fmtNum(bp.systolic, 0)}/${fmtNum(bp.diastolic, 0)}`}
      unit={bp.unit}
      when={fmtDate(bp.measuredAt)}
      zone={bp.zone}
    />
  );
}

function BmiTile({ bmi }: { bmi: BmiCard }) {
  const { t } = useTranslation();
  return (
    <Tile
      title={t('body.bmi')}
      value={fmtNum(bmi.value, bmi.precision)}
      unit={bmi.unit}
      when={fmtDate(bmi.measuredAt)}
      zone={bmi.zone}
      // Похідна метрика: кажемо, звідки число, щоб його не шукали в списку
      // введення (там його немає і не буде).
      hint={t('body.bmiDerived')}
    />
  );
}

function MetricTile({ metric }: { metric: BodyMetricCard }) {
  const { t } = useTranslation();
  const last = metric.latest!;
  return (
    <Tile
      title={t(`body.kind.${metric.kind}`)}
      value={fmtNum(last.value, metric.precision)}
      unit={metric.unit}
      when={fmtDate(last.measuredAt)}
      zone={last.zone}
    />
  );
}
