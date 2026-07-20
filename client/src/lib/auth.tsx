import { createContext, useCallback, useContext, useEffect, ReactNode } from 'react';
import { authClient, getJWTToken } from './authClient';
import { clearPersistedCache } from './persist';

/**
 * Тонкий адаптер над Neon Auth (Better Auth), щоб решта застосунку
 * не залежала від конкретного SDK.
 *
 * Бекенд перевіряє JWT проти JWKS, тому в Authorization йде саме JWT
 * із getJWTToken() — не сесійна кука і не сесійний токен Better Auth.
 */
export interface AuthUser {
  id: string;
  name: string | null;
  email: string | null;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

// Кеш JWT, щоб не ходити на /token перед кожним запитом до API.
let cached: { token: string; expMs: number } | null = null;
const SKEW_MS = 30_000; // оновлюємо трохи раніше за фактичний exp

/** Дістає exp із JWT без залежностей; null, якщо розібрати не вдалося. */
function readExpMs(jwt: string): number | null {
  try {
    const [, payload] = jwt.split('.');
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = JSON.parse(json)?.exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Скидає кеш токена (напр. після 401 або виходу). */
export function clearTokenCache() {
  cached = null;
}

// ── слід входу для offline-старту ──
const SIGNED_IN_KEY = 'bioma:signed-in-once';

function markSignedInOnce() {
  try {
    window.localStorage.setItem(SIGNED_IN_KEY, '1');
  } catch {
    /* приватний режим — offline-старт просто не спрацює */
  }
}

function forgetSignedIn() {
  try {
    window.localStorage.removeItem(SIGNED_IN_KEY);
  } catch {
    /* нічого прибирати */
  }
}

/** Чи входив користувач на цьому пристрої (див. коментар в AuthProvider). */
export function hasSignedInOnce(): boolean {
  try {
    return window.localStorage.getItem(SIGNED_IN_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * JWT для Authorization. Свідомо на рівні модуля, а не в компоненті:
 * реєстрація через useEffect створювала гонку — ефекти дітей виконуються
 * раніше за ефект батька, тож перші запити React Query летіли без токена.
 */
export async function getToken(): Promise<string | null> {
  if (cached && Date.now() < cached.expMs - SKEW_MS) return cached.token;

  // SDK може кинути AuthApiError (напр., сесії ще немає) — для нас це
  // просто «токена немає», а не краш.
  let token: string | null = null;
  try {
    token = await getJWTToken();
  } catch {
    token = null;
  }
  if (!token) {
    cached = null;
    return null;
  }

  // Якщо exp прочитати не вдалося — тримаємо коротко, щоб не залипнути.
  cached = { token, expMs: readExpMs(token) ?? Date.now() + 60_000 };
  return token;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isPending } = authClient.useSession();

  const sessionUser = data?.user;
  const user: AuthUser | null = sessionUser
    ? {
        id: sessionUser.id,
        name: sessionUser.name ?? null,
        email: sessionUser.email ?? null,
      }
    : null;

  // Слід «цей пристрій уже мав вхід». Потрібен рівно для offline-старту:
  // перевірка сесії — мережева, тож без інтернету user приходить null, і без
  // цього прапорця застосунок кидав би на екран логіну поверх збережених
  // даних, які ми чесно можемо показати. Логіном це НЕ є: токена немає,
  // будь-який запит до API все одно отримає 401.
  useEffect(() => {
    if (user) markSignedInOnce();
  }, [user]);

  const signOut = useCallback(async () => {
    // Локальні сліди прибираємо ПЕРШИМИ і завжди. Дані аналізів лежать на
    // диску, тож вихід мусить їх стерти навіть якщо серверний signOut не
    // вдасться (offline) — інакше вони лишились би наступному користувачу.
    clearTokenCache();
    clearPersistedCache();
    forgetSignedIn();
    try {
      await authClient.signOut();
    } catch {
      // Без мережі сесію на сервері не завершити. Локально ми вже вийшли;
      // кидати помилку нікуди — це лишило б unhandled rejection.
    }
  }, []);

  const value: AuthCtx = { user, loading: isPending, getToken, signOut };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth має бути всередині <AuthProvider>');
  return ctx;
}
