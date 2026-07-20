import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, CalendarClock, Camera, CloudOff, LayoutGrid, ListPlus, Plus, Rows3, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useOnline } from '@/lib/useOnline';
import { offlineHint, formatSyncedAt } from '@/lib/offline';
import { Button, Card } from '@/components/ui/primitives';
import { AddResultDialog } from '@/components/AddResultDialog';
import { AddBiomarkerDialog } from '@/components/AddBiomarkerDialog';
import { AiUploadDialog } from '@/components/AiUploadDialog';
import { ZoneBadge } from '@/components/ZoneBadge';
import { fmtDate, fmtNum } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { OverviewCard, Retest } from '@/lib/api';

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const online = useOnline();
  // До логіну жодних запитів до API — інакше гарантований 401.
  // Запит лишається вимкненим і offline (user там null), але вже відновлені
  // з диска дані useQuery однаково віддає — саме на цьому тримається
  // offline-читання.
  const {
    data: cards,
    isLoading,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['overview'],
    queryFn: api.overview,
    enabled: !!user,
  });
  const syncedAt = formatSyncedAt(dataUpdatedAt);

  // Вид і фільтр — стан лише цього екрана, тож живуть у компоненті, а не в URL.
  const [grouped, setGrouped] = useState(false);
  const [onlyOutOfRange, setOnlyOutOfRange] = useState(false);
  const [onlyDue, setOnlyDue] = useState(false);

  // Фільтруємо на клієнті: картки вже всі тут, і зайвий похід на сервер
  // заради відкидання частини масиву нічого б не пришвидшив.
  const visible = useMemo(() => {
    let list = cards ?? [];
    if (onlyOutOfRange) list = list.filter((c) => c.latest?.flag === 'HIGH' || c.latest?.flag === 'LOW');
    // Фільтри складаються, а не витісняють один одного: «поза нормою і час
    // перездати» — це саме той перетин, заради якого їх і вмикають разом.
    if (onlyDue) list = list.filter((c) => c.retest && c.retest.status !== 'OK');
    return list;
  }, [cards, onlyOutOfRange, onlyDue]);

  // Порядок категорій задав бекенд (sortOrder адміністратора) — зберігаємо
  // порядок появи, а не сортуємо заново.
  const groups = useMemo(() => {
    const map = new Map<string, OverviewCard[]>();
    for (const c of visible) {
      const key = c.biomarker.category?.name ?? t('addBiomarker.uncategorized');
      const list = map.get(key);
      if (list) list.push(c);
      else map.set(key, [c]);
    }
    return [...map];
  }, [visible, t]);

  const outOfRangeCount = useMemo(
    () => (cards ?? []).filter((c) => c.latest?.flag === 'HIGH' || c.latest?.flag === 'LOW').length,
    [cards],
  );

  const dueCount = useMemo(
    () => (cards ?? []).filter((c) => c.retest && c.retest.status !== 'OK').length,
    [cards],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-sm text-muted">{t('dashboard.subtitle')}</p>
        </div>
        {/* на мобільному — кнопки на всю ширину в стовпчик (у ряд по 50%
            «Додати значення» не вміщається на 360px), на sm:+ — звичайний ряд */}
        {/* Offline запис вимкнено: у цій версії черги синхронізації немає,
            тож чесніше не пускати в діалог, ніж дати заповнити форму і
            впасти на відправці. Розпізнавання з фото — тим паче: воно
            виконується на сервері. */}
        <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto">
          <AddBiomarkerDialog
            trigger={
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                disabled={!online}
                title={online ? undefined : offlineHint()}
              >
                <ListPlus size={17} /> {t('dashboard.addBiomarker')}
              </Button>
            }
          />
          <AiUploadDialog
            trigger={
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                disabled={!online}
                title={online ? undefined : offlineHint()}
              >
                <Camera size={17} /> {t('dashboard.fromPhoto')}
              </Button>
            }
          />
          <AddResultDialog
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
      </div>

      {/* Offline показуємо вік даних: без цього збережені показники виглядають
          як щойно завантажені, а для аналізів це вводить в оману. */}
      {!online && syncedAt && (
        <p className="text-sm text-muted">{t('offline.syncedAt', { when: syncedAt })}</p>
      )}

      {/* Панель виду показується лише коли є що впорядковувати: над двома
          картками перемикачі — це шум. */}
      {!!cards?.length && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOnlyOutOfRange((v) => !v)}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
              onlyOutOfRange
                ? 'bg-alert text-white'
                : 'bg-surface text-muted ring-1 ring-line hover:text-ink',
            )}
          >
            <AlertTriangle size={13} />
            {t('dashboard.onlyOutOfRange')}
            {outOfRangeCount > 0 && ` (${outOfRangeCount})`}
          </button>

          {/* Кнопка з'являється лише коли є що фільтрувати: нагадування
              налаштовані не в усіх, і порожній фільтр був би мертвою кнопкою. */}
          {dueCount > 0 && (
            <button
              type="button"
              onClick={() => setOnlyDue((v) => !v)}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
                onlyDue
                  ? 'bg-caution text-white'
                  : 'bg-surface text-muted ring-1 ring-line hover:text-ink',
              )}
            >
              <CalendarClock size={13} />
              {t('dashboard.onlyDue')} ({dueCount})
            </button>
          )}

          <div className="ml-auto inline-flex rounded-full bg-surface p-0.5 ring-1 ring-line">
            <button
              type="button"
              aria-label={t('dashboard.viewFlat')}
              onClick={() => setGrouped(false)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
                grouped ? 'text-muted hover:text-ink' : 'bg-primary-soft text-primary-ink',
              )}
            >
              <LayoutGrid size={13} /> {t('dashboard.viewFlat')}
            </button>
            <button
              type="button"
              aria-label={t('dashboard.viewGrouped')}
              onClick={() => setGrouped(true)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
                grouped ? 'bg-primary-soft text-primary-ink' : 'text-muted hover:text-ink',
              )}
            >
              <Rows3 size={13} /> {t('dashboard.viewGrouped')}
            </button>
          </div>
        </div>
      )}

      {/* Фільтр не сховав геть усе — окремий стан, інакше порожній екран
          читався б як «даних немає» замість «під фільтр нічого не підпало». */}
      {onlyOutOfRange && visible.length === 0 && !!cards?.length && (
        <Card className="p-8 text-center">
          <p className="font-medium">{t('dashboard.allInRange')}</p>
          <p className="mt-1 text-sm text-muted">{t('dashboard.allInRangeHint')}</p>
        </Card>
      )}

      {isLoading && online && <p className="text-sm text-muted">{t('app.loading')}</p>}

      {/* Offline і кеш порожній (перший запуск без мережі) — окремий стан,
          щоб не показувати «додайте перше значення», коли додати нічим. */}
      {!online && !cards && (
        <Card className="p-10 text-center">
          <CloudOff className="mx-auto mb-3 text-muted" />
          <p className="font-medium">{t('offline.noSavedData')}</p>
          <p className="mt-1 text-sm text-muted">{t('offline.connectToLoad')}</p>
        </Card>
      )}

      {/* Дашборд наповнюють обрані показники, тож у нового користувача він
          порожній. Головна дія тут — саме обрати показник зі списку. */}
      {!isLoading && cards?.length === 0 && (
        <Card className="p-10 text-center">
          <TrendingUp className="mx-auto mb-3 text-primary" />
          <p className="font-medium">{t('dashboard.emptyTitle')}</p>
          <p className="mt-1 text-sm text-muted">{t('dashboard.emptyHint')}</p>
          <AddBiomarkerDialog
            trigger={
              <Button
                className="mt-4"
                disabled={!online}
                title={online ? undefined : offlineHint()}
              >
                <ListPlus size={17} /> {t('dashboard.emptyAction')}
              </Button>
            }
          />
        </Card>
      )}

      {grouped ? (
        <div className="space-y-6">
          {groups.map(([category, items]) => (
            <div key={category}>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
                {category} · {items.length}
              </h2>
              <CardGrid items={items} />
            </div>
          ))}
        </div>
      ) : (
        <CardGrid items={visible} />
      )}
    </div>
  );
}

