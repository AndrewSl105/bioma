import { createContext, useCallback, useContext, ReactNode } from 'react';
import { authClient } from './authClient';

/**
 * Тонкий адаптер над Neon Auth (Better Auth), щоб решта застосунку
 * не залежала від конкретного SDK.
 *
 * Бекенд перевіряє JWT проти JWKS, тому в Authorization йде саме токен
 * з authClient.token() — не сесійна кука.
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

/**
 * Локальна розробка без реального логіну: VITE_AUTH_DEV_BYPASS==='true'
 * дає мок-користувача і токен 'dev-token'. Працює ЛИШЕ в парі з
 * AUTH_DEV_BYPASS=true на сервері (auth.guard.ts), інакше буде 401.
 */
const DEV_BYPASS = import.meta.env.VITE_AUTH_DEV_BYPASS === 'true';
const DEV_USER: AuthUser = { id: 'dev-user', name: 'Dev User', email: 'dev@local.test' };

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

/**
 * JWT для Authorization. Свідомо на рівні модуля, а не в компоненті:
 * реєстрація через useEffect створювала гонку — ефекти дітей виконуються
 * раніше за ефект батька, тож перші запити React Query летіли без токена.
 */
export async function getToken(): Promise<string | null> {
  if (DEV_BYPASS) return 'dev-token';
  if (cached && Date.now() < cached.expMs - SKEW_MS) return cached.token;

  const res = await authClient.token();
  const token = res.data?.token ?? null;
  if (!token) {
    cached = null;
    return null;
  }

  // Якщо exp прочитати не вдалося — тримаємо коротко, щоб не залипнути.
  cached = { token, expMs: readExpMs(token) ?? Date.now() + 60_000 };
  return token;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (DEV_BYPASS) {
    const value: AuthCtx = {
      user: DEV_USER,
      loading: false,
      getToken,
      signOut: async () => {},
    };
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
  }
  return <NeonAuthProvider>{children}</NeonAuthProvider>;
}

function NeonAuthProvider({ children }: { children: ReactNode }) {
  const { data, isPending } = authClient.useSession();

  const sessionUser = data?.user;
  const user: AuthUser | null = sessionUser
    ? {
        id: sessionUser.id,
        name: sessionUser.name ?? null,
        email: sessionUser.email ?? null,
      }
    : null;

  const signOut = useCallback(async () => {
    clearTokenCache();
    await authClient.signOut();
  }, []);

  const value: AuthCtx = { user, loading: isPending, getToken, signOut };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth має бути всередині <AuthProvider>');
  return ctx;
}
