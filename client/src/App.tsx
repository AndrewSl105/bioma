import { Route, Routes } from 'react-router-dom';
import { LogOut, Loader2 } from 'lucide-react';
import { useAuth } from './lib/auth';
import { Button } from './components/ui/primitives';
import { DashboardPage } from './pages/DashboardPage';
import { BiomarkerPage } from './pages/BiomarkerPage';
import { LoginPage } from './pages/LoginPage';

export default function App() {
  const { user, loading, signOut } = useAuth();

  // Поки сесія підвантажується — не блимаємо екраном логіну на F5.
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex shrink-0 items-center gap-2">
            {/* alt="" — назву поруч уже озвучує текст, щоб не дублювати */}
            <img src="/logo.svg" alt="" className="h-8 w-8 shrink-0" />
            <span className="font-display text-lg font-bold tracking-tight">Bioma</span>
          </div>
          <div className="flex min-w-0 items-center gap-1">
            <span className="min-w-0 truncate text-sm text-muted">
              {user.name ?? user.email}
            </span>
            <Button
              variant="ghost"
              aria-label="Вийти"
              className="h-10 w-10 shrink-0 p-0 sm:h-9 sm:w-9"
              onClick={() => void signOut()}
            >
              <LogOut size={16} />
            </Button>
          </div>
        </div>
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
