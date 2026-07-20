import type { BandLevel } from './api';

/**
 * Подача зон інтерпретації.
 *
 * Дев'ять рівнів зводяться до чотирьох ступенів вираженості: окремий колір на
 * кожен рівень людина однаково не розрізнить, а от «добре / трохи не так /
 * відхилення / виражене відхилення» читається з першого погляду.
 *
 * Колір НЕ є єдиним носієм сенсу: поруч завжди йде підпис зони, тож при
 * дальтонізмі чи ч/б друку інформація не втрачається.
 */
export type ZoneSeverity = 'good' | 'mild' | 'warn' | 'severe';

const SEVERITY: Record<BandLevel, ZoneSeverity> = {
  OPTIMAL: 'good',
  NORMAL: 'good',
  BELOW_OPTIMAL: 'mild',
  ABOVE_OPTIMAL: 'mild',
  LOW: 'warn',
  HIGH: 'warn',
  DEFICIENT: 'severe',
  VERY_HIGH: 'severe',
  CRITICAL: 'severe',
};

export function zoneSeverity(level: BandLevel): ZoneSeverity {
  return SEVERITY[level] ?? 'mild';
}

/** Класи для бейджа зони. */
export function zoneColor(level: BandLevel): { text: string; bg: string; dot: string } {
  switch (zoneSeverity(level)) {
    case 'good':
      return { text: 'text-normal', bg: 'bg-normal-soft', dot: 'bg-normal' };
    case 'mild':
      return { text: 'text-caution', bg: 'bg-caution-soft', dot: 'bg-caution' };
    case 'warn':
      return { text: 'text-alert', bg: 'bg-alert-soft', dot: 'bg-alert' };
    case 'severe':
      return { text: 'text-danger', bg: 'bg-danger-soft', dot: 'bg-danger' };
  }
}

/**
 * Заливка смуги на графіку. Hex, а не клас Tailwind: recharts малює SVG і
 * приймає колір значенням, до класів там дістатись нічим.
 */
export function zoneFill(level: BandLevel): string {
  switch (zoneSeverity(level)) {
    case 'good':
      return '#12805C';
    case 'mild':
      return '#8A6D1F';
    case 'warn':
      return '#B45309';
    case 'severe':
      return '#B42318';
  }
}
