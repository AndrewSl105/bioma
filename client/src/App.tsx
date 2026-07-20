import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { LogOut, Loader2, CloudOff, Shield } from 'lucide-react';
import { useAuth, hasSignedInOnce } from './lib/auth';
import { useEnsureProfile } from './lib/useEnsureProfile';
import { useCurrentUser } from './lib/useCurrentUser';
import { useOnline } from './lib/useOnline';
import { Button } from './components/ui/primitives';
import { DashboardPage } from './pages/DashboardPage';
import { BiomarkerPage } from './pages/BiomarkerPage';
import { LoginPage } from './pages/LoginPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { RequireAdmin } from './pages/admin/RequireAdmin';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage';
import { AdminBiomarkersPage } from './pages/admin/AdminBiomarkersPage';

export default function App() {
  const { user, loading } = useAuth();
  const online = useOnline();
  // Профіль у нашій БД створюємо одразу, як з'явився користувач Neon Auth.
  // Запити на читання його не чекають, а от записи (додати результат) без
  // рядка UserProfile впадуть на FK — тому виклик іде якнайраніше.
  useEnsureProfile();

  // Offline перевірка сесії не проходить (вона мережева), тож user буде null.
  // Якщо на цьому пристрої вхід уже був — показуємо застосунок зі збереженими
  // даними замість екрана логіну, на якому offline однаково нічого не вдієш.
  const offlineFallback = !online && hasSignedInOnce();

  // Поки сесія підвантажується — не блимаємо екраном логіну на F5.
  // Offline чекати нема чого: перевірка все одно не завершиться успіхом.
  if (loading && !offlineFallback) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user && !offlineFallback) return <LoginPage />;

  return (
    <Routes>
      {/* Адмінка має власну оболонку, тож живе поруч з основною, а не в ній. */}
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<Navigate to="/admin/categories" replace />} />
        <Route path="categories" element={<AdminCategoriesPage />} />
        <Route path="biomarkers" element={<AdminBiomarkersPage />} />
      </Route>

      <Route path="*" element={<AppShell />} />
    </Routes>
  );
}

/** Основна оболонка застосунку: шапка, стан мережі й користувацькі сторінки. */
function AppShell() {
  const { user, signOut } = useAuth();
  const online = useOnline();
  // isAdmin стає true лише коли роль реально прийшла з /api/auth/me,
  // тож посилання не блимає у звичайного користувача.
  const { isAdmin } = useCurrentUser();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3.5">
          {/* min-w-0 на обох половинах: інакше довге ім'я не даватиме
              стискатися сусідові й витисне логотип за край. */}
          <Link
            to="/"
            className="flex min-w-0 shrink items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {/* alt="" — назву поруч уже озвучує текст, щоб не дублювати */}
            <img src="/logo.svg" alt="" className="h-8 w-8 shrink-0" />
            <span className="truncate font-display text-lg font-bold tracking-tight">Bioma</span>
          </Link>

          <div className="flex min-w-0 items-center gap-1">
            {/* Offline сесії немає, тож імені ми не знаємо — показуємо стан,
                а не порожнє місце поруч із кнопкою виходу. */}
            <span className="min-w-0 truncate text-sm text-muted">
              {user ? (user.name ?? user.email) : 'Збережені дані'}
            </span>
            {isAdmin && (
              <Link
                to="/admin/categories"
                aria-label="Адмінка"
                title="Адмінка"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-line/40 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <Shield size={16} />
              </Link>
            )}
            <Button
              variant="ghost"
              aria-label="Вийти"
              className="h-11 w-11 shrink-0 p-0"
              onClick={() => void signOut()}
            >
              <LogOut size={16} />
            </Button>
          </div>
        </div>

        {/* Стан мережі: без нього offline виглядав би як «застосунок завис»
            або як застарілі дані, видані за свіжі. */}
        {!online && (
          <div
            role="status"
            className="flex items-center justify-center gap-2 border-t border-line bg-primary-soft px-4 py-2 text-sm text-primary-ink"
          >
            <CloudOff size={15} className="shrink-0" />
            <span>Немає мережі — показуємо збережені дані</span>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pt-8 sm:pb-8">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/b/:slug" element={<BiomarkerPage />} />
        </Routes>
      </main>
    </div>
  );
}
