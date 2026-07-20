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

export type BodySystemKey = (typeof BODY_SYSTEM_KEYS)[number];
export type FunctionalTagKey = (typeof FUNCTIONAL_TAG_KEYS)[number];
