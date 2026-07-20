import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { isSupportedLocale, DEFAULT_LOCALE, type Locale } from '@/i18n';

/**
 * Поточна мова + її перемикання.
 *
 * Зміна мови тут — це три речі, і жодну не можна пропустити:
 *   1. i18next — статичні підписи інтерфейсу;
 *   2. інвалідація кешу — назви маркерів і категорій приходять З СЕРВЕРА, тож
 *      без неї на екрані лишилися б назви попередньою мовою;
 *   3. PATCH /profile — щоб вибір пережив інший пристрій і новий вхід.
 *
 * Збереження в localStorage робить сам i18next (detection.caches), і саме звідти
 * api.ts бере локаль для заголовка X-Locale.
 */
export function useLocale() {
  const { i18n } = useTranslation();
  const qc = useQueryClient();

  const locale: Locale = isSupportedLocale(i18n.resolvedLanguage)
    ? i18n.resolvedLanguage
    : DEFAULT_LOCALE;

  const setLocale = useCallback(
    async (next: Locale) => {
      if (next === locale) return;
      await i18n.changeLanguage(next);

      // Спершу дані, потім сервер: інтерфейс має перемкнутися одразу, не чекаючи
      // на мережу. Впав PATCH — мова однаково змінилась і збережена локально.
      await qc.invalidateQueries();

      try {
        await api.updateProfile({ locale: next });
      } catch {
        // Мовчки: вибір уже застосований і збережений локально, а падати
        // діалогом помилки через несинхронізовану налаштунку — надмірно.
      }
    },
    [i18n, locale, qc],
  );

  return { locale, setLocale };
}
