import type { Band } from '../biomarkers/bands';
import type { BodyMetricKind } from '../generated/prisma/enums';
import type { Sex } from '../generated/prisma/enums';

/**
 * Довідник тілесних метрик.
 *
 * У коді, а не в БД: на відміну від каталогу біомаркерів, ці п'ять метрик не
 * заводить адміністратор — вони зашиті в самі екрани (композитний віджет
 * тиску, похідний ІМТ). Тримати їх рядками в базі означало б редаговану
 * таблицю, від значень якої залежить логіка UI.
 *
 * ВАЖЛИВО: пороги — освітній орієнтир, не діагноз. Джерела вказані на кожній
 * шкалі; там, де рекомендації оновлювались, зазначено саме ту редакцію, за
 * якою взяті числа.
 */

export type BodyMetricDef = {
  kind: BodyMetricKind;
  /** Мовно-незалежний ключ; підпис бере клієнт зі словника. */
  key: string;
  unit: string;
  precision: number;
  /** Межі введення — захист від друкарських помилок, не медичний критерій. */
  min: number;
  max: number;
  /** Смуги можуть залежати від статі (обхват талії), тому це функція. */
  bands?: (sex: Sex | null | undefined) => Band[];
};

/**
 * Обхват талії — пороги ВООЗ: підвищений ризик від 94 см (чол.) / 80 см (жін.),
 * значно підвищений від 102 / 88 см.
 *
 * Пороги виведені переважно на європейських популяціях; етнічні особливості
 * розподілу жиру на них впливають, тож для не-європейських популяцій
 * рекомендації різняться. Для загального орієнтира цього досить, але це саме
 * орієнтир.
 */
const waistBands = (sex: Sex | null | undefined): Band[] => {
  // Стать невідома — смуг не показуємо взагалі. Взяти «чоловічі за
  // замовчуванням» означало б тихо назвати жіночу норму підвищеним ризиком.
  if (sex !== 'MALE' && sex !== 'FEMALE') return [];
  const [increased, high] = sex === 'MALE' ? [94, 102] : [80, 88];
  return [
    { level: 'OPTIMAL', label: 'у межах орієнтира', labels: { en: 'within guidance' }, max: increased },
    { level: 'ABOVE_OPTIMAL', label: 'підвищений ризик', labels: { en: 'increased risk' }, min: increased, max: high },
    { level: 'HIGH', label: 'значно підвищений ризик', labels: { en: 'substantially increased risk' }, min: high },
  ];
};

/** Пульс у спокої — загальноприйнятий орієнтир 60–100 уд/хв для дорослих. */
const restingHrBands = (): Band[] => [
  { level: 'LOW', label: 'нижче звичного діапазону', labels: { en: 'below usual range' }, max: 60 },
  { level: 'OPTIMAL', label: 'звичний діапазон', labels: { en: 'usual range' }, min: 60, max: 100 },
  { level: 'HIGH', label: 'вище звичного діапазону', labels: { en: 'above usual range' }, min: 100 },
];

/**
 * Тиск — категорії ESC/ESH 2018 (офісний вимір). Систола й діастола мають
 * власні смуги, бо зберігаються окремо; підсумкова категорія пари рахується
 * в bloodPressureCategory() за правилом «береться вища».
 *
 * Свідомо саме редакція 2018: у 2024-му ESC змінив підхід (нижчий поріг
 * діастоли, окрема категорія «підвищений»), і змішувати редакції в одній
 * шкалі означало б пороги, яких немає в жодній.
 */
const systolicBands = (): Band[] => [
  { level: 'OPTIMAL', label: 'оптимальний', labels: { en: 'optimal' }, max: 120 },
  { level: 'NORMAL', label: 'нормальний', labels: { en: 'normal' }, min: 120, max: 130 },
  { level: 'ABOVE_OPTIMAL', label: 'високий нормальний', labels: { en: 'high normal' }, min: 130, max: 140 },
  { level: 'HIGH', label: 'гіпертензія 1 ступеня', labels: { en: 'grade 1 hypertension' }, min: 140, max: 160 },
  { level: 'VERY_HIGH', label: 'гіпертензія 2 ступеня', labels: { en: 'grade 2 hypertension' }, min: 160, max: 180 },
  { level: 'CRITICAL', label: 'гіпертензія 3 ступеня', labels: { en: 'grade 3 hypertension' }, min: 180 },
];

const diastolicBands = (): Band[] => [
  { level: 'OPTIMAL', label: 'оптимальний', labels: { en: 'optimal' }, max: 80 },
  { level: 'NORMAL', label: 'нормальний', labels: { en: 'normal' }, min: 80, max: 85 },
  { level: 'ABOVE_OPTIMAL', label: 'високий нормальний', labels: { en: 'high normal' }, min: 85, max: 90 },
  { level: 'HIGH', label: 'гіпертензія 1 ступеня', labels: { en: 'grade 1 hypertension' }, min: 90, max: 100 },
  { level: 'VERY_HIGH', label: 'гіпертензія 2 ступеня', labels: { en: 'grade 2 hypertension' }, min: 100, max: 110 },
  { level: 'CRITICAL', label: 'гіпертензія 3 ступеня', labels: { en: 'grade 3 hypertension' }, min: 110 },
];

export const BODY_METRICS: Record<BodyMetricKind, BodyMetricDef> = {
  WEIGHT: { kind: 'WEIGHT', key: 'weight', unit: 'кг', precision: 1, min: 20, max: 400 },
  WAIST: { kind: 'WAIST', key: 'waist', unit: 'см', precision: 0, min: 30, max: 250, bands: waistBands },
  RESTING_HR: {
    kind: 'RESTING_HR', key: 'resting-hr', unit: 'уд/хв', precision: 0, min: 25, max: 220,
    bands: restingHrBands,
  },
  BP_SYSTOLIC: {
    kind: 'BP_SYSTOLIC', key: 'bp-systolic', unit: 'мм рт. ст.', precision: 0, min: 50, max: 300,
    bands: systolicBands,
  },
  BP_DIASTOLIC: {
    kind: 'BP_DIASTOLIC', key: 'bp-diastolic', unit: 'мм рт. ст.', precision: 0, min: 30, max: 200,
    bands: diastolicBands,
  },
};

/** Похідний ІМТ, категорії ВООЗ. Не зберігається — рахується з ваги і зросту. */
export const BMI_BANDS: Band[] = [
  { level: 'LOW', label: 'недостатня вага', labels: { en: 'underweight' }, max: 18.5 },
  { level: 'OPTIMAL', label: 'норма', labels: { en: 'normal' }, min: 18.5, max: 25 },
  { level: 'ABOVE_OPTIMAL', label: 'надмірна вага', labels: { en: 'overweight' }, min: 25, max: 30 },
  { level: 'HIGH', label: 'ожиріння', labels: { en: 'obesity' }, min: 30 },
];

export const BMI_DEF = { key: 'bmi', unit: 'кг/м²', precision: 1 };

/** Дві метрики тиску — щоб UI знав, що їх треба вводити й показувати разом. */
export const BP_KINDS: BodyMetricKind[] = ['BP_SYSTOLIC', 'BP_DIASTOLIC'];
