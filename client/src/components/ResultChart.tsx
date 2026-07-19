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
import type { History } from '@/lib/api';
import { fmtDate, fmtNum } from '@/lib/format';

/**
 * Графік динаміки показника з підсвіченою зоною референсу.
 * Точки поза нормою — акцентним кольором.
 */
export function ResultChart({ history }: { history: History }) {
  const { series, reference, biomarker } = history;
  const data = series.map((p) => ({
    date: fmtDate(p.measuredAt),
    value: p.value,
    flag: p.flag,
    ts: new Date(p.measuredAt).getTime(),
  }));

  const values = series.map((s) => s.value);
  const refLow = reference?.low ?? undefined;
  const refHigh = reference?.high ?? undefined;
  const min = Math.min(...values, refLow ?? Infinity);
  const max = Math.max(...values, refHigh ?? -Infinity);
  const pad = (max - min || 1) * 0.15;

  return (
    <div className="h-[220px] w-full min-w-0 sm:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0E7C86" stopOpacity={0.14} />
              <stop offset="100%" stopColor="#0E7C86" stopOpacity={0} />
            </linearGradient>
          </defs>

          {refLow != null && refHigh != null && (
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
            domain={[Math.floor(min - pad), Math.ceil(max + pad)]}
            tick={{ fontSize: 11, fill: '#6B7180' }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #E7E8EC', fontSize: 12 }}
            formatter={(v: number) => [`${fmtNum(v, biomarker.precision)} ${biomarker.unit}`, 'Значення']}
          />
          <Area type="monotone" dataKey="value" stroke="none" fill="url(#fill)" />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#0E7C86"
            strokeWidth={2}
            dot={(props: any) => {
              const out = props.payload.flag === 'HIGH' || props.payload.flag === 'LOW';
              return (
                <Dot
                  key={props.key}
                  cx={props.cx}
                  cy={props.cy}
                  r={4}
                  fill={out ? '#B45309' : '#0E7C86'}
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
  );
}
