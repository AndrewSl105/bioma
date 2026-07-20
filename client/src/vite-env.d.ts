/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Версія з package.json; підставляє vite.config (define). */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_NEON_AUTH_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
