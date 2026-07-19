import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { ResultChart } from '@/components/ResultChart';
import { AddResultDialog } from '@/components/AddResultDialog';
import { fmtDate, fmtNum, flagColor, flagLabel } from '@/lib/format';

export function BiomarkerPage() {
  const { slug = '' } = useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['history', slug], queryFn: () => api.history(slug) });

  const del = useMutation({
    mutationFn: (id: string) => api.deleteResult(id),
    onSuccess: () => qc.invalidateQueries(),
  });

  if (isLoading || !data) return <p className="text-sm text-muted">Завантаження…</p>;

  const { biomarker, reference, latest, trend, series } = data;
  const fc = latest ? flagColor(latest.flag) : null;

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} /> Усі показники
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {biomarker.category && (
            <span className="text-[11px] uppercase tracking-wide text-muted">{biomarker.category}</span>
          )}
          <h1 className="font-display text-2xl font-bold tracking-tight">{biomarker.name}</h1>
        </div>
        <AddResultDialog defaultSlug={slug} trigger={<Button><Plus size={17} /> Додати значення</Button>} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs text-muted">Останнє значення</p>
          {latest ? (
            <>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="tabnums font-display text-4xl font-bold">
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
            <div key={p.id} className="flex items-center gap-4 px-5 py-3">
              <div className="tabnums w-24 font-display text-lg font-semibold">
                {fmtNum(p.value, biomarker.precision)}
                <span className="ml-1 text-xs font-normal text-muted">{p.unit}</span>
              </div>
              <div className="flex-1">
                <div className="text-sm">{fmtDate(p.measuredAt)}</div>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span className={f.text}>{flagLabel[p.flag]}</span>
                  {p.source === 'AI_PHOTO' && (
                    <span className="inline-flex items-center gap-1 text-primary"><Sparkles size={11} /> з фото</span>
                  )}
                  {p.note && <span>· {p.note}</span>}
                </div>
              </div>
              <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => del.mutate(p.id)}>
                <Trash2 size={15} />
              </Button>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
