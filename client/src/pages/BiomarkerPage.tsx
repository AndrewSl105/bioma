import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CloudOff, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useOnline } from '@/lib/useOnline';
import { offlineHint } from '@/lib/offline';
import { Button, Card } from '@/components/ui/primitives';
import { ResultChart } from '@/components/ResultChart';
import { AddResultDialog } from '@/components/AddResultDialog';
import { BiomarkerContentSections } from '@/components/BiomarkerContentSections';
import { ZoneBadge } from '@/components/ZoneBadge';
import { fmtDate, fmtNum, flagColor } from '@/lib/format';
import { zoneColor } from '@/lib/zones';
import { cn } from '@/lib/cn';

export function BiomarkerPage() {
  const { t } = useTranslation();
  const { slug = '' } = useParams();
  const qc = useQueryClient();
  const { user } = useAuth();
  const online = useOnline();

  // Вкладка живе в URL, а не в стані: інакше посилання на «Про показник» не
  // переслати, а «назад» у браузері виходило б зі сторінки замість повернення
  // на попередню вкладку.
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'about' ? 'about' : 'overview';
  const setTab = (next: 'overview' | 'about') => {
    const p = new URLSearchParams(params);
    if (next === 'overview') p.delete('tab');
    else p.set('tab', next);
    setParams(p, { replace: false });
  };

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
          <ArrowLeft size={15} /> {t('biomarker.backShort')}
        </Link>
        <Card className="p-10 text-center">
          <CloudOff className="mx-auto mb-3 text-muted" />
          <p className="font-medium">{t('offline.noSavedData')}</p>
          <p className="mt-1 text-sm text-muted">{t('offline.biomarkerNotCached')}</p>
        </Card>
      </div>
    );
  }

  if (isLoading || !data) return <p className="text-sm text-muted">{t('app.loading')}</p>;

  const { biomarker, reference, latest, trend, series } = data;

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} /> {t('biomarker.back')}
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          {biomarker.category && (
            <span className="block truncate text-[11px] uppercase tracking-wide text-muted">{biomarker.category.name}</span>
          )}
          <h1 className="font-display text-2xl font-bold tracking-tight">{biomarker.name}</h1>
        </div>
        <AddResultDialog
          defaultSlug={slug}
          trigger={
            <Button
              className="w-full sm:w-auto"
              disabled={!online}
              title={online ? undefined : offlineHint()}
            >
              <Plus size={17} /> {t('dashboard.addResult')}
            </Button>
          }
        />
      </div>

      {/* Таби під шапкою: back-лінк і «Додати значення» лишаються над ними,
          бо це дії над показником, а не над вмістом вкладки. */}
      <div
        role="tablist"
        aria-label={t('biomarker.tabsLabel')}
        className="flex gap-1 rounded-xl bg-surface p-1 ring-1 ring-line"
      >
        {(['overview', 'about'] as const).map((key) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              'h-11 flex-1 rounded-lg px-3 text-sm font-medium transition-colors',
              tab === key
                ? 'bg-primary-soft text-primary-ink'
                : 'text-muted hover:bg-line/40 hover:text-ink',
            )}
          >
            {t(`biomarker.tab_${key}`)}
          </button>
        ))}
      </div>

      {tab === 'about' ? (
        <BiomarkerContentSections slug={slug} />
      ) : (
        <>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="p-5">
            <p className="text-xs text-muted">{t('biomarker.latest')}</p>
            {latest ? (
              <>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="tabnums font-display text-3xl font-bold sm:text-4xl">
                    {fmtNum(latest.value, biomarker.precision)}
                  </span>
                  <span className="text-sm text-muted">{biomarker.unit}</span>
                </div>
                <ZoneBadge zone={latest.zone} flag={latest.flag} className="mt-3" />
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">{t('biomarker.noValues')}</p>
            )}
          </Card>

          <Card className="p-5">
            <p className="text-xs text-muted">{t('biomarker.reference')}</p>
            {reference && (reference.low != null || reference.high != null) ? (
              <>
                <p className="mt-2 font-display text-xl font-semibold">
                  {reference.low ?? '−∞'} – {reference.high ?? '+∞'} <span className="text-sm text-muted">{reference.unit}</span>
                </p>
                {reference.optimalLow != null && (
                  <p className="mt-1 text-xs text-muted">{t('biomarker.optimal', { low: reference.optimalLow, high: reference.optimalHigh })}</p>
                )}
                {reference.source && <p className="mt-2 text-xs text-muted">{t('biomarker.source', { source: reference.source })}</p>}
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">{t('biomarker.referenceNotSet')}</p>
            )}
          </Card>

          <Card className="p-5">
            <p className="text-xs text-muted">{t('biomarker.trend')}</p>
            <p className="mt-2 font-display text-xl font-semibold">
              {trend == null ? '—' : `${trend > 0 ? '+' : ''}${fmtNum(trend, biomarker.precision)} ${biomarker.unit}`}
            </p>
            <p className="mt-1 text-xs text-muted">{t('biomarker.measurements', { count: series.length })}</p>
          </Card>
        </div>

        {series.length > 0 && (
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-medium">{t('biomarker.chart')}</h2>
            <ResultChart history={data} />
          </Card>
        )}

        <Card className="divide-y divide-line">
          <div className="px-5 py-3 text-sm font-medium">{t('biomarker.history')}</div>
          {series.slice().reverse().map((p) => {
            const f = flagColor(p.flag);
            return (
              /* Мобільний макет — стовпчик, а не стиснений desktop-рядок:
                 1) значення + одиниця, кнопка видалення справа
                 2) дата
                 3) статус · джерело · нотатка
                 На sm:+ повертаємось до горизонтального рядка. */
              <div
                key={p.id}
                className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
              >
                <div className="flex items-start justify-between gap-3 sm:contents">
                  {/* whitespace-nowrap тримає число і одиницю разом — саме тут
                      вони й розривалися на вузьких екранах. Фіксованої ширини
                      на мобільному немає: вона й підпирала дату. */}
                  <div className="tabnums whitespace-nowrap font-display text-lg font-semibold sm:w-24 sm:shrink-0">
                    {fmtNum(p.value, biomarker.precision)}
                    <span className="ml-1 text-xs font-normal text-muted">{p.unit}</span>
                  </div>

                  {/* Кнопка в першому рядку на мобільному, в кінці — на sm:+.
                      order гарантує, що вона не опиниться між текстом. */}
                  <Button
                    variant="ghost"
                    aria-label={t('biomarker.deleteValue')}
                    className="h-11 w-11 shrink-0 p-0 sm:order-last"
                    disabled={!online}
                    title={online ? undefined : offlineHint()}
                    onClick={() => del.mutate(p.id)}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>

                <div className="min-w-0 sm:flex-1">
                  <div className="text-sm">{fmtDate(p.measuredAt)}</div>
                  {/* flex-wrap + min-w-0: довга нотатка обрізається, а не
                      виштовхує статус із рядка. */}
                  <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                    {/* У рядку історії — текст, не бейдж: бейджі стовпчиком на
                        кожному вимірі перетворили б список на кольорову стіну.
                        Зона підписує точніше за прапорець, тож коли вона є —
                        показуємо саме її. */}
                    <span className={`${p.zone ? zoneColor(p.zone.level).text : f.text} shrink-0`}>
                      {p.zone ? p.zone.label : t(`flag.${p.flag}`)}
                    </span>
                    {p.source === 'AI_PHOTO' && (
                      <span className="inline-flex shrink-0 items-center gap-1 text-primary">
                        <Sparkles size={11} /> {t('biomarker.fromPhoto')}
                      </span>
                    )}
                    {p.note && <span className="min-w-0 basis-full truncate sm:basis-auto">· {p.note}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
        </>
      )}
    </div>
  );
}
