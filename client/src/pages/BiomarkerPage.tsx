import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CloudOff, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useOnline } from '@/lib/useOnline';
import { OFFLINE_HINT } from '@/lib/offline';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { ResultChart } from '@/components/ResultChart';
import { AddResultDialog } from '@/components/AddResultDialog';
import { fmtDate, fmtNum, flagColor, flagLabel } from '@/lib/format';

export function BiomarkerPage() {
  const { slug = '' } = useParams();
  const qc = useQueryClient();
  const { user } = useAuth();
  const online = useOnline();
  const { data, isLoading } = useQuery({
    queryKey: ['history', slug],
    queryFn: () => api.history(slug),
    enabled: !!user && !!slug,
  });

  const del = useMutation({
    mutationFn: (id: string) => api.deleteResult(id),
    onSuccess: () => qc.invalidateQueries(),
  });

  // Offline і саме цей показник у кеш не потрапив — чесно кажемо про це,
  // інакше екран назавжди лишався б на «Завантаження…».
  if (!data && !online) {
    return (
      <div className="space-y-4">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft size={15} /> До показників
        </Link>
        <Card className="p-10 text-center">
          <CloudOff className="mx-auto mb-3 text-muted" />
          <p className="font-medium">Немає збережених даних</p>
          <p className="mt-1 text-sm text-muted">
            Цей показник ще не завантажувався на цьому пристрої. Відкрийте його,
            коли з'явиться мережа.
          </p>
        </Card>
      </div>
    );
  }

  if (isLoading || !data) return <p className="text-sm text-muted">Завантаження…</p>;

  const { biomarker, reference, latest, trend, series } = data;
  const fc = latest ? flagColor(latest.flag) : null;

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} /> Усі показники
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          {biomarker.category && (
            <span className="text-[11px] uppercase tracking-wide text-muted">{biomarker.category}</span>
          )}
          <h1 className="font-display text-2xl font-bold tracking-tight">{biomarker.name}</h1>
        </div>
        <AddResultDialog
          defaultSlug={slug}
          trigger={
            <Button
              className="w-full sm:w-auto"
              disabled={!online}
              title={online ? undefined : OFFLINE_HINT}
            >
              <Plus size={17} /> Додати значення
            </Button>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs text-muted">Останнє значення</p>
          {latest ? (
            <>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="tabnums font-display text-3xl font-bold sm:text-4xl">
                  {fmtNum(latest.value, biomarker.precision)}
                </span>
                <span className="text-sm text-muted">{biomarker.unit}</span>
              </div>
              {fc && (
                <Badge className={`mt-3 ${fc.bg} ${fc.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${fc.dot}`} />
                  {flagLabel[latest.flag]}
                </Badge>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">Ще немає значень</p>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-xs text-muted">Референс</p>
          {reference && (reference.low != null || reference.high != null) ? (
            <>
              <p className="mt-2 font-display text-xl font-semibold">
                {reference.low ?? '−∞'} – {reference.high ?? '+∞'} <span className="text-sm text-muted">{reference.unit}</span>
              </p>
              {reference.optimalLow != null && (
                <p className="mt-1 text-xs text-muted">оптимально {reference.optimalLow}–{reference.optimalHigh}</p>
              )}
              {reference.source && <p className="mt-2 text-xs text-muted">джерело: {reference.source}</p>}
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">Не задано</p>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-xs text-muted">Зміна від попереднього</p>
          <p className="mt-2 font-display text-xl font-semibold">
            {trend == null ? '—' : `${trend > 0 ? '+' : ''}${fmtNum(trend, biomarker.precision)} ${biomarker.unit}`}
          </p>
          <p className="mt-1 text-xs text-muted">{series.length} вимірювань в історії</p>
        </Card>
      </div>

      {series.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-medium">Динаміка</h2>
          <ResultChart history={data} />
        </Card>
      )}

      <Card className="divide-y divide-line">
        <div className="px-5 py-3 text-sm font-medium">Історія</div>
        {series.slice().reverse().map((p) => {
          const f = flagColor(p.flag);
          return (
            <div key={p.id} className="flex min-h-[3.25rem] items-center gap-3 px-4 py-2.5 sm:gap-4 sm:px-5 sm:py-3">
              <div className="tabnums w-[4.5rem] shrink-0 font-display text-lg font-semibold sm:w-24">
                {fmtNum(p.value, biomarker.precision)}
                <span className="ml-1 text-xs font-normal text-muted">{p.unit}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm">{fmtDate(p.measuredAt)}</div>
                <div className="flex min-w-0 items-center gap-2 text-xs text-muted">
                  <span className={`${f.text} shrink-0`}>{flagLabel[p.flag]}</span>
                  {p.source === 'AI_PHOTO' && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-primary"><Sparkles size={11} /> з фото</span>
                  )}
                  {p.note && <span className="truncate">· {p.note}</span>}
                </div>
              </div>
              <Button
                variant="ghost"
                aria-label="Видалити значення"
                className="h-11 w-11 shrink-0 p-0 sm:h-9 sm:w-9"
                disabled={!online}
                title={online ? undefined : OFFLINE_HINT}
                onClick={() => del.mutate(p.id)}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
