import { createAuthClient } from '@neondatabase/neon-js/auth';
import { BetterAuthReactAdapter } from '@neondatabase/neon-js/auth/react';

/**
 * Клієнт Neon Auth (керований Better Auth).
 *
 * VITE_NEON_AUTH_URL — це той самий хост, що й NEON_AUTH_JWKS_URL на бекенді,
 * але без суфікса /.well-known/jwks.json. Better Auth дописує до нього
 * власні шляхи (/sign-in/email, /token, ...), а бекендний AuthGuard
 * перевіряє видані тут JWT проти JWKS того ж хоста.
 */
const url = import.meta.env.VITE_NEON_AUTH_URL as string | undefined;
const devBypass = import.meta.env.VITE_AUTH_DEV_BYPASS === 'true';

if (!url && !devBypass) {
  throw new Error(
    'VITE_NEON_AUTH_URL не задано. Візьміть URL Neon Auth у консолі Neon ' +
      '(вигляд: https://ep-xxx.neonauth.<region>.aws.neon.tech/neondb/auth).',
  );
}

// У dev-bypass режимі клієнт не використовується (auth.tsx його не викликає),
// але модуль має створитись — підставляємо заглушковий URL.
export const authClient = createAuthClient(url ?? 'http://localhost/_auth-disabled', {
  adapter: BetterAuthReactAdapter(),
});
