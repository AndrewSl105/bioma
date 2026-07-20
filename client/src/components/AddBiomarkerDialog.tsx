import { useMemo, useState, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Search, X } from 'lucide-react';
import { api, type Biomarker } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useIsMobile } from '@/lib/useIsMobile';
import { Button, Input } from './ui/primitives';

/**
 * Вибір показника із системного каталогу на свій дашборд.
 *
 * Власні показники користувач не створює — каталог веде адміністратор, а тут
 * людина лише позначає, що саме хоче відстежувати.
 */
export function AddBiomarkerDialog({ trigger }: { trigger: ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const { user } = useAuth();

  const { data: biomarkers, isLoading } = useQuery({
    queryKey: ['biomarkers'],
    queryFn: api.biomarkers,
    enabled: !!user && open,
  });

  const toggle = useMutation({
    mutationFn: ({ slug, selected }: { slug: string; selected: boolean }) =>
      selected ? api.deselectBiomarker(slug) : api.selectBiomarker(slug),
    onSuccess: () => qc.invalidateQueries(),
  });

  // Пошук і за назвою, і за скороченням: у бланках лабораторій показник часто
  // підписаний саме абревіатурою (ЛПНЩ, ТТГ).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return biomarkers ?? [];
    return (biomarkers ?? []).filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.shortName?.toLowerCase().includes(q) ||
        b.category?.name.toLowerCase().includes(q),
    );
  }, [biomarkers, query]);

  // Групуємо за категорією, щоб довгий каталог читався: порядок категорій уже
  // задав бекенд (sortOrder адміна), тож просто зберігаємо порядок появи.
  const groups = useMemo(() => {
    const map = new Map<string, Biomarker[]>();
    for (const b of filtered) {
      const key = b.category?.name ?? t('addBiomarker.uncategorized');
      const list = map.get(key);
      if (list) list.push(b);
      else map.set(key, [b]);
    }
    return [...map];
  }, [filtered, t]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <div className="fixed inset-x-0 bottom-0 z-50 sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(480px,92vw)] sm:-translate-x-1/2 sm:-translate-y-1/2">
                <motion.div
                  className="flex max-h-[85dvh] flex-col rounded-t-2xl bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-card sm:max-h-[80vh] sm:rounded-2xl sm:p-6 sm:pb-6"
                  initial={isMobile ? { y: '100%' } : { opacity: 0, y: 12, scale: 0.98 }}
                  animate={isMobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
                  exit={isMobile ? { y: '100%' } : { opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                >
                  <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" />

                  <div className="mb-4 flex shrink-0 items-center justify-between">
                    <div className="min-w-0">
                      <Dialog.Title className="text-lg font-semibold">{t('addBiomarker.title')}</Dialog.Title>
                      <p className="mt-0.5 text-xs text-muted">{t('addBiomarker.subtitle')}</p>
                    </div>
                    <Dialog.Close asChild>
                      <Button variant="ghost" className="h-10 w-10 shrink-0 p-0 sm:h-8 sm:w-8">
                        <X size={18} />
                      </Button>
                    </Dialog.Close>
                  </div>

                  <div className="relative mb-3 shrink-0">
                    <Search
                      size={16}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                    />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t('addBiomarker.search')}
                      className="pl-9"
                    />
                  </div>

                  <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
                    {isLoading && <p className="py-6 text-center text-sm text-muted">{t('app.loading')}</p>}

                    {!isLoading && groups.length === 0 && (
                      <p className="py-6 text-center text-sm text-muted">
                        {query ? t('addBiomarker.notFound') : t('addBiomarker.emptyCatalog')}
                      </p>
                    )}

                    {groups.map(([category, items]) => (
                      <div key={category} className="mb-4 last:mb-0">
                        <p className="mb-1.5 px-1 text-[11px] uppercase tracking-wide text-muted">
                          {category}
                        </p>
                        <div className="space-y-1">
                          {items.map((b) => (
                            <button
                              key={b.slug}
                              type="button"
                              disabled={toggle.isPending}
                              onClick={() => toggle.mutate({ slug: b.slug, selected: b.selected })}
                              className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-paper disabled:opacity-60"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">{b.name}</span>
                                <span className="block truncate text-xs text-muted">{b.unit}</span>
                              </span>
                              {/* Обраний показник не ховаємо, а позначаємо:
                                  так повторний клік прибирає його з дашборда. */}
                              <span
                                className={
                                  b.selected
                                    ? 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white'
                                    : 'h-6 w-6 shrink-0 rounded-full border border-line'
                                }
                              >
                                {b.selected && <Check size={14} />}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {toggle.isError && (
                    <p className="mt-3 shrink-0 text-sm text-alert">
                      {t('addBiomarker.error')}
                    </p>
                  )}
                </motion.div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
