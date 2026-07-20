import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/**
 * Чи є мережа. navigator.onLine — не істина в останній інстанції (Wi-Fi без
 * інтернету він вважає онлайном), але для «вимкнути кнопки запису й показати
 * стан» його достатньо, а самі запити однаково впадуть чесно.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true, // SSR/перший рендер: вважаємо, що мережа є
  );
}
