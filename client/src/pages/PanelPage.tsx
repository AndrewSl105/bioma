import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card } from '@/components/ui/primitives';
import { ZoneBadge } from '@/components/ZoneBadge';
import { fmtDate, fmtNum } from '@/lib/format';

/**
 * Один забір цілком — так, як він виглядає на бланку: усі показники разом,
 * згруповані за категоріями. Саме «разом» тут і є сенсом: по одному показнику
 * їх і так видно на дашборді.
 */
export function PanelPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['panels', id],
    queryFn: () => api.panel(id),
    enabled: !!user && !!id,
  });

  if (isLoading || !data) return <p className="text-sm text-muted">{t('app.loading')}</p>;

  const { panel, groups } = data;
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="space-y-6">
      <Link to="/panels" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} /> {t('panels.backToList')}
      </Link>

      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">{fmtDate(panel.takenAt)}</h1>
        <p className="text-sm text-muted">
          {[panel.labName, panel.name].filter(Boolean).join(' · ') || t('panels.noLab')}
          {' · '}
          {t('panels.resultCount', { count: total })}
        </p>
      </div>

      {groups.map((g) => (
        <div key={g.category?.slug ?? 'none'}>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            {g.category?.name ?? t('addBiomarker.uncategorized')} · {g.items.length}
          </h2>
          <Card className="divide-y divide-line">
            {g.items.map((it) => (
              // На мобільному — стовпчик: назва окремим рядком, значення і
              // зона під нею. У один ряд назва стискалася до «Холес…», що не
              // ідентифікує показник узагалі; тут назва важливіша за
              // компактність. На sm:+ повертаємось до рядка.
              <div key={it.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-5">
                <Link
                  to={`/b/${it.biomarker.slug}`}
                  className="min-w-0 sm:flex-1 sm:truncate hover:text-primary"
                >
                  {it.biomarker.name}
                </Link>
                <div className="flex items-center justify-between gap-3 sm:contents">
                  <span className="tabnums whitespace-nowrap font-display font-semibold">
                    {fmtNum(it.value, it.biomarker.precision)}
                    <span className="ml-1 text-xs font-normal text-muted">{it.unit}</span>
                  </span>
                  <ZoneBadge zone={it.zone} flag={it.flag} className="max-w-[9rem] shrink-0" />
                </div>
              </div>
            ))}
          </Card>
        </div>
      ))}
    </div>
  );
}