/** Сітка карток. Винесена, щоб плаский і згрупований види малювали те саме. */
function CardGrid({ items }: { items: OverviewCard[] }) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c, i) => {
          // Показник щойно обрано зі списку, аналізів по ньому ще немає —
          // картка є, але замість значення запрошуємо внести перше.
          return (
            <motion.div
              key={c.biomarker.slug}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Link to={`/b/${c.biomarker.slug}`}>
                <Card className="p-5 transition-shadow hover:shadow-lg">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      {c.biomarker.category && (
                        <span className="truncate text-[11px] uppercase tracking-wide text-muted">{c.biomarker.category.name}</span>
                      )}
                      <h3 className="truncate font-medium">{c.biomarker.shortName ?? c.biomarker.name}</h3>
                    </div>
                    {c.latest && (
                      // max-w тримає бейдж у межах картки: підписи зон бувають
                      // довгі («ціль дуже високого ризику») і без обмеження
                      // виштовхували б назву показника.
                      <ZoneBadge
                        zone={c.latest.zone}
                        flag={c.latest.flag}
                        className="max-w-[9rem] shrink-0"
                      />
                    )}
                  </div>
                  {c.latest ? (
                    <>
                      <RetestNote retest={c.retest} />
                      <div className="mt-4 flex items-baseline gap-1.5">
                        <span className="tabnums font-display text-3xl font-bold">
                          {fmtNum(c.latest.value, c.biomarker.precision)}
                        </span>
                        <span className="text-sm text-muted">{c.latest.unit}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted">
                        <span>{fmtDate(c.latest.measuredAt)}</span>
                        {c.reference?.low != null && c.reference?.high != null && (
                          <span>{t('dashboard.reference', { low: c.reference.low, high: c.reference.high })}</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mt-4 flex items-baseline gap-1.5">
                        <span className="font-display text-3xl font-bold text-line">—</span>
                        <span className="text-sm text-muted">{c.biomarker.unit}</span>
                      </div>
                      <div className="mt-2 text-xs text-muted">{t('dashboard.noValues')}</div>
                    </>
                  )}
                </Card>
              </Link>
            </motion.div>
          );
        })}
    </div>
  );
}

/**
 * Підпис про перездачу.
 *
 * Тільки коли строк настав або минув: «ще 40 днів» — не те, заради чого варто
 * займати рядок на картці. Прострочене й «скоро» відрізняються словами, а не
 * лише кольором.
 */
function RetestNote({ retest }: { retest: Retest | null }) {
  const { t } = useTranslation();
  if (!retest || retest.status === 'OK') return null;

  const overdue = retest.status === 'OVERDUE';
  return (
    <p className={cn('mt-2 inline-flex items-center gap-1 text-xs', overdue ? 'text-alert' : 'text-caution')}>
      <CalendarClock size={12} className="shrink-0" aria-hidden />
      {overdue
        ? t('dashboard.retestOverdue', { count: Math.abs(retest.daysLeft) })
        : t('dashboard.retestDue', { count: retest.daysLeft })}
    </p>
  );
}
