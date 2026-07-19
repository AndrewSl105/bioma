import { clearTokenCache, getToken } from './auth';

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
  if (!token) throw new ApiError(401, 'Немає токена доступу — увійдіть у застосунок ще раз.');
  return fetch(`${BASE}/api${path}`, {
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      Authorization: `Bearer ${token}`,
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
  overview: () => request<OverviewCard[]>('/overview'),
  biomarkers: () => request<Biomarker[]>('/biomarkers'),
  history: (slug: string) => request<History>(`/results?biomarker=${encodeURIComponent(slug)}`),
  addResult: (body: AddResultBody) =>
    request('/results', { method: 'POST', body: JSON.stringify(body) }),
  deleteResult: (id: string) => request(`/results/${id}`, { method: 'DELETE' }),
  aiExtract: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<AiExtractResult>('/ai/extract', { method: 'POST', body: fd });
  },
  aiCommit: (body: AiCommitBody) =>
    request<{ panelId: string; created: number }>('/ai/commit', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

// ── типи ──
export type Flag = 'LOW' | 'NORMAL' | 'HIGH' | 'UNKNOWN';
export interface OverviewCard {
  biomarker: { slug: string; name: string; shortName: string | null; category: string | null; unit: string; precision: number };
  latest: { value: number; unit: string; measuredAt: string; flag: Flag };
  reference: { low: number | null; high: number | null } | null;
  count: number;
}
export interface Biomarker {
  id: string; slug: string; name: string; shortName: string | null; unit: string; category: string | null;
}
export interface HistoryPoint {
  id: string; value: number; unit: string; measuredAt: string; flag: Flag; source: string; note: string | null;
}
export interface History {
  biomarker: { slug: string; name: string; shortName: string | null; unit: string; category: string | null; precision: number };
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
