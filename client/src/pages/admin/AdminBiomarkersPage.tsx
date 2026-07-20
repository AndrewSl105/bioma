import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus, Search } from 'lucide-react';
import { api, type AdminBiomarker } from '@/lib/api';
import { Button, Card, Input } from '@/components/ui/primitives';
import { Select } from '@/components/ui/Select';
import { BiomarkerForm } from './BiomarkerForm';

/** Керування каталогом біомаркерів: пошук, фільтр за категорією, редагування. */
export function AdminBiomarkersPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [editing, setEditing] = useState<AdminBiomarker | 'new' | null>(null);

  const { data: biomarkers, isLoading } = useQuery({
    queryKey: ['biomarkers', 'admin'],
    queryFn: api.adminBiomarkers,
  });
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: api.categories });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (biomarkers ?? []).filter((b) => {
      if (categoryId && b.category?.id !== categoryId) return false;
      if (!q) return true;
      // Шукаємо і за локалізованою назвою, і за каноном: адмін тримає в
      // голові радше англійський оригінал, а бачить у списку переклад.
      return (
        b.name.toLowerCase().includes(q) ||
        b.canonicalName.toLowerCase().includes(q) ||
        b.slug.includes(q)
      );
    });
  }, [biomarkers, query, categoryId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold">{t('admin.biomarkers')}</h1>
          <p className="mt-1 text-sm text-muted">{t('admin.biomarkersHint')}</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setEditing('new')}>
          <Plus size={17} /> {t('admin.addBiomarker')}
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('admin.searchBiomarker')}
            className="pl-9"
          />
        </div>
        <Select
          value={categoryId}
          onChange={setCategoryId}
          placeholder={t('admin.allCategories')}
          className="sm:w-56"
          options={[
            { value: '', label: t('admin.allCategories') },
            ...(categories ?? []).map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      </div>

      {isLoading && <p className="text-sm text-muted">{t('app.loading')}</p>}

      {!isLoading && filtered.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted">{t('admin.noBiomarkers')}</Card>
      )}

      <div className="space-y-2">
        {filtered.map((b) => (
          <Card key={b.slug} className={`p-3 ${b.isActive ? '' : 'opacity-60'}`}>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{b.name}</p>
                <p className="truncate text-xs text-muted">
                  {b.unit}
                  {b.category && ` · ${b.category.name}`}
                  {/* Локалі контенту одразу в списку: інакше «де вже є довідка»
                      можна дізнатись лише відкривши кожен маркер. */}
                  {/* ?? [] — запис міг прийти з persist-кешу, збереженого до
                      появи цього поля; без цього рядок падав би на .length. */}
                  {(b.contentLocales ?? []).length > 0 && ` · ${b.contentLocales.join('/')}`}
                  {!b.isActive && ` · ${t('admin.inactive')}`}
                </p>
              </div>
              <Button
                variant="ghost"
                aria-label={t('admin.edit')}
                className="h-11 w-11 shrink-0 p-0"
                onClick={() => setEditing(b)}
              >
                <Pencil size={15} />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <BiomarkerForm
          biomarker={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
