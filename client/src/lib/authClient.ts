import { createInternalNeonAuth } from '@neondatabase/neon-js/auth';
import {
  BetterAuthReactAdapter,
  type BetterAuthReactAdapterInstance,
} from '@neondatabase/neon-js/auth/react';
import { DEMO_MODE } from './demoAuth';

/**
 * Клієнт Neon Auth (керований Better Auth).
 *
 * VITE_NEON_AUTH_URL — це той самий хост, що й NEON_AUTH_JWKS_URL на бекенді,
 * але без суфікса /.well-known/jwks.json. Better Auth дописує до нього
 * власні шляхи (/sign-in/email, /get-session, ...), а бекендний AuthGuard
 * перевіряє видані тут JWT проти JWKS того ж хоста.
 */
const url = import.meta.env.VITE_NEON_AUTH_URL as string | undefined;

// У демо-режимі Neon Auth не використовується (див. demoAuth.ts), тож і URL
// не обов'язковий. Клієнт створюється з заглушкою лише щоб імпорти не падали:
// до мережі він не звертається, поки його ніхто не викликає.
if (!url && !DEMO_MODE) {
  throw new Error(
    'VITE_NEON_AUTH_URL не задано. Візьміть URL Neon Auth у консолі Neon ' +
      '(вигляд: https://ep-xxx.neonauth.<region>.aws.neon.tech/neondb/auth).',
  );
}

// Дженерик задаємо явно: без нього виводиться vanilla-адаптер, у якого
// useSession — це стор-атом, а не хук, і типи розсипаються.
const neonAuth = createInternalNeonAuth<BetterAuthReactAdapterInstance>(url ?? 'http://demo.invalid', {
  adapter: BetterAuthReactAdapter(),
});

/** Better Auth-клієнт: signIn/signUp/useSession/signOut. */
export const authClient = neonAuth.adapter;

/**
 * JWT для нашого API.
 *
 * Свідомо через SDK, а НЕ через authClient.token(): ендпоінт /token
 * автентифікується сесійною кукою, а вона для нас третьосторонняя
 * (застосунок на localhost:5173, Neon Auth — на *.neonauth.…aws.neon.tech),
 * тож браузер її не віддає і /token стабільно повертає 401.
 *
 * SDK натомість бере JWT із заголовка set-auth-jwt, який Neon Auth віддає
 * на відповідях сесії і явно відкриває через access-control-expose-headers.
 * Тому цей шлях працює крос-доменно, а /token — ні.
 */
export const getJWTToken = () => neonAuth.getJWTToken();
