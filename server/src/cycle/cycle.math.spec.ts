import { describe, expect, it } from 'vitest';
import {
  computeStats, estimateFertileWindow, findPeriodStarts, phaseOn, predictNextPeriod,
  DEFAULT_CYCLE_LENGTH,
} from './cycle.math';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
/** Менструація з `start` протягом `len` днів. */
const period = (start: string, len = 5) =>
  Array.from({ length: len }, (_, i) => ({
    date: new Date(d(start).getTime() + i * 86_400_000),
    isPeriod: true,
  }));

describe('початки менструацій', () => {
  it('серія поспіль дає ОДИН початок', () => {
    expect(findPeriodStarts(period('2026-01-01', 5))).toHaveLength(1);
  });

  it('два початки в одному календарному місяці — нормально', () => {
    // Цикл не збігається з місяцем; «перший у місяці» був би хибним правилом.
    const days = [...period('2026-01-02', 4), ...period('2026-01-30', 4)];
    expect(findPeriodStarts(days)).toHaveLength(2);
  });
});

describe('середні беруться з історії, а не з 28', () => {
  it('рахує довжину циклу з власних даних', () => {
    // Початки з кроком 30 днів.
    const days = [...period('2026-01-01'), ...period('2026-01-31'), ...period('2026-03-02')];
    const s = computeStats(days);
    expect(s.cycleLengths).toEqual([30, 30]);
    expect(s.estimatedCycleLength).toBe(30);
    expect(s.usingDefaults).toBe(false);
  });

  it('без історії чесно позначає, що це дефолт', () => {
    const s = computeStats(period('2026-01-01'));
    expect(s.estimatedCycleLength).toBe(DEFAULT_CYCLE_LENGTH);
    expect(s.usingDefaults).toBe(true);
  });

  it('пропущений місяць відміток не розтягує середнє', () => {
    // 30, потім «діра» 120 днів, потім знову 30 — аномалію відкидаємо.
    const days = [
      ...period('2026-01-01'), ...period('2026-01-31'),
      ...period('2026-05-31'), ...period('2026-06-30'),
    ];
    const s = computeStats(days);
    expect(s.cycleLengths).toEqual([30, 30]);
    expect(s.estimatedCycleLength).toBe(30);
  });

  it('ручне уточнення перекриває розрахунок', () => {
    const days = [...period('2026-01-01'), ...period('2026-01-31')];
    expect(computeStats(days, { avgCycleLength: 26 }).estimatedCycleLength).toBe(26);
  });
});

describe('фаза й день циклу', () => {
  const days = [...period('2026-01-01', 5), ...period('2026-01-29', 5)];
  const stats = computeStats(days); // цикл 28

  it('перший день менструації — це день 1', () => {
    expect(phaseOn(d('2026-01-29'), stats)).toEqual({ phase: 'MENSTRUAL', dayOfCycle: 1 });
  });
  it('після менструації — фолікулярна', () => {
    expect(phaseOn(d('2026-02-05'), stats)?.phase).toBe('FOLLICULAR');
  });
  it('близько дня (довжина − 14) — овуляція', () => {
    // 28 − 14 = 14-й день циклу → 2026-02-11.
    expect(phaseOn(d('2026-02-11'), stats)?.phase).toBe('OVULATION');
  });
  it('після овуляції — лютеїнова', () => {
    expect(phaseOn(d('2026-02-20'), stats)?.phase).toBe('LUTEAL');
  });
  it('без жодної відмітки фазу не вигадуємо', () => {
    expect(phaseOn(d('2026-02-20'), computeStats([]))).toBeNull();
  });
  it('надто давні відмітки не дають стверджувати фазу', () => {
    expect(phaseOn(d('2027-06-01'), stats)).toBeNull();
  });
});

describe('прогнози', () => {
  const stats = computeStats([...period('2026-01-01'), ...period('2026-01-29')]);

  it('наступна менструація = останній початок + довжина циклу', () => {
    expect(predictNextPeriod(stats)?.toISOString().slice(0, 10)).toBe('2026-02-26');
  });

  it('фертильне вікно — діапазон навколо оцінки овуляції', () => {
    const w = estimateFertileWindow(stats)!;
    // Овуляція ≈ 14-й день циклу від 29.01 → 11.02; вікно -5/+1.
    expect(w.from.toISOString().slice(0, 10)).toBe('2026-02-06');
    expect(w.to.toISOString().slice(0, 10)).toBe('2026-02-12');
  });

  it('без історії прогнозів немає', () => {
    expect(predictNextPeriod(computeStats([]))).toBeNull();
    expect(estimateFertileWindow(computeStats([]))).toBeNull();
  });
});
