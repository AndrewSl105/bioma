/** Однакове пояснення на всіх вимкнених offline діях. */
export const OFFLINE_HINT = 'Недоступно без мережі';

/**
 * «Дані від …» — коли саме ми востаннє достукались до сервера.
 * Показуємо лише offline: онлайн це шум, бо дані свіжі за визначенням.
 */
export function formatSyncedAt(updatedAt: number): string | null {
  if (!updatedAt) return null;

  const diffMin = Math.floor((Date.now() - updatedAt) / 60_000);
  if (diffMin < 1) return 'щойно';
  if (diffMin < 60) return `${diffMin} хв тому`;

  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} год тому`;

  return new Date(updatedAt).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}
