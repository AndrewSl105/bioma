import { useSyncExternalStore } from 'react';

/**
 * Демо-режим: замість Neon Auth вхід іде через наш API за спільним
 * демо-логіном. Сервер видає власний JWT, ми тримаємо його в localStorage
 * разом із користувачем — більше сесії ніде немає.
 *
 * Прапорець збірки, а не рантайму: від нього залежить, чи взагалі
 * підніматиметься клієнт Neon Auth.
 */
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const KEY = 'bioma:demo-session';

export interface DemoSession {
  token: string;
  user: { id: string; name: string | null; email: string | null };
}

const listeners = new Set<() => void>();
let session: DemoSession | null = read();

function read(): DemoSession | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DemoSession) : null;
  } catch {
    return null;
  }
}

function write(next: DemoSession | null) {
  session = next;
  try {
    if (next) window.localStorage.setItem(KEY, JSON.stringify(next));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* приватний режим — сесія житиме до перезавантаження */
  }
  listeners.forEach((l) => l());
}

export function getDemoToken(): string | null {
  return session?.token ?? null;
}

/** Протух токен (напр. сервер перезапустився з новим ключем) — назад на вхід. */
export function clearDemoSession() {
  write(null);
}

export function useDemoSession(): DemoSession | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => session,
  );
}

/** Демо-облікові дані, які сервер готовий прийняти (щоб показати на вході). */
export async function fetchDemoCredentials(): Promise<{ email: string; password: string }> {
  const res = await fetch(`${BASE}/api/auth/demo`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Повертає false на невірні дані; кидає, якщо сервер недоступний. */
export async function demoSignIn(email: string, password: string): Promise<boolean> {
  const res = await fetch(`${BASE}/api/auth/demo/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (res.status === 401) return false;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  write((await res.json()) as DemoSession);
  return true;
}
