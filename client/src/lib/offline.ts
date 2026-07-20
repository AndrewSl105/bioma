import i18n from '@/i18n';
import { fmtDateTime } from './format';

/**
 * Однакове пояснення на всіх вимкнених offline діях.
 *
 * Функція, а не константа: константа обчислилась би раз при імпорті модуля й
 * назавжди застигла мовою, активною на той момент.
 */
export const offlineHint = () => i18n.t('offline.hint');

/**
 * «Дані від …» — коли саме ми востаннє достукались до сервера.
 * Показуємо лише offline: онлайн це шум, бо дані свіжі за визначенням.
 *
 * Рядки беремо з i18n напряму, а не через хук: функція викликається і поза
 * React-деревом, а підпис однаково має бути мовою інтерфейсу.
 */
export function formatSyncedAt(updatedAt: number): string | null {
  if (!updatedAt) return null;

  const diffMin = Math.floor((Date.now() - updatedAt) / 60_000);
  if (diffMin < 1) return i18n.t('offline.justNow');
  if (diffMin < 60) return i18n.t('offline.minutesAgo', { count: diffMin });

  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return i18n.t('offline.hoursAgo', { count: diffH });

  return fmtDateTime(updatedAt);
}
