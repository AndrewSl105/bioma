import {
  Activity,
  Bone,
  Brain,
  Droplet,
  Droplets,
  Dna,
  Dumbbell,
  Flame,
  Heart,
  Moon,
  Shield,
  Smile,
  Soup,
  Wind,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * Таксономія систем організму та функціональних зв'язків.
 *
 * Ключі мовно-незалежні й мусять збігатися з server/src/biomarkers/taxonomy.ts —
 * бекенд валідує саме їх. Назви беруться зі словників i18n за ключем
 * `systems.<key>` / `functional.<key>`, а не зберігаються тут: інакше вони не
 * перемикалися б разом із мовою.
 *
 * ІКОНКИ. Специфікація пропонувала Healthicons через Iconify заради органних
 * піктограм (щитоподібна, печінка, нирки). Свідомо лишаємось на lucide:
 *  — @iconify/react за замовчуванням тягне іконки з мережі під час рендера, а
 *    застосунок офлайн-first (service worker, persist-кеш) — тобто саме там,
 *    де мережі немає, зникли б і піктограми;
 *  — офлайн-варіант (@iconify-json/healthicons) — це кількасот кілобайт JSON
 *    заради тринадцяти іконок.
 * Вибір інкапсульовано тут: перехід на інший набір — правка однієї мапи, решта
 * UI про джерело не знає.
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

/** Аналоги з lucide для органних систем, яких у наборі немає буквально. */
const SYSTEM_ICONS: Record<BodySystemKey, LucideIcon> = {
  endocrine: Activity, // немає щитоподібної — беремо «регуляцію/активність»
  immune: Shield,
  cardiovascular: Heart,
  metabolic: Flame,
  nervous: Brain,
  skeletal: Bone,
  hematologic: Droplets,
  hepatic: Droplet, // немає печінки — крапля як «біохімія/жовч»
  renal: Droplet,
  digestive: Soup, // немає шлунка — «їжа/травлення»
  respiratory: Wind, // немає легень — «дихання»
  reproductive: Dna,
  muscular: Dumbbell,
};

const FUNCTIONAL_ICONS: Record<FunctionalTagKey, LucideIcon> = {
  energy: Zap,
  sleep: Moon,
  endurance: Activity,
  metabolism: Flame,
  mood: Smile,
  cognition: Brain,
  immunity: Shield,
  bone: Bone,
};

export function isBodySystemKey(v: string): v is BodySystemKey {
  return (BODY_SYSTEM_KEYS as readonly string[]).includes(v);
}

export function isFunctionalTagKey(v: string): v is FunctionalTagKey {
  return (FUNCTIONAL_TAG_KEYS as readonly string[]).includes(v);
}

/**
 * Іконка системи організму. aria-hidden: поруч завжди стоїть назва текстом,
 * тож для скрінрідера піктограма — шум.
 */
export function SystemIcon({ name, size = 14 }: { name: BodySystemKey; size?: number }) {
  const Icon = SYSTEM_ICONS[name];
  return <Icon size={size} aria-hidden className="shrink-0" />;
}

export function FunctionalIcon({ name, size = 14 }: { name: FunctionalTagKey; size?: number }) {
  const Icon = FUNCTIONAL_ICONS[name];
  return <Icon size={size} aria-hidden className="shrink-0" />;
}
