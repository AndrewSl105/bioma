import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, EyeOff, Pencil, Plus, X } from 'lucide-react';
import { api, type Category, type CategoryInput } from '@/lib/api';
import { SUPPORTED_LOCALES, LOCALE_LABELS, type Locale } from '@/i18n';
import { Button, Card, Field, Input } from '@/components/ui/primitives';

/**
 * Керування категоріями: створення, переклади, порядок, деактивація.
 *
 * Порядок міняється кнопками вгору/вниз, а не drag-and-drop: на тач-екрані
 * перетягування конфліктує зі скролом сторінки, а категорій тут десяток —
 * дві кнопки з великою тач-ціллю дають той самий результат надійніше.
 */
export function AdminCategoriesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Category | 'new' | null>(null);

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: api.categories,
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => api.reorderCategories(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });

  function move(index: number, delta: number) {
    if (!categories) return;
    const target = index + delta;
    if (target < 0 || target >= categories.length) return;
    const next = [...categories];
    [next[index], next[target]] = [next[target], next[index]];
    reorder.mutate(next.map((c) => c.id));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold">{t('admin.categories')}</h1>
          <p className="mt-1 text-sm text-muted">{t('admin.categoriesHint')}</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setEditing('new')}>
          <Plus size={17} /> {t('admin.addCategory')}
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted">{t('app.loading')}</p>}

      {categories?.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted">{t('admin.noCategories')}</Card>
      )}

      <div className="space-y-2">
        {categories?.map((c, i) => (
          <Card key={c.id} className={`p-3 ${c.isActive ? '' : 'opacity-60'}`}>
            <div className="flex items-center gap-2">
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  aria-label={t('admin.moveUp')}
                  disabled={i === 0 || reorder.isPending}
                  onClick={() => move(i, -1)}
                  className="inline-flex h-6 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-line/40 hover:text-ink disabled:opacity-30"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  aria-label={t('admin.moveDown')}
                  disabled={i === categories.length - 1 || reorder.isPending}
                  onClick={() => move(i, 1)}
                  className="inline-flex h-6 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-line/40 hover:text-ink disabled:opacity-30"
                >
                  <ArrowDown size={14} />
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.name}</p>
                <p className="truncate text-xs text-muted">
                  {c.slug} · {t('admin.markerCount', { count: c.biomarkerCount })}
                  {!c.isActive && ` · ${t('admin.inactive')}`}
                </p>
              </div>

              <Button
                variant="ghost"
                aria-label={t('admin.edit')}
                className="h-11 w-11 shrink-0 p-0"
                onClick={() => setEditing(c)}
              >
                <Pencil size={15} />
              </Button>
              <Button
                variant="ghost"
                aria-label={t('admin.deactivate')}
                className="h-11 w-11 shrink-0 p-0"
                disabled={!c.isActive || remove.isPending}
                onClick={() => remove.mutate(c.id)}
              >
                <EyeOff size={15} />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <CategoryForm
          category={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function CategoryForm({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  // canonicalName, а не name: у name лежить уже локалізована назва, і
  // збереження форми затерло б нею англійський канон.
  const [name, setName] = useState(category?.canonicalName ?? '');
  const [imageKey, setImageKey] = useState('');
  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      SUPPORTED_LOCALES.map((l) => [
        l,
        category?.translations?.find((tr) => tr.locale === l)?.name ?? '',
      ]),
    ),
  );

  const save = useMutation({
    mutationFn: (body: CategoryInput) =>
      category ? api.updateCategory(category.id, body) : api.createCategory(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      onClose();
    },
  });

  function submit() {
    save.mutate({
      name: name.trim(),
      imageKey: imageKey.trim() || undefined,
      // Порожні переклади не шлемо: бекенд валідує name як непорожній, і
      // незаповнена мова інакше валила б збереження всієї форми.
      translations: SUPPORTED_LOCALES.filter((l) => names[l]?.trim()).map((l) => ({
        locale: l,
        name: names[l].trim(),
      })),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 backdrop-blur-sm sm:items-center">
      <Card className="max-h-[88dvh] w-full overflow-y-auto rounded-b-none p-5 sm:max-w-md sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {category ? t('admin.editCategory') : t('admin.addCategory')}
          </h2>
          <Button variant="ghost" className="h-10 w-10 p-0" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>

        <div className="space-y-4">
          <Field label={t('admin.canonicalName')}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lipids" />
          </Field>

          {SUPPORTED_LOCALES.map((l) => (
            <Field key={l} label={`${t('admin.nameIn')} ${LOCALE_LABELS[l as Locale]}`}>
              <Input
                value={names[l] ?? ''}
                onChange={(e) => setNames((prev) => ({ ...prev, [l]: e.target.value }))}
              />
            </Field>
          ))}

          <Field label={t('admin.imageKey')}>
            <Input
              value={imageKey}
              onChange={(e) => setImageKey(e.target.value)}
              placeholder="categories/lipids.jpg"
            />
          </Field>

          {save.isError && <p className="text-sm text-alert">{t('admin.saveError')}</p>}

          <Button className="w-full" disabled={!name.trim() || save.isPending} onClick={submit}>
            {save.isPending ? t('addResult.saving') : t('admin.save')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
