import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#16181D',
        muted: '#6B7180',
        paper: '#FBFBFC',
        surface: '#FFFFFF',
        line: '#E7E8EC',
        primary: { DEFAULT: '#0E7C86', soft: '#E1F1F2', ink: '#0A5A62' },
        normal: { DEFAULT: '#12805C', soft: '#E4F5EE' },
        alert: { DEFAULT: '#B45309', soft: '#FBEEDF' },
        // Зони інтерпретації тонші за бінарне «норма / поза нормою»: між ними
        // є «трохи не оптимально» (caution) і є «виражене відхилення» (danger).
        // Без цих двох усі дев'ять рівнів злиплися б у наявні normal/alert.
        caution: { DEFAULT: '#8A6D1F', soft: '#FAF3DF' },
        danger: { DEFAULT: '#B42318', soft: '#FDECEA' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.04), 0 4px 16px rgba(16,24,40,.04)',
      },
      borderRadius: { xl: '14px', '2xl': '18px' },
    },
  },
  plugins: [],
} satisfies Config;
