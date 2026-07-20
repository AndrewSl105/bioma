import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { Button, Card } from '@/components/ui/primitives';

/**
 * Пускає в адмінку лише коли роль уже відома і дорівнює admin.
 *
 * Це виключно про UI. Захист даних тримає бекенд: кожен /api/admin/*
 * маршрут окремо перевіряє роль, тож обхід цієї перевірки в браузері
 * не дає доступу ні до чого.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, isRoleLoading, isError } = useCurrentUser();

  // Поки роль невідома — ні адмінського UI, ні 403. Редірект саме тут і
  // давав би те «мерехтіння», якого треба уникнути.
  if (isRoleLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (isAdmin) return <>{children}</>;

  return (
    <Card className="mx-auto mt-10 max-w-md p-8 text-center">
      <ShieldAlert className="mx-auto mb-3 text-muted" />
      <h1 className="font-display text-lg font-bold">Доступ обмежено</h1>
      <p className="mt-1 text-sm text-muted">
        {isError
          ? 'Не вдалося перевірити права. Спробуйте оновити сторінку.'
          : 'Ця частина застосунку доступна лише адміністраторам.'}
      </p>
      <Link to="/" className="mt-5 block">
        <Button className="w-full">На головну</Button>
      </Link>
    </Card>
  );
}
