import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');

  return {
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    server: {
      port: 5173,
      proxy: {
        '/api': { target: 'http://localhost:3001', changeOrigin: true },
        // Neon Auth через same-origin: сесійна cookie стає first-party,
        // інакше Firefox/Safari ріжуть її як сторонню і /token віддає 401.
        ...(env.NEON_AUTH_PROXY_TARGET
          ? {
              '/neondb/auth': {
                target: env.NEON_AUTH_PROXY_TARGET,
                changeOrigin: true,
                secure: true,
              },
            }
          : {}),
      },
    },
  };
});
