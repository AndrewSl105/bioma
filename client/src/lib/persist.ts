import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { Query } from '@tanstack/react-query';

/** Ключ сховища винесено, щоб вихід із акаунта міг його прибрати. */
export const PERSIST_KEY = 'bioma:query-cache';

/** Скільки часу offline-дані вважаємо придатними до показу. */
export const PERSIST_MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 днів

/**
 * Дані аналізів — медичні, і тут вони лягають на диск пристрою.
 * Тому вихід з акаунта мусить їх стирати: інакше на спільному ноутбуці
 * наступний користувач побачить чужі показники просто з localStorage.
 */
export function clearPersistedCache() {
  try {
    window.localStorage.removeItem(PERSIST_KEY);
  } catch {
    // Приватний режим / вимкнене сховище — нічого чистити.
  }
}

export const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: PERSIST_KEY,
});

/**
 * Що саме зберігати на диск.
 *
 * Тільки успішні запити на читання. `profile.ensure` свідомо пропускаємо:
 * це запис (POST), і закешований «успіх» означав би, що після
 * перевстановлення застосунку профіль ніколи не створиться повторно.
 */
export function shouldDehydrateQuery(query: Query) {
  if (query.state.status !== 'success') return false;
  const [root, sub] = query.queryKey as string[];
  return !(root === 'profile' && sub === 'ensure');
}
