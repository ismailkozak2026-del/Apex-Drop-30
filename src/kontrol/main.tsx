import { createRoot } from 'react-dom/client';
import '../index.css';
import { ErrorBoundary } from '../shared/AppBoundary';
import KontrolApp from './KontrolApp';

// Register separate /kontrol Service Worker strictly scoped to /kontrol
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/kontrol-sw.js', { scope: '/kontrol' })
      .catch((err) => console.warn('Kontrol SW registration failed:', err));
  });
}

createRoot(document.getElementById('kontrol-root')!).render(
  <ErrorBoundary title="APEX DROP 30 KONTROL Hatası">
    <KontrolApp />
  </ErrorBoundary>
);
