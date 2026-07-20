import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { AuthProvider } from './lib/auth';
import { persister, shouldDehydrateQuery, PERSIST_MAX_AGE } from './lib/persist';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // gcTime мусить перекривати вік persist-кешу: інакше React Query
      // викине відновлені запити з пам'яті ще до того, як їх хтось покаже,
      // і offline-старт віддав би порожній екран замість збережених даних.
      gcTime: PERSIST_MAX_AGE,
      retry: (failureCount, error) => {
        // 401 ретраїти безглуздо (потрібен перелогін) — інакше шторм запитів.
        if ((error as { status?: number })?.status === 401) return false;
        // Offline теж не молотимо: повтори без мережі лише палять батарею,
        // а показати ми все одно маємо збережені дані, а не спінер.
        if (!navigator.onLine) return false;
        return failureCount < 2;
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: PERSIST_MAX_AGE,
          // Після деплою формат відповідей міг змінитись — версія збірки як
          // buster прибирає несумісний кеш замість того, щоб малювати кашу.
          buster: __APP_VERSION__,
          dehydrateOptions: { shouldDehydrateQuery },
        }}
      >
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </PersistQueryClientProvider>
    </AuthProvider>
  </React.StrictMode>,
);
