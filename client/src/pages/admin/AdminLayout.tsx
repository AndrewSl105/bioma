import { NavLink, Outlet, Link } from 'react-router-dom';
import { ArrowLeft, FolderTree, TestTube2 } from 'lucide-react';
import { cn } from '@/lib/cn';

const NAV = [
  { to: '/admin/categories', label: 'Категорії', icon: FolderTree },
  { to: '/admin/biomarkers', label: 'Маркери', icon: TestTube2 },
];

/**
 * Оболонка адмінки в стилі основного застосунку: та сама шапка, ті самі
 * кольори й радіуси. Навігація — таби, бо їх лише дві: бічна панель на
 * мобільному коштувала б більше, ніж дає.
 */
export function AdminLayout() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3.5">
          <Link
            to="/"
            className={cn(
              'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-sm text-muted',
              'transition-colors hover:bg-line/40 hover:text-ink',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
            )}
          >
            <ArrowLeft size={16} />
            {/* На вузькому екрані лишається лише стрілка — підпис з'їдав
                місце в рядку з назвою. Доступну назву лишаємо для скрінрідерів. */}
            <span className="hidden sm:inline">До застосунку</span>
            <span className="sr-only sm:hidden">До застосунку</span>
          </Link>

          <span className="min-w-0 flex-1 truncate font-display text-lg font-bold tracking-tight">
            Адмінка
          </span>
        </div>

        <nav className="mx-auto flex max-w-5xl gap-1 px-2 pb-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium',
                  'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                  isActive
                    ? 'bg-primary-soft text-primary-ink'
                    : 'text-muted hover:bg-line/40 hover:text-ink',
                )
              }
            >
              <Icon size={16} className="shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pt-8 sm:pb-8">
        <Outlet />
      </main>
    </div>
  );
}
