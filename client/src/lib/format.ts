import type { Flag } from './api';

export function fmtNum(v: number, precision = 2): string {
  return v.toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: precision });
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const flagLabel: Record<Flag, string> = {
  LOW: 'Нижче норми',
  NORMAL: 'В нормі',
  HIGH: 'Вище норми',
  UNKNOWN: 'Немає референсу',
};

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
