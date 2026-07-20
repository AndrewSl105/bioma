import { describe, expect, it } from 'vitest';
import { allowedUnits, normalizeUnit } from './unit-conversions';
import { computeFlag } from './reference.util';

/**
 * Конверсії — найтихіший спосіб зіпсувати дані: значення збережеться,
 * прапорець порахується, і все виглядатиме правдоподібно. Тому тут не лише
 * «множення працює», а й межові випадки, на яких воно ламається мовчки.
 */
describe('normalizeUnit', () => {
  it('лишає канонічну одиницю недоторканою', () => {
    const r = normalizeUnit('vitamin-d', 80, 'нмоль/л', 'нмоль/л');
    expect(r.value).toBe(80);
    expect(r.converted).toBe(false);
    // Оригінал зберігається навіть без конверсії — інакше «як у бланку»
    // довелося б відновлювати зворотним рахунком.
    expect(r.enteredValue).toBe(80);
    expect(r.enteredUnit).toBe('нмоль/л');
  });

  it('переводить вітамін D нг/мл → нмоль/л', () => {
    const r = normalizeUnit('vitamin-d', 30, 'нг/мл', 'нмоль/л');
    expect(r.value).toBeCloseTo(74.88, 2);
    expect(r.converted).toBe(true);
    expect(r.enteredValue).toBe(30);
    expect(r.enteredUnit).toBe('нг/мл');
  });

  it('переводить глюкозу мг/дл → ммоль/л', () => {
    // 100 мг/дл — класичне «нормальний натще» у конвенційних одиницях.
    expect(normalizeUnit('glucose', 100, 'мг/дл', 'ммоль/л').value).toBeCloseTo(5.551, 3);
  });

  it('використовує РІЗНІ коефіцієнти для холестерину і тригліцеридів', () => {
    // Спільний коефіцієнт на всю ліпідограму — класична помилка: дає ~×2,3.
    const chol = normalizeUnit('total-cholesterol', 200, 'мг/дл', 'ммоль/л').value;
    const trig = normalizeUnit('triglycerides', 200, 'мг/дл', 'ммоль/л').value;
    expect(chol).toBeCloseTo(5.172, 3);
    expect(trig).toBeCloseTo(2.258, 3);
    expect(chol).not.toBeCloseTo(trig, 1);
  });

  it('НЕ конвертує невідому одиницю і чесно про це каже', () => {
    const r = normalizeUnit('vitamin-d', 30, 'мкг/л', 'нмоль/л');
    expect(r.converted).toBe(false);
    expect(r.value).toBe(30);
    // Вгадувати не можна: помилковий коефіцієнт зіпсував би тренд непомітно.
    expect(r.unit).toBe('мкг/л');
  });

  it('НЕ конвертує показник, якого немає в реєстрі', () => {
    const r = normalizeUnit('ferritin', 50, 'мг/дл', 'нг/мл');
    expect(r.converted).toBe(false);
    expect(r.value).toBe(50);
  });

  it('відмовляється конвертувати, якщо канон каталогу розійшовся з реєстром', () => {
    // Каталог змінили, реєстр — ні. Чесніше не рахувати, ніж перерахувати
    // не в ту одиницю.
    const r = normalizeUnit('vitamin-d', 30, 'нг/мл', 'нг/мл');
    expect(r.converted).toBe(false);
    expect(r.value).toBe(30);
  });

  it('не зважає на регістр і зайві пробіли в одиниці', () => {
    expect(normalizeUnit('vitamin-d', 30, '  НГ/МЛ ', 'нмоль/л').converted).toBe(true);
  });

  it('порожня одиниця вважається канонічною', () => {
    const r = normalizeUnit('vitamin-d', 80, undefined, 'нмоль/л');
    expect(r.value).toBe(80);
    expect(r.enteredUnit).toBe('нмоль/л');
  });
});

describe('прапорець рахується вже в каноні', () => {
  it('30 нг/мл вітаміну D — це недостатність, а не «вище норми»', () => {
    // Суть напряму: без конверсії 30 порівнялося б із межами 75–125 нмоль/л
    // і дало б LOW «випадково правильно», а от 300 мг/дл холестерину дало б
    // абсурд. Перевіряємо, що порівняння йде саме з перерахованим значенням.
    const range = { low: 75, high: 125 };
    const raw = normalizeUnit('vitamin-d', 30, 'нг/мл', 'нмоль/л');
    expect(computeFlag(raw.value, range)).toBe('LOW');

    // 40 нг/мл = 99,8 нмоль/л — усередині норми, хоча «40» саме по собі
    // виглядає як значення нижче 75.
    const ok = normalizeUnit('vitamin-d', 40, 'нг/мл', 'нмоль/л');
    expect(computeFlag(ok.value, range)).toBe('NORMAL');
    expect(computeFlag(40, range)).toBe('LOW'); // те, що було б без конверсії
  });
});

describe('allowedUnits', () => {
  it('канон іде першим, далі альтернативи', () => {
    expect(allowedUnits('vitamin-d', 'нмоль/л')).toEqual(['нмоль/л', 'нг/мл']);
  });

  it('показник без конверсій має лише свою одиницю', () => {
    expect(allowedUnits('ferritin', 'нг/мл')).toEqual(['нг/мл']);
  });
});
