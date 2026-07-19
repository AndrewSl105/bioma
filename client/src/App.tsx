import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { useAuth } from './lib/auth';
import { registerTokenGetter } from './lib/api';
import { DashboardPage } from './pages/DashboardPage';
import { BiomarkerPage } from './pages/BiomarkerPage';

export default function App() {
  const { user, getToken } = useAuth();

  useEffect(() => {
    registerTokenGetter(getToken);
  }, [getToken]);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex shrink-0 items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
              <Activity size={18} />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">PROM</span>
          </div>
          {user && (
            <span className="min-w-0 max-w-[55%] truncate text-sm text-muted">
              {user.name ?? user.email}
            </span>
          )}
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
