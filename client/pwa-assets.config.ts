import { defineConfig } from '@vite-pwa/assets-generator/config';

/**
 * Генерує іконки PWA з assets-source/pwa-source.svg (`npm run pwa:icons`).
 * Джерело лежить поза public/ навмисно: інакше воно потрапляло б у збірку
 * і в precache service worker'а, хоч у рантаймі не потрібне.
 *
 * padding: 0 — свідомо. Джерело вже містить і непрозорий фон, і запас під
 * безпечну зону maskable (див. коментар у самому SVG). Стандартний пресет
 * додавав свій відступ поверх нашого: логотип зменшувався, а по краях
 * лишалася прозорість — тобто рівно ті чорні кути під маскою Android,
 * яких maskable-іконка має уникати.
 */
const background = '#FBFBFC'; // colors.paper

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']], padding: 0 },
    maskable: { sizes: [512], padding: 0, resizeOptions: { background } },
    apple: { sizes: [180], padding: 0, resizeOptions: { background } },
  },
  images: ['assets-source/pwa-source.svg'],
});
