import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CloudOff, FileText, GitCompare } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useOnline } from '@/lib/useOnline';
import { Button, Card } from '@/components/ui/primitives';
import { PanelCompare } from '@/components/PanelCompare';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/cn';

/**
 * Список заборів. Забір — це бланк цілком, тож звідси два шляхи: відкрити
 * один бланк або порівняти два.
 *
 * Вибір для порівняння живе тут, а не на окремому екрані: обидві дати людина
 * обирає з того самого списку, і відправляти її кудись ще заради двох кліків
 * було б зайвим кроком.
 */
export function PanelsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const online = useOnline();
  const [selected, setSelected] = useState<string[]>([]);

  const { data: panels, isLoading } = useQuery({
    queryKey: ['panels'],
    queryFn: api.panels,
    enabled: !!user,
  });

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : // Тримаємо максимум дві дати: порівняння саме попарне, і третій
          // вибір витісняє найстаріший, а не мовчки ігнорується.
          [...prev, id].slice(-2),
    );

  const [a, b] = selected;
  const canCompare = selected.length === 2;

  if (!panels && !online) {
    return (
      <Card className="p-10 text-center">
        <CloudOff className="mx-auto mb-3 text-muted" />
        <p className="font-medium">{t('offline.noSavedData')}</p>
        <p className="mt-1 text-sm text-muted">{t('offline.connectToLoad')}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">{t('panels.title')}</h1>
        <p className="text-sm text-muted">{t('panels.subtitle')}</p>
      </div>

      {isLoading && online && <p className="text-sm text-muted">{t('app.loading')}</p>}

      {panels?.length === 0 && (
        <Card className="p-10 text-center">
          <FileText className="mx-auto mb-3 text-primary" />
          <p className="font-medium">{t('panels.emptyTitle')}</p>
          <p className="mt-1 text-sm text-muted">{t('panels.emptyHint')}</p>
        </Card>
      )}

      {!!panels?.length && (
        <>
          <div className="space-y-2">
            {panels.map((p) => {
              const picked = selected.includes(p.id);
              return (
                <Card
                  key={p.id}
                  className={cn(
                    'flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4',
                    picked && 'ring-2 ring-primary',
                  )}
                >
                  {/* Чекбокс — саме input, а не div з onClick: інакше вибір
                      недосяжний з клавіатури і невидимий для зчитувача екрана. */}
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={picked}
                      onChange={() => toggle(p.id)}
                      className="h-5 w-5 shrink-0 accent-[#0E7C86]"
                      aria-label={t('panels.pickForCompare', { date: fmtDate(p.takenAt) })}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{fmtDate(p.takenAt)}</span>
                      <span className="block truncate text-xs text-muted">
                        {[p.labName, p.name].filter(Boolean).join(' · ') || t('panels.noLab')}
                        {' · '}
                        {t('panels.resultCount', { count: p.resultCount })}
                      </span>
                    </span>
                  </label>
                  <Link to={`/panels/${p.id}`} className="shrink-0">
                    <Button variant="outline" className="w-full sm:w-auto">
                      {t('panels.open')}
                    </Button>
                  </Link>
                </Card>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted">
              {canCompare ? t('panels.compareReady') : t('panels.comparePick')}
            </p>
          </div>

          {/* Таблиця з'являється одразу під списком: так видно, які саме дати
              порівнюються, без переходу на інший екран і назад. */}
          {canCompare && <PanelCompare a={a} b={b} />}
        </>
      )}
    </div>
  );
}
