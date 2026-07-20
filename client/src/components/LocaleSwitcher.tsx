import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { useLocale } from '@/lib/useLocale';
import { SUPPORTED_LOCALES, LOCALE_LABELS, type Locale } from '@/i18n';
import { cn } from '@/lib/cn';

/**
 * Перемикач мови в шапці.
 *
 * Мов лише дві, тож це нативний select у обгортці, а не власний дропдаун:
 * на мобільному системний picker зручніший за будь-який саморобний, і тут
 * він якраз доречний — на відміну від довгих списків у формах.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();

  return (
    <label
      className={cn(
        'relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted',
        'transition-colors hover:bg-line/40 hover:text-ink focus-within:ring-2 focus-within:ring-primary/40',
        className,
      )}
      title={t('app.language')}
    >
      <Languages size={16} className="pointer-events-none" />
      <span className="sr-only">{t('app.language')}</span>
      {/* Прозорий select поверх іконки: зберігає нативний picker і тач-ціль
          44px, не тягнучи за собою десктопний вигляд системного контрола. */}
      <select
        value={locale}
        onChange={(e) => void setLocale(e.target.value as Locale)}
        className="absolute inset-0 cursor-pointer appearance-none bg-transparent text-transparent opacity-0"
      >
        {SUPPORTED_LOCALES.map((l) => (
          <option key={l} value={l} className="text-ink">
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
