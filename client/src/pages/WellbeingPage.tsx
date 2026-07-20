import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, CloudOff } from 'lucide-react';
import { api, type WellbeingEntry } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useOnline } from '@/lib/useOnline';
import { offlineHint } from '@/lib/offline';
import { Button, Card } from '@/components/ui/primitives';
import { MarkDaySheet, SCALES } from '@/components/MarkDaySheet';
import { fmtDate, fmtNum } from '@/lib/format';
import { cn } from '@/lib/cn';

/** Останні 30 днів — вікно, у якому тренд ще читається на телефоні. */
function rangeDates() {
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 86_400_000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

const isoToday = () => new Date().toISOString().slice(0, 10);

/**
 * Самопочуття: огляд трендів + одна головна дія «Відмітити день».
 *
 * Сторінка навмисне НЕ є формою. Чек-ін — разова дія на день, і тримати його
 * розгорнутим означало б віддати форму весь екран тому, хто вже відмітився і
 * прийшов подивитись динаміку.
 *
 * Нічого не трактуємо: показуємо назад те, що людина сама відзначила. Поруч у
 * часі ще не означає «через».
 */
export function WellbeingPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const online = useOnline();
  const { from, to } = rangeDates();

  const { data: history, isLoading } = useQuery({
    queryKey: ['wellbeing', 'range', from, to],
    queryFn: () => api.wellbeingRange(from, to),
    enabled: !!user,
  });

  const todayMarked = history?.some((e) => e.date.slice(0, 10) === isoToday());

  if (!history && !online) {
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
        <h1 className="font-display text-2xl font-bold tracking-tight">{t('wellbeing.title')}</h1>
        <p className="text-sm text-muted">{t('wellbeing.subtitle')}</p>
      </div>

      {/* Головна дія екрана — на всю ширину і високою ціллю: на телефоні саме
          вона має бути тим, у що влучаєш не цілячись. */}
      <MarkDaySheet
        trigger={
          <Button
            className="h-14 w-full text-base"
            disabled={!online}
            title={online ? undefined : offlineHint()}
          >
            <CalendarPlus size={19} />
            {todayMarked ? t('wellbeing.markDayAgain') : t('wellbeing.markDay')}
          </Button>
        }
      />

      {isLoading && online && <p className="text-sm text-muted">{t('app.loading')}</p>}

      {history?.length === 0 && (
        <Card className="p-10 text-center">
          <p className="font-medium">{t('wellbeing.emptyTitle')}</p>
          <p className="mt-1 text-sm text-muted">{t('wellbeing.emptyHint')}</p>
        </Card>
      )}

      {!!history?.length && <Trends entries={history} />}
    </div>
  );
}

/** Тренди по кожній шкалі — ряд стовпчиків за днями, без інтерпретацій. */
function Trends({ entries }: { entries: WellbeingEntry[] }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium">{t('wellbeing.history')}</h2>

      {SCALES.map((key) => {
        const points = entries.filter((e) => e[key] != null);
        if (!points.length) return null;
        const avg = points.reduce((s, e) => s + (e[key] as number), 0) / points.length;
        return (
          <Card key={key} className="p-4 sm:p-5">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium">{t(`wellbeing.scale.${key}`)}</p>
              <p className="text-xs text-muted">
                {t('wellbeing.average', { value: fmtNum(avg, 1) })}
              </p>
            </div>
            <Bars entries={entries} pick={(e) => e[key] as number | null} max={5} />
          </Card>
        );
      })}

      {entries.some((e) => e.sleepHours != null) && (
        <Card className="p-4 sm:p-5">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium">{t('wellbeing.sleepHours')}</p>
            <p className="text-xs text-muted">
              {t('wellbeing.average', {
                value: fmtNum(
                  entries.filter((e) => e.sleepHours != null).reduce((s, e) => s + e.sleepHours!, 0) /
                    entries.filter((e) => e.sleepHours != null).length,
                  1,
                ),
              })}
            </p>
          </div>
          {/* Години сну — не шкала 1..5, тож і масштаб інший: 12 годин як
              стеля, інакше сон завжди впирався б у верх стовпчика. */}
          <Bars entries={entries} pick={(e) => e.sleepHours} max={12} />
        </Card>
      )}

      <p className="text-xs text-muted">{t('wellbeing.historyHint')}</p>
    </div>
  );
}

function Bars({
  entries,
  pick,
  max,
}: {
  entries: WellbeingEntry[];
  pick: (e: WellbeingEntry) => number | null;
  max: number;
}) {
  return (
    <div className="flex items-end gap-1 overflow-x-auto">
      {entries.map((e) => {
        const v = pick(e);
        return (
          <div
            key={e.date}
            // title, а не підпис під кожним: тридцять дат під стовпчиками не
            // вміщаються, але дата й значення мають лишатись доступними.
            title={`${fmtDate(e.date)}: ${v ?? '—'}`}
            className="flex h-16 w-3 shrink-0 items-end"
          >
            <div
              className={cn('w-full rounded-sm', v != null ? 'bg-primary' : 'bg-line')}
              style={{ height: v != null ? `${Math.min(v / max, 1) * 100}%` : '4px' }}
            />
          </div>
        );
      })}
    </div>
  );
}
