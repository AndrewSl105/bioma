import {
  Area,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Dot,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import type { History } from '@/lib/api';
import { fmtDate, fmtNum } from '@/lib/format';
import type { Band } from '@/lib/api';
import { zoneFill } from '@/lib/zones';

/**
 * Межі смуги для легенди. Знак «<» на верхній межі не випадковий: смуга — це
 * інтервал [min, max), і значення рівно max належить уже наступній смузі.
 */
function bandRange(b: Band): string {
  if (b.min != null && b.max != null) return `${b.min}–${b.max}`;
  if (b.min != null) return `≥ ${b.min}`;
  return `< ${b.max}`;
}

/**
 * Графік динаміки показника з підсвіченими зонами інтерпретації.
 *
 * Якщо у показника задані смуги (bands) — малюємо саме їх: людині важливо
 * бачити не лише «вийшов за норму», а й наскільки близько до оптимуму значення
 * тримається. Смуг немає (частина показників їх не має) — відкочуємось на одну
 * зону референсу, як було.
 */
export function ResultChart({ history }: { history: History }) {
  const { t } = useTranslation();
  // bands із дефолтом: buster збірки прибирає несумісний persist-кеш, але
  // покладатися лише на нього — це та сама поломка, що вже була на застарілому
  // кеші. Відсутнє поле має давати графік без смуг, а не білий екран.
  const { series, reference, biomarker, bands = [] } = history;
  const data = series.map((p) => ({
    date: fmtDate(p.measuredAt),
    value: p.value,
    flag: p.flag,
    zone: p.zone,
    ts: new Date(p.measuredAt).getTime(),
  }));

  const values = series.map((s) => s.value);
  const refLow = reference?.low ?? undefined;
  const refHigh = reference?.high ?? undefined;
  const min = Math.min(...values, refLow ?? Infinity);
  const max = Math.max(...values, refHigh ?? -Infinity);
  const pad = (max - min || 1) * 0.15;

  // Межі осі рахуємо до того, як обрізати смуги: крайні смуги відкриті
  // (у найвищої немає max), і без явних меж ReferenceArea нічого не намалює.
  const axisMin = Math.floor(min - pad);
  const axisMax = Math.ceil(max + pad);

  // Смуги, які реально видно на осі — легенда не має перелічувати те, чого на
  // графіку немає.
  const visibleBands = bands.filter(
    (b) => (b.max ?? axisMax) > axisMin && (b.min ?? axisMin) < axisMax,
  );

  return (
    <>
    <div className="h-[220px] w-full min-w-0 sm:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0E7C86" stopOpacity={0.14} />
              <stop offset="100%" stopColor="#0E7C86" stopOpacity={0} />
            </linearGradient>
          </defs>

          {bands.length > 0
            ? bands.map((b, i) => {
                // Відкриті краї підтягуємо до меж осі, інакше найнижча й
                // найвища смуги (у них є лише одна межа) не намалювались би.
                const y1 = b.min ?? axisMin;
                const y2 = b.max ?? axisMax;
                if (y2 <= axisMin || y1 >= axisMax) return null; // смуга поза видимою частиною
                return (
                  <ReferenceArea
                    key={`${b.level}-${i}`}
                    y1={Math.max(y1, axisMin)}
                    y2={Math.min(y2, axisMax)}
                    fill={zoneFill(b.level)}
                    // Заливка навмисне бліда: смуги — це тло для лінії, а не
                    // самостійний шар. Насиченіше — і графік не прочитати.
                    fillOpacity={0.08}
                    stroke="none"
                  />
                );
              })
            : refLow != null &&
              refHigh != null && (
                <ReferenceArea
                  y1={refLow}
                  y2={refHigh}
                  fill="#12805C"
                  fillOpacity={0.06}
                  stroke="#12805C"
                  strokeOpacity={0.18}
                  strokeDasharray="4 4"
                />
              )}

          {/* minTickGap + preserveStartEnd — щоб підписи дат не зливались на 360px */}
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#6B7180' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            domain={[axisMin, axisMax]}
            tick={{ fontSize: 11, fill: '#6B7180' }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #E7E8EC', fontSize: 12 }}
            // Підпис у підказці був зашитий українською — тепер зі словника,
            // як решта інтерфейсу. Зона дописується до значення: сама лише
            // цифра не каже, у яку смугу графіка точка потрапила.
            formatter={(v: number, _name: string, item: any) => {
              const zone = item?.payload?.zone;
              const text = `${fmtNum(v, biomarker.precision)} ${biomarker.unit}`;
              return [zone ? `${text} · ${zone.label}` : text, t('biomarker.chartValue')];
            }}
          />
          <Area type="monotone" dataKey="value" stroke="none" fill="url(#fill)" />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#0E7C86"
            strokeWidth={2}
            dot={(props: any) => {
              // Колір точки — від зони, коли вона відома: інакше на графіку зі
              // смугами точка «в нормі, але далеко від оптимуму» виглядала б
              // так само, як точка в оптимумі.
              const { zone, flag } = props.payload;
              const out = flag === 'HIGH' || flag === 'LOW';
              return (
                <Dot
                  key={props.key}
                  cx={props.cx}
                  cy={props.cy}
                  r={4}
                  fill={zone ? zoneFill(zone.level) : out ? '#B45309' : '#0E7C86'}
                  stroke="#fff"
                  strokeWidth={2}
                />
              );
            }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>

    {/* Легенда обов'язкова, а не прикраса: без підписів смуги на графіку
        передають сенс самим лише кольором, а це не читається ні при
        дальтонізмі, ні в ч/б. Підпис зони тут авторський, із каталогу. */}
    {visibleBands.length > 0 && (
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
        {visibleBands.map((b, i) => (
          <li key={`${b.level}-${i}`} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ backgroundColor: zoneFill(b.level), opacity: 0.55 }}
            />
            <span>{b.label}</span>
            <span className="tabnums text-muted/70">{bandRange(b)}</span>
          </li>
        ))}
      </ul>
    )}
    </>
  );
}
