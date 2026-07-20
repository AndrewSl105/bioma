import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import * as path from 'node:path';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  // Версія збірки — buster для persist-кешу React Query. Свідомо версія
  // пакета, а не час збірки: інакше кожен рестарт vite стирав би збережені
  // дані. Міняється формат відповідей API — підніми version у package.json.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      // Оболонка оновлюється сама: у застосунку немає стану, який зламало б
      // тихе оновлення, тож просити користувача «оновіть вкладку» тут зайве.
      registerType: 'autoUpdate',
      includeAssets: ['logo.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Bioma — мої аналізи',
        short_name: 'Bioma',
        description: 'Динаміка аналізів і референсні межі в одному місці',
        lang: 'uk',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FBFBFC',
        theme_color: '#0E7C86',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // SPA: будь-який маршрут (/b/vitamin-d) offline віддає оболонку.
        navigateFallback: 'index.html',
        // …але НЕ для API. У деві /api ходить через проксі на тому ж origin,
        // тож без цього рядка offline-запит до API отримав би HTML оболонки
        // замість чесної мережевої помилки.
        navigateFallbackDenylist: [/^\/api\//],
        // Дані аналізів свідомо НЕ кешуємо service worker'ом: вони живуть на
        // іншому origin і потребують Authorization, тож у SW прилітали б
        // непрозорі (opaque) відповіді, у яких навіть статус не прочитати.
        // Offline-дані тримає React Query (див. main.tsx) — там вони
        // прив'язані до користувача і чистяться при виході.
        runtimeCaching: [
          {
            // Шрифти публічні й незмінні, тож кеш тут безпечний — і саме він
            // рятує вигляд застосунку offline (інакше падає на system-ui).
            urlPattern: ({ url }) =>
              url.origin === 'https://fonts.googleapis.com' ||
              url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      // У деві service worker вимкнено: інакше він кешує оболонку і ламає
      // звичайний цикл правок — найнеприємніший різновид «привидів».
      devOptions: { enabled: false },
    }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } },
  },
});
