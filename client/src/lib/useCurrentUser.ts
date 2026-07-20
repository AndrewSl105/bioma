import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './auth';

/**
 * Поточний користувач із роллю, з GET /api/auth/me.
 *
 * Роль свідомо НЕ беремо із сесії Neon Auth на клієнті: там у токені лежить
 * role="authenticated" (роль Postgres для RLS), яка до прикладних прав
 * стосунку не має. Нормалізує роль бекенд.
 */
export function useCurrentUser() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['auth', 'me', user?.id],
    queryFn: api.me,
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  return {
    ...query,
    /**
     * isAdmin=true лише коли роль справді прийшла. Поки триває запит —
     * false, тож адмінський UI не блимає перед тим, як зникнути.
     */
    isAdmin: query.data?.role === 'admin',
    /** Роль ще невідома: показувати ні адмінський UI, ні 403 ще рано. */
    isRoleLoading: !!user && query.isPending,
  };
}
