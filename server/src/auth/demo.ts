import { randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

/**
 * Демо-режим для публічної вітрини: вхід за спільним логіном/паролем без
 * Neon Auth. Сервер сам видає і сам перевіряє JWT (HS256), тож для запуску
 * потрібні лише Postgres і цей прапорець.
 *
 * На відміну від AUTH_DEV_BYPASS, тут є справжній вхід і справжній токен,
 * тому в production демо дозволене — але лише на окремій, демо-базі.
 */
export const DEMO_MODE = process.env.DEMO_MODE === 'true';

/**
 * Демо-користувач. id збігається з SEED_USER_ID у docker-compose: сід ллє
 * демо-аналізи саме сюди. Роль завжди 'user' — адмінку на публічному демо
 * відкривати не можна, інакше будь-хто переписав би каталог.
 */
export const DEMO_USER = {
  userId: process.env.DEMO_USER_ID?.trim() || 'demo-user',
  email: process.env.DEMO_EMAIL?.trim() || 'demo@bioma.app',
  name: 'Demo',
} as const;

/** Пароль публічний за задумом: його показує сторінка входу. */
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'demo1234';

/**
 * Без DEMO_JWT_SECRET ключ випадковий на кожен старт: токени просто
 * протухають після рестарту, і клієнт попросить увійти ще раз.
 */
const secret = new TextEncoder().encode(
  process.env.DEMO_JWT_SECRET || randomBytes(32).toString('hex'),
);
const ISSUER = 'bioma-demo';
const TTL = '12h';

export function checkDemoCredentials(email: string, password: string): boolean {
  return email.trim().toLowerCase() === DEMO_USER.email.toLowerCase() && password === DEMO_PASSWORD;
}

export function signDemoToken(): Promise<string> {
  return new SignJWT({ email: DEMO_USER.email, name: DEMO_USER.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(DEMO_USER.userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(secret);
}

/** Кидає, якщо підпис/строк/issuer не збігаються — як і jwtVerify. */
export async function verifyDemoToken(token: string) {
  const { payload } = await jwtVerify(token, secret, { issuer: ISSUER, algorithms: ['HS256'] });
  return payload;
}
