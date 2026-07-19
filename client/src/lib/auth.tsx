import { createContext, useContext, ReactNode } from 'react';

/**
 * Абстракція автентифікації.
 *
 * За замовчуванням працює dev-режим (VITE_AUTH_DEV_BYPASS=true): мок-користувач
 * і фіктивний токен — застосунок можна запустити без налаштованого Neon Auth.
 *
 * Для продакшену:
 *  1) обгорніть застосунок у <StackProvider app={stackClientApp}> (@stackframe/react),
 *  2) замініть getToken() на await stackApp.getUser()?.getAuthJson() → accessToken,
 *  3) вимкніть VITE_AUTH_DEV_BYPASS.
 * Neon Auth = Stack Auth; JWT перевіряється на бекенді через JWKS.
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
  signOut: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

const DEV_BYPASS = import.meta.env.VITE_AUTH_DEV_BYPASS === 'true';

const DEV_USER: AuthUser = {
  id: 'dev-user-00000000',
  name: 'Андрій',
  email: 'andrii@example.com',
};
// Токен для локального dev (бекенд може приймати його в dev-режимі).
const DEV_TOKEN = 'dev-token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const value: AuthCtx = DEV_BYPASS
    ? {
        user: DEV_USER,
        loading: false,
        getToken: async () => DEV_TOKEN,
        signOut: () => {},
      }
    : {
        // TODO: підключити @stackframe/react (Neon Auth)
        user: null,
        loading: false,
        getToken: async () => null,
        signOut: () => {},
      };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth має бути всередині <AuthProvider>');
  return ctx;
}
