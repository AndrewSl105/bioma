import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, CloudOff, Plus, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useOnline } from '@/lib/useOnline';
import { OFFLINE_HINT, formatSyncedAt } from '@/lib/offline';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { AddResultDialog } from '@/components/AddResultDialog';
import { AiUploadDialog } from '@/components/AiUploadDialog';
import { fmtDate, fmtNum, flagColor, flagLabel } from '@/lib/format';

export function DashboardPage() {
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
          <h1 className="font-display text-2xl font-bold tracking-tight">Мої показники</h1>
          <p className="text-sm text-muted">Динаміка аналізів і референсні межі в одному місці</p>
        </div>
        {/* на мобільному — кнопки на всю ширину в стовпчик (у ряд по 50%
            «Додати значення» не вміщається на 360px), на sm:+ — звичайний ряд */}
        {/* Offline запис вимкнено: у цій версії черги синхронізації немає,
            тож чесніше не пускати в діалог, ніж дати заповнити форму і
            впасти на відправці. Розпізнавання з фото — тим паче: воно
            виконується на сервері. */}
        <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto">
          <AiUploadDialog
            trigger={
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                disabled={!online}
                title={online ? undefined : OFFLINE_HINT}
              >
                <Camera size={17} /> З фото
              </Button>
            }
          />
          <AddResultDialog
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
      </div>

      {/* Offline показуємо вік даних: без цього збережені показники виглядають
          як щойно завантажені, а для аналізів це вводить в оману. */}
      {!online && syncedAt && (
        <p className="text-sm text-muted">Дані оновлено {syncedAt}</p>
      )}

      {isLoading && online && <p className="text-sm text-muted">Завантаження…</p>}

      {/* Offline і кеш порожній (перший запуск без мережі) — окремий стан,
          щоб не показувати «додайте перше значення», коли додати нічим. */}
      {!online && !cards && (
        <Card className="p-10 text-center">
          <CloudOff className="mx-auto mb-3 text-muted" />
          <p className="font-medium">Немає збережених даних</p>
          <p className="mt-1 text-sm text-muted">
            Підключіться до мережі, щоб завантажити ваші показники.
          </p>
        </Card>
      )}

      {!isLoading && cards?.length === 0 && (
        <Card className="p-10 text-center">
          <TrendingUp className="mx-auto mb-3 text-primary" />
          <p className="font-medium">Тут поки порожньо</p>
          <p className="mt-1 text-sm text-muted">
            Додайте перше значення вручну або сфотографуйте бланк аналізів.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards?.map((c, i) => {
          const fc = flagColor(c.latest.flag);
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
                    <Badge className={`${fc.bg} ${fc.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${fc.dot}`} />
                      {flagLabel[c.latest.flag]}
                    </Badge>
                  </div>
                  <div className="mt-4 flex items-baseline gap-1.5">
                    <span className="tabnums font-display text-3xl font-bold">
                      {fmtNum(c.latest.value, c.biomarker.precision)}
                    </span>
                    <span className="text-sm text-muted">{c.latest.unit}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted">
                    <span>{fmtDate(c.latest.measuredAt)}</span>
                    {c.reference?.low != null && c.reference?.high != null && (
                      <span>норма {c.reference.low}–{c.reference.high}</span>
                    )}
                  </div>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
