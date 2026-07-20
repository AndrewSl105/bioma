import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, CloudOff, ListPlus, Plus, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useOnline } from '@/lib/useOnline';
import { offlineHint, formatSyncedAt } from '@/lib/offline';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { AddResultDialog } from '@/components/AddResultDialog';
import { AddBiomarkerDialog } from '@/components/AddBiomarkerDialog';
import { AiUploadDialog } from '@/components/AiUploadDialog';
import { fmtDate, fmtNum, flagColor } from '@/lib/format';

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards?.map((c, i) => {
          // Показник щойно обрано зі списку, аналізів по ньому ще немає —
          // картка є, але замість значення запрошуємо внести перше.
          const fc = c.latest ? flagColor(c.latest.flag) : null;
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
                    {c.latest && fc && (
                      <Badge className={`${fc.bg} ${fc.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${fc.dot}`} />
                        {t(`flag.${c.latest.flag}`)}
                      </Badge>
                    )}
                  </div>
                  {c.latest ? (
                    <>
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
    </div>
  );
}
