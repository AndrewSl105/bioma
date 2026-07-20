import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowRight, ArrowUp, Minus } from 'lucide-react';
import { api, type CompareSide } from '@/lib/api';
import { Card } from '@/components/ui/primitives';
import { fmtDate, fmtNum } from '@/lib/format';
import { zoneColor } from '@/lib/zones';

/**
 * Порівняння двох заборів пліч-о-пліч.
 *
 * Стрілка + знак числа несуть зміну самі по собі, колір лише підсилює — за
 * дальтонізму й у ч/б таблиця має читатись так само. І окремо: стрілка вгору
 * НЕ означає «погано». Для ЛПВЩ зростання бажане, для ЛПНЩ — ні, а знати це
 * з самого числа неможливо, тож напрямок ми показуємо нейтрально, а оцінку
 * лишаємо зоні.
 */
export function PanelCompare({ a, b }: { a: string; b: string }) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['panels', 'compare', a, b],
    queryFn: () => api.comparePanels(a, b),
  });

  if (isLoading) return <p className="text-sm text-muted">{t('app.loading')}</p>;
  if (isError || !data) return <p className="text-sm text-muted">{t('panels.compareError')}</p>;

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line px-4 py-3 text-sm font-medium sm:px-5">
        {t('panels.compareTitle', { a: fmtDate(data.a.takenAt), b: fmtDate(data.b.takenAt) })}
      </div>

      {/* Таблиця широка — прокручується всередині картки, а не розсуває
          сторінку: горизонтальний скрол усього екрана на телефоні і є тим,
          що робить такі таблиці непридатними. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="px-4 py-2 font-medium sm:px-5">{t('panels.colBiomarker')}</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{fmtDate(data.a.takenAt)}</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{fmtDate(data.b.takenAt)}</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{t('panels.colDelta')}</th>
              <th scope="col" className="px-4 py-2 font-medium sm:px-5">{t('panels.colZone')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.rows.map((r) => (
              <tr key={r.biomarker.slug}>
                <th scope="row" className="px-4 py-2.5 text-left font-normal sm:px-5">
                  <span className="block">{r.biomarker.shortName ?? r.biomarker.name}</span>
                  <span className="block text-xs text-muted">{r.biomarker.unit}</span>
                </th>
                <Value side={r.a} precision={r.biomarker.precision} />
                <Value side={r.b} precision={r.biomarker.precision} />
                <td className="tabnums whitespace-nowrap px-3 py-2.5 text-right">
                  <Delta delta={r.delta} precision={r.biomarker.precision} />
                </td>
                <td className="px-4 py-2.5 sm:px-5">
                  <ZoneChange from={r.a} to={r.b} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** Значення однієї сторони; «—» означає, що показник у цьому заборі не здавали. */
function Value({ side, precision }: { side: CompareSide | null; precision: number }) {
  if (!side) return <td className="px-3 py-2.5 text-right text-muted">—</td>;
  const c = side.zone ? zoneColor(side.zone.level) : null;
  return (
    <td className="tabnums whitespace-nowrap px-3 py-2.5 text-right">
      <span className={c ? c.text : undefined}>{fmtNum(side.value, precision)}</span>
    </td>
  );
}

function Delta({ delta, precision }: { delta: number | null; precision: number }) {
  const { t } = useTranslation();
  if (delta == null) return <span className="text-muted">—</span>;
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-muted">
        <Minus size={13} aria-hidden /> {t('panels.noChange')}
      </span>
    );
  }
  const up = delta > 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span className="inline-flex items-center gap-1">
      <Icon size={13} aria-hidden className="shrink-0" />
      {up ? '+' : ''}
      {fmtNum(delta, precision)}
    </span>
  );
}

/** Перехід зони між заборами — «було → стало». */
function ZoneChange({ from, to }: { from: CompareSide | null; to: CompareSide | null }) {
  const { t } = useTranslation();
  const fz = from?.zone ?? null;
  const tz = to?.zone ?? null;

  if (!tz && !fz) {
    // Зон немає в жодній стороні — падаємо на прапорець, як і решта UI.
    const flag = to?.flag ?? from?.flag;
    return <span className="text-xs text-muted">{flag ? t(`flag.${flag}`) : '—'}</span>;
  }
  const same = fz && tz && fz.level === tz.level;
  if (same) {
    return <span className={`text-xs ${zoneColor(tz!.level).text}`}>{tz!.label}</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-xs">
      {fz && <span className={zoneColor(fz.level).text}>{fz.label}</span>}
      {fz && tz && <ArrowRight size={11} aria-hidden className="shrink-0 text-muted" />}
      {tz && <span className={`font-medium ${zoneColor(tz.level).text}`}>{tz.label}</span>}
    </span>
  );
}
