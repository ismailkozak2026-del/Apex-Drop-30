import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './shared/AppBoundary';

// Ensure Chrome never serves stale Service Worker caches:
// - In DEV: unregister any leftover root SW/Workbox caches and reload once if an old SW was active.
// - In PROD: auto-update SW and reload once on controllerchange when a new build activates.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker
      .getRegistrations()
      .then(async (regs) => {
        let removedAny = false;
        for (const reg of regs) {
          if (!reg.scope.includes('/kontrol')) {
            const ok = await reg.unregister();
            if (ok) removedAny = true;
          }
        }
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(
            keys
              .filter((k) => !k.startsWith('apex-kontrol-'))
              .map((k) => caches.delete(k))
          );
        }
        if ((hadController || removedAny) && !sessionStorage.getItem('apex_dev_sw_purged')) {
          sessionStorage.setItem('apex_dev_sw_purged', '1');
          window.location.reload();
        }
      })
      .catch(() => undefined);
  } else {
    let refreshing = false;
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        void updateSW(true);
      },
      onRegisteredSW(_swUrl, registration) {
        if (registration) {
          void registration.update().catch(() => undefined);
          window.setInterval(() => {
            void registration.update().catch(() => undefined);
          }, 30_000);
        }
      },
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary title="APEX DROP 30 Hatası">
    <App />
  </ErrorBoundary>
);
