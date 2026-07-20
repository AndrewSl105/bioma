import { useTranslation } from 'react-i18next';
import type { Flag, Zone } from '@/lib/api';
import { Badge } from '@/components/ui/primitives';
import { flagColor } from '@/lib/format';
import { zoneColor } from '@/lib/zones';

/**
 * Бейдж стану значення: зона, якщо вона є, інакше — прапорець.
 *
 * Одним компонентом на всі екрани свідомо: дашборд, сторінка показника й
 * історія мають підписувати значення однаково, а розкидані по трьох файлах
 * тернарники «zone ?? flag» розповзаються при першій же правці.
 *
 * Смуги задані не в кожного показника (напр. ЛПВЩ їх не має) — тоді zone
 * приходить null, і бейдж чесно відкочується на бінарне «в нормі / поза
 * нормою», а не зникає.
 */
export function ZoneBadge({
  zone,
  flag,
  className,
}: {
  zone: Zone | null;
  flag: Flag;
  className?: string;
}) {
  const { t } = useTranslation();

  if (zone) {
    const c = zoneColor(zone.level);
    return (
      // Підпис зони — авторський текст із каталогу, він точніший за назву
      // рівня («ціль високого ризику» замість просто «норма»). Рівень іде в
      // title/aria: він локалізований і зрозумілий без контексту каталогу.
      <Badge className={`${c.bg} ${c.text} ${className ?? ''}`}>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.dot}`} />
        <span className="truncate" title={t(`zone.${zone.level}`)}>
          {zone.label}
        </span>
      </Badge>
    );
  }

  const fc = flagColor(flag);
  return (
    <Badge className={`${fc.bg} ${fc.text} ${className ?? ''}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${fc.dot}`} />
      {t(`flag.${flag}`)}
    </Badge>
  );
}
