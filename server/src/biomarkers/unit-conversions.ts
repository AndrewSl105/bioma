/**
 * Нормалізація одиниць між лабораторіями.
 *
 * Різні лабораторії звітують той самий аналіт у різних одиницях (вітамін D у
 * нмоль/л чи нг/мл, глюкоза в ммоль/л чи мг/дл). Без приведення до спільної
 * одиниці графік показував би стрибок там, де змінилась лише лабораторія, а
 * прапорець порівнювався б із референсом в іншій системі числення.
 *
 * КАНОН — одиниця з catalog.ts. Саме в ній рахуються pickRange/computeFlag і
 * будується тренд. Введене значення разом із його одиницею зберігається окремо
 * (LabResult.enteredValue/enteredUnit), щоб оригінал бланка не загубився.
 *
 * ── Про коефіцієнти ──
 * Кожен — це «помнож значення в alt-одиниці, щоб дістати канонічну». Для
 * молярних переходів він виводиться з молярної маси, тож звірявся з таблицями
 * перерахунку, а не вигадувався. Джерела вказані на кожному аналіті.
 * Додаючи новий аналіт, ЗВІР коефіцієнт із таблицею — помилка тут тиха:
 * значення збережеться, прапорець порахується, і все виглядатиме правдоподібно.
 */

export type UnitAlternative = {
  unit: string;
  /** value_у_alt × toCanonical = value_у_каноні */
  toCanonical: number;
};

export type UnitConversion = {
  canonical: string;
  alt: UnitAlternative[];
};

/**
 * Реєстр за slug'ом біомаркера.
 *
 * Свідомо лише ті аналіти, де різнобій одиниць реальний і коефіцієнт
 * однозначний. Там, де перерахунок залежить від методики (напр. частина
 * гормонів), краще не мати конверсії взагалі, ніж мати оманливо точну.
 */
export const UNIT_CONVERSIONS: Record<string, UnitConversion> = {
  // 25-OH вітамін D, M = 400,64 г/моль. 1 нг/мл = 2,496 нмоль/л.
  'vitamin-d': {
    canonical: 'нмоль/л',
    alt: [{ unit: 'нг/мл', toCanonical: 2.496 }],
  },

  // Глюкоза, M = 180,16 г/моль. 1 мг/дл = 0,05551 ммоль/л.
  glucose: {
    canonical: 'ммоль/л',
    alt: [{ unit: 'мг/дл', toCanonical: 0.05551 }],
  },

  // Холестерин, M = 386,65 г/моль. 1 мг/дл = 0,02586 ммоль/л.
  // Той самий коефіцієнт для всіх холестеринових фракцій — це одна речовина.
  'total-cholesterol': { canonical: 'ммоль/л', alt: [{ unit: 'мг/дл', toCanonical: 0.02586 }] },
  ldl: { canonical: 'ммоль/л', alt: [{ unit: 'мг/дл', toCanonical: 0.02586 }] },
  hdl: { canonical: 'ммоль/л', alt: [{ unit: 'мг/дл', toCanonical: 0.02586 }] },
  'non-hdl': { canonical: 'ммоль/л', alt: [{ unit: 'мг/дл', toCanonical: 0.02586 }] },

  // Тригліцериди, M ≈ 885,4 г/моль. 1 мг/дл = 0,01129 ммоль/л.
  // Коефіцієнт ІНШИЙ, ніж у холестерину: це інша молекула, і брати спільний
  // для всієї ліпідограми — класична помилка, що дає ~×2,3 різниці.
  triglycerides: { canonical: 'ммоль/л', alt: [{ unit: 'мг/дл', toCanonical: 0.01129 }] },
};

/** Чи є значення в цій одиниці тим самим, що й канонічне. */
function sameUnit(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export type Normalized = {
  /** Значення в канонічній одиниці — його рахують прапорець і тренд. */
  value: number;
  unit: string;
  /** Що саме ввела людина. Дорівнює канонічному, якщо конверсії не було. */
  enteredValue: number;
  enteredUnit: string;
  converted: boolean;
};

/**
 * Приводить значення до канонічної одиниці показника.
 *
 * Невідома одиниця НЕ конвертується мовчки: ми повертаємо її як є і позначаємо
 * converted: false. Вгадувати тут не можна — помилковий коефіцієнт зіпсував би
 * і прапорець, і весь тренд, причому непомітно.
 *
 * @param slug      біомаркер (ключ реєстру)
 * @param canonical канонічна одиниця з каталогу — вона головніша за реєстр,
 *                  бо саме її бачить решта коду
 */
export function normalizeUnit(
  slug: string,
  value: number,
  unit: string | undefined,
  canonical: string,
): Normalized {
  const entered = unit?.trim() || canonical;

  // Одиниця вже канонічна — переводити нема чого.
  if (sameUnit(entered, canonical)) {
    return { value, unit: canonical, enteredValue: value, enteredUnit: entered, converted: false };
  }

  const conv = UNIT_CONVERSIONS[slug];
  const alt = conv?.alt.find((a) => sameUnit(a.unit, entered));

  // Реєстр знає альтернативу, і його канон збігається з каталожним.
  // Розбіжність означала б, що каталог змінили, а реєстр — ні; у такому разі
  // чесніше нічого не конвертувати, ніж перерахувати не в ту одиницю.
  if (alt && conv && sameUnit(conv.canonical, canonical)) {
    return {
      value: value * alt.toCanonical,
      unit: canonical,
      enteredValue: value,
      enteredUnit: entered,
      converted: true,
    };
  }

  return { value, unit: entered, enteredValue: value, enteredUnit: entered, converted: false };
}

/** Одиниці, які можна обрати у формі введення для цього показника. */
export function allowedUnits(slug: string, canonical: string): string[] {
  const conv = UNIT_CONVERSIONS[slug];
  if (!conv || !sameUnit(conv.canonical, canonical)) return [canonical];
  return [canonical, ...conv.alt.map((a) => a.unit)];
}
