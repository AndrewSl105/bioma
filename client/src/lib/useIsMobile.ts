import { useEffect, useState } from 'react';

const QUERY = '(max-width: 639px)'; // < Tailwind sm

/**
 * Чи зараз мобільний брейкпоінт.
 * Ініціалізується синхронно — щоб перший кадр анімації шторки
 * не програвався десктопним варіантом.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(QUERY).matches);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
