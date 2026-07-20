import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from './api';
import { useAuth } from './auth';
import { isSupportedLocale, LOCALE_STORAGE_KEY } from '@/i18n';

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
  const { i18n } = useTranslation();

  const query = useQuery({
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

  // Мова з профілю підхоплюється лише тоді, коли на цьому пристрої вибору ще
  // не робили: інакше вхід затирав би щойно перемкнуту мову тією, що збережена
  // на сервері. Тобто профіль — це дефолт для нового пристрою, а не наказ.
  const profileLocale = query.data?.locale;
  useEffect(() => {
    if (!profileLocale || !isSupportedLocale(profileLocale)) return;
    if (localStorage.getItem(LOCALE_STORAGE_KEY)) return;
    if (i18n.resolvedLanguage === profileLocale) return;
    void i18n.changeLanguage(profileLocale);
  }, [profileLocale, i18n]);

  return query;
}
