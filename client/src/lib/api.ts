import { clearTokenCache, getToken } from './auth';
import i18n, { currentLocale } from '@/i18n';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

/** Помилка API зі статусом — щоб UI і retry-логіка бачили справжню причину. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function send(path: string, init: RequestInit): Promise<Response> {
  const token = await getToken();
  // Діагностика лише в dev-режимі (у прод-бандл не потрапляє).
  if (import.meta.env.DEV) console.debug(token ? 'has token' : 'NO TOKEN', path);
  // Без токена запит не шлемо взагалі: сервер однаково відповість 401,
  // а «тихі» безтокенні запити і створювали шторм у Network.
  if (!token) throw new ApiError(401, i18n.t('app.noToken'));
  return fetch(`${BASE}/api${path}`, {
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      Authorization: `Bearer ${token}`,
      // Мова — на кожному запиті: назви маркерів і категорій локалізує бекенд,
      // тож без цього заголовка вони приходили б мовою за замовчуванням.
      'X-Locale': currentLocale(),
      ...init.headers,
    },
  });
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await send(path, init);

  // Токен міг протермінуватись між кешуванням і запитом — скидаємо кеш
  // і пробуємо ще раз рівно один раз, щоб не зациклитись.
  if (res.status === 401) {
    clearTokenCache();
    res = await send(path, init);
  }

  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, msg || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  /** Нормалізований поточний користувач із роллю (джерело — Neon Auth). */
  me: () => request<CurrentUser>('/auth/me'),
  /**
   * Створює UserProfile у нашій БД. Викликається один раз одразу після
   * логіну/реєстрації — саме це момент появи профілю. Ідемпотентно.
   */
  ensureProfile: () => request<Profile>('/profile/ensure', { method: 'POST' }),
  profile: () => request<Profile>('/profile'),
  updateProfile: (body: UpdateProfileBody) =>
    request<Profile>('/profile', { method: 'PATCH', body: JSON.stringify(body) }),
  overview: () => request<OverviewCard[]>('/overview'),
  biomarkers: () => request<Biomarker[]>('/biomarkers'),
  /** Додає показник із каталогу на дашборд. */
  selectBiomarker: (slug: string) =>
    request(`/biomarkers/${encodeURIComponent(slug)}/select`, { method: 'POST' }),
  /** Прибирає показник із дашборда. Історія результатів лишається. */
  deselectBiomarker: (slug: string) =>
    request(`/biomarkers/${encodeURIComponent(slug)}/select`, { method: 'DELETE' }),
  history: (slug: string) => request<History>(`/results?biomarker=${encodeURIComponent(slug)}`),
  addResult: (body: AddResultBody) =>
    request('/results', { method: 'POST', body: JSON.stringify(body) }),
  deleteResult: (id: string) => request(`/results/${id}`, { method: 'DELETE' }),
  aiExtract: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<AiExtractResult>('/ai/extract', { method: 'POST', body: fd });
  },
  // ── адмінка ──
  adminBiomarkers: () => request<AdminBiomarker[]>('/biomarkers/admin'),
  createBiomarker: (body: BiomarkerInput) =>
    request<Biomarker>('/biomarkers', { method: 'POST', body: JSON.stringify(body) }),
  updateBiomarker: (slug: string, body: BiomarkerInput) =>
    request<Biomarker>(`/biomarkers/${encodeURIComponent(slug)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  /** Контент показника мовою інтерфейсу (для сторінки показника). */
  biomarkerContent: (slug: string) =>
    request<BiomarkerContent | null>(`/biomarkers/${encodeURIComponent(slug)}/content`),
  /** Усі локалі контенту — для форми редагування. */
  allBiomarkerContent: (slug: string) =>
    request<BiomarkerContent[]>(`/biomarkers/${encodeURIComponent(slug)}/content/all`),
  saveBiomarkerContent: (slug: string, locale: string, body: BiomarkerContentInput) =>
    request<BiomarkerContent>(
      `/biomarkers/${encodeURIComponent(slug)}/content/${encodeURIComponent(locale)}`,
      { method: 'PUT', body: JSON.stringify(body) },
    ),

  categories: () => request<Category[]>('/categories'),
  createCategory: (body: CategoryInput) =>
    request<Category>('/categories', { method: 'POST', body: JSON.stringify(body) }),
  updateCategory: (id: string, body: CategoryInput) =>
    request<Category>(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  reorderCategories: (ids: string[]) =>
    request('/categories/reorder', { method: 'PATCH', body: JSON.stringify({ ids }) }),
  deleteCategory: (id: string) => request(`/categories/${id}`, { method: 'DELETE' }),

  aiCommit: (body: AiCommitBody) =>
    request<{ panelId: string; created: number }>('/ai/commit', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

// ── типи ──
export type UserRole = 'user' | 'admin';
/**
 * Роль приходить лише звідси. Тримати її у клієнтському стані як «джерело
 * істини» не можна: це виключно про те, що показувати — кожен /api/admin/*
 * маршрут перевіряє право сам.
 */
export interface CurrentUser {
  userId: string;
  email: string | null;
  name: string | null;
  role: UserRole;
}
export type Sex = 'MALE' | 'FEMALE' | 'ANY';

/** Категорія біомаркера. imageUrl збирає бекенд з R2_PUBLIC_BASE_URL. */
export interface BiomarkerCategory {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
}
/** Наші поля користувача. Email/ім'я живуть у Neon Auth, не тут. */
export interface Profile {
  userId: string;
  sex: Sex | null;
  birthDate: string | null;
  locale: string;
}
export interface UpdateProfileBody { sex?: Sex; birthDate?: string | null; locale?: string; }
export type Flag = 'LOW' | 'NORMAL' | 'HIGH' | 'UNKNOWN';

/**
 * Зони інтерпретації. Прапорець лишається бінарним («у межах норми чи ні»), а
 * зона додає градацію поверх нього — і саме її видно підписом на бейджі.
 *
 * zone обчислюється на сервері з Biomarker.bands і може бути null: у частини
 * показників смуг просто немає (напр. ЛПВЩ), і тоді UI показує самий прапорець.
 *
 * label — авторський текст із каталогу («достатній», «ціль високого ризику»).
 * Він наразі україномовний для всіх локалей: смуги зберігаються одним записом
 * на показник, без перекладів. Рівень (level) мовно-незалежний, тож колір і
 * доступна назва беруться саме з нього.
 */
export type BandLevel =
  | 'DEFICIENT'
  | 'LOW'
  | 'BELOW_OPTIMAL'
  | 'OPTIMAL'
  | 'NORMAL'
  | 'ABOVE_OPTIMAL'
  | 'HIGH'
  | 'VERY_HIGH'
  | 'CRITICAL';
export interface Zone { level: BandLevel; label: string }
export interface Band { level: BandLevel; label: string; min?: number; max?: number }
/**
 * Картка дашборда. Дашборд будується з ОБРАНИХ показників, тож latest === null
 * для щойно доданого показника, по якому ще немає жодного аналізу.
 */
export interface OverviewCard {
  biomarker: { slug: string; name: string; shortName: string | null; category: BiomarkerCategory | null; unit: string; precision: number };
  latest: { value: number; unit: string; measuredAt: string; flag: Flag; zone: Zone | null } | null;
  reference: { low: number | null; high: number | null; optimalLow: number | null; optimalHigh: number | null } | null;
  bands: Band[];
  count: number;
}
/** Показник із системного каталогу. selected — чи він уже на дашборді. */
export interface Biomarker {
  id: string; slug: string; name: string; shortName: string | null; unit: string; category: BiomarkerCategory | null;
  selected: boolean;
}
export interface HistoryPoint {
  id: string; value: number; unit: string; measuredAt: string; flag: Flag; zone: Zone | null; source: string; note: string | null;
}
export interface History {
  biomarker: { slug: string; name: string; shortName: string | null; unit: string; category: BiomarkerCategory | null; precision: number };
  bands: Band[];
  reference: { low: number | null; high: number | null; optimalLow: number | null; optimalHigh: number | null; unit: string; source: string | null } | null;
  latest: HistoryPoint | null;
  trend: number | null;
  series: HistoryPoint[];
}
export interface AddResultBody { biomarkerSlug: string; value: number; unit?: string; measuredAt: string; note?: string; }
export interface AiExtractResult {
  documentId: string; labName: string | null; takenAt: string | null;
  items: { extracted: { name: string; value: number; unit: string; referenceLow: number | null; referenceHigh: number | null; rawText: string };
    matchedBiomarker: { slug: string; name: string; unit: string } | null; }[];
}
export interface AiCommitBody {
  documentId?: string; labName?: string; takenAt: string;
  items: { biomarkerSlug: string; value: number; unit: string; rawText?: string }[];
}

// ── адмінські типи ──
export interface LocalizedName { locale: string; name: string; shortName?: string | null }

/** Категорія в адмінці: з порядком, активністю й усіма перекладами. */
export interface Category extends BiomarkerCategory {
  /** Канон із БД. name вище — уже локалізоване, у формі потрібні обидва. */
  canonicalName?: string;
  sortOrder: number;
  isActive: boolean;
  biomarkerCount: number;
  translations?: { locale: string; name: string }[];
}
export interface CategoryInput {
  name?: string;
  slug?: string;
  imageKey?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  translations?: { locale: string; name: string }[];
}

export interface ReferenceRangeInput {
  low?: number;
  high?: number;
  optimalLow?: number;
  optimalHigh?: number;
  sex?: Sex;
  ageMinYears?: number;
  ageMaxYears?: number;
  source?: string;
}

/**
 * Маркер у списку адмінки. canonicalName віддається окремо від name:
 * name локалізоване, а у формі потрібен і англійський оригінал.
 */
export interface AdminBiomarker extends Biomarker {
  canonicalName: string;
  canonicalShort: string | null;
  isActive: boolean;
  precision: number;
  loincCode: string | null;
  translations: LocalizedName[];
  referenceRanges: (ReferenceRangeInput & { id: string; unit: string })[];
  contentLocales: string[];
}

export interface BiomarkerInput {
  name?: string;
  shortName?: string | null;
  unit?: string;
  categoryId?: string | null;
  precision?: number;
  loincCode?: string | null;
  isActive?: boolean;
  translations?: LocalizedName[];
  referenceRanges?: ReferenceRangeInput[];
}

/** url опційний: у частині джерел є лише назва (друковані настанови). */
export interface MedicalSource { title: string; url?: string }

/** Довідковий контент. Усі поля опційні — наповнюється поступово. */
export interface BiomarkerContent {
  locale: string;
  overview: string | null;
  whatItMeasures: string | null;
  roleInBody: string | null;
  relatedSystems: string | null;
  functionalLinks: string | null;
  /** Ключі таксономії — за ними малюються чипи з іконками. */
  relatedSystemKeys: string[];
  functionalTagKeys: string[];
  lowMeaning: string | null;
  highMeaning: string | null;
  influencingFactors: string | null;
  preparation: string | null;
  commonlyEvaluatedWith: string[];
  confirmatoryTests: string[];
  foodSources: string | null;
  supplementsInfo: string | null;
  drugClassesInfo: string | null;
  medicalSources: MedicalSource[];
  lastReviewedAt: string | null;
  reviewedBy: string | null;
}
export type BiomarkerContentInput = Partial<Omit<BiomarkerContent, 'locale' | 'lastReviewedAt'>> & {
  lastReviewedAt?: string;
};
