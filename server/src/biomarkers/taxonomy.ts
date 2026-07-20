/**
 * Канонічна таксономія систем організму та функціональних зв'язків.
 *
 * Тут лише КЛЮЧІ — мовно-незалежні й стабільні. Назви та іконки живуть на
 * клієнті (словники i18n + мапа іконок): сервер не має знати, як це малюється,
 * а клієнт не має вигадувати, які ключі допустимі.
 *
 * Список дублюється в client/src/lib/taxonomy.ts. Дублювання свідоме: пакет,
 * спільний для двох застосунків, коштував би дорожче за два коротких масиви,
 * а розходження ловиться валідацією — невідомий ключ просто не пройде DTO.
 */

export const BODY_SYSTEM_KEYS = [
  'endocrine',
  'immune',
  'cardiovascular',
  'metabolic',
  'nervous',
  'skeletal',
  'hematologic',
  'hepatic',
  'renal',
  'digestive',
  'respiratory',
  'reproductive',
  'muscular',
] as const;

export const FUNCTIONAL_TAG_KEYS = [
  'energy',
  'sleep',
  'endurance',
  'metabolism',
  'mood',
  'cognition',
  'immunity',
  'bone',
] as const;

/**
 * Класи препаратів і добавок, що можуть впливати на лабораторні показники.
 *
 * Це НЕ довідник ліків і не перелік призначень: тут лише ті класи, вплив яких
 * на результати аналізів описаний у контенті маркерів. Ключ мовно-незалежний,
 * назва класу живе у словниках клієнта.
 *
 * Біотин у списку не випадково: він впливає не на сам показник, а на МЕТОДИКУ
 * (імуноаналізи), і людина, яка п'є його як добавку для волосся, ніяк не
 * пов'яже це з дивним ТТГ — саме такі випадки прив'язка й має підсвічувати.
 */
export const DRUG_CLASS_KEYS = [
  'ppi',
  'h2_blocker',
  'metformin',
  'glucocorticoid',
  'statin',
  'thyroid_hormone',
  'antithyroid',
  'biotin',
  'ocp',
  'opioid',
] as const;

export type DrugClassKey = (typeof DRUG_CLASS_KEYS)[number];

export type BodySystemKey = (typeof BODY_SYSTEM_KEYS)[number];
export type FunctionalTagKey = (typeof FUNCTIONAL_TAG_KEYS)[number];
