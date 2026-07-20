import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/primitives';

export function AdminCategoriesPage() {
  const { t } = useTranslation();

  return (
    <Card className="p-6">
      <h1 className="font-display text-xl font-bold">{t('admin.categories')}</h1>
      <p className="mt-1 text-sm text-muted">{t('admin.categoriesHint')}</p>
    </Card>
  );
}
