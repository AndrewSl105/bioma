import { describe, expect, it } from 'vitest';
import { buildMatcher, norm } from './match-biomarker';

const CATALOG = [
  { slug: 'tsh', loincCode: '11579-0', names: ['Thyroid Stimulating Hormone', 'Тиреотропний гормон (ТТГ)'], shorts: ['TSH', 'ТТГ'] },
  { slug: 'triglycerides', loincCode: '2571-8', names: ['Triglycerides', 'Тригліцериди'], shorts: ['TG', 'ТГ'] },
  { slug: 'glucose', loincCode: '2345-7', names: ['Glucose', 'Глюкоза'], shorts: [null, null] },
  { slug: 'vitamin-d', loincCode: '35059-2', names: ['25-Hydroxyvitamin D', '25-гідроксивітамін D'], shorts: ['Vit D', 'Вітамін D'] },
];
const match = buildMatcher(CATALOG);

describe('точні збіги', () => {
  it('за локалізованою назвою', () => {
    expect(match('Глюкоза')?.target.slug).toBe('glucose');
    expect(match('Глюкоза')?.confidence).toBe('exact');
  });
  it('за англійським каноном', () => {
    expect(match('Glucose')?.target.slug).toBe('glucose');
  });
  it('за короткою назвою — навіть коротшою за поріг fuzzy', () => {
    // «ТТГ» це 3 символи: обмеження стосується лише підрядкового пошуку.
    expect(match('ТТГ')?.target.slug).toBe('tsh');
    expect(match('ТТГ')?.confidence).toBe('exact');
  });
  it('за LOINC, навіть коли назва незнайома', () => {
    expect(match('Що завгодно', '2345-7')?.target.slug).toBe('glucose');
  });
  it('збігається, коли в бланку немає абревіатури з дужок', () => {
    // Каталог: «Тиреотропний гормон (ТТГ)», бланк: «Тиреотропний гормон».
    expect(match('Тиреотропний гормон')?.target.slug).toBe('tsh');
    expect(match('Тиреотропний гормон')?.confidence).toBe('exact');
  });

  it('і навпаки — коли абревіатура є, а в каталозі назва без неї', () => {
    expect(match('Глюкоза (натще)')?.target.slug).toBe('glucose');
  });

  it('не зважає на регістр і розділові знаки', () => {
    expect(match('  тиреотропний   ГОРМОН (ТТГ) ')?.target.slug).toBe('tsh');
  });
});

describe('підрядковий збіг обмежений', () => {
  it('НЕ плутає ТТГ із тригліцеридами', () => {
    // Саме це й траплялось: «ТГ» (2 символи) знаходилось усередині «ТТГ»,
    // і ТТГ впевнено лягав у тригліцериди.
    const r = match('ТТГ сироватки');
    expect(r?.target.slug).not.toBe('triglycerides');
  });

  it('довгу назву всередині рядка знаходить і позначає як неточну', () => {
    const r = match('Аналіз: Тригліцериди натще');
    expect(r?.target.slug).toBe('triglycerides');
    expect(r?.confidence).toBe('fuzzy');
  });

  it('невідомий рядок не мапиться нікуди', () => {
    expect(match('Невідомий показник XYZ')).toBeNull();
  });
});

describe('norm', () => {
  it('прибирає все, крім літер і цифр, зберігаючи кирилицю', () => {
    expect(norm('25-гідроксивітамін D')).toBe('25гідроксивітамінd');
  });
});
