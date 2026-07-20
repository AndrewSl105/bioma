import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './auth';

/**
 * Створює UserProfile у нашій БД одразу після появи користувача з Neon Auth
 * (тобто після успішного логіну/реєстрації). Це і є момент народження профілю —
 * раніше він з'являвся побічним ефектом AuthGuard на випадковому запиті.
 *
 * Свідомо useQuery, а не useEffect + fetch: react-query сам дедуплікує виклик
 * (StrictMode у dev монтує ефекти двічі), тримає результат у кеші на весь
 * сеанс і ретраїть збої. Сам ендпоінт ідемпотентний (upsert).
 */
export function useEnsureProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['profile', 'ensure', user?.id],
    queryFn: api.ensureProfile,
    enabled: !!user,
    staleTime: Infinity,
    gcTime: Infinity,
    // Перекриваємо глобальне правило «401 не ретраїмо». Для решти запитів воно
    // правильне (потрібен перелогін), але тут 401 буває транзієнтним: токен
    // з'являється трохи пізніше за user із useSession. Без ретраю одна рання
    // 401 у парі зі staleTime: Infinity вбивала створення профілю до кінця
    // сеансу — профіль не з'являвся вже ніколи.
    retry: 5,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15_000),
  });
}
