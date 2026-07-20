import type { Flag } from './api';
import { currentLocale } from '@/i18n';

/**
 * Форматування чисел і дат бере активну локаль, а не зашите 'uk-UA': в
 * англійській версії українські назви місяців і кома як десятковий роздільник
 * виглядали б як помилка рендера.
 *
 * flagLabel тут більше немає — підписи «В нормі»/«Вище норми» переїхали у
 * словники i18n, бо це такий самий текст інтерфейсу, як і решта.
 */
export function fmtNum(v: number, precision = 2): string {
  return v.toLocaleString(currentLocale(), {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision,
  });
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(currentLocale(), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function fmtDateTime(ms: number): string {
  return new Date(ms).toLocaleDateString(currentLocale(), {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function flagColor(flag: Flag): { text: string; bg: string; dot: string } {
  switch (flag) {
    case 'NORMAL':
      return { text: 'text-normal', bg: 'bg-normal-soft', dot: 'bg-normal' };
    case 'LOW':
    case 'HIGH':
      return { text: 'text-alert', bg: 'bg-alert-soft', dot: 'bg-alert' };
    default:
      return { text: 'text-muted', bg: 'bg-line/40', dot: 'bg-muted' };
  }
}
