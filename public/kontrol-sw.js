const KONTROL_CACHE = 'apex-kontrol-v2';
const KONTROL_ASSETS = [
  '/kontrol',
  '/kontrol/index.html',
  '/kontrol-manifest.webmanifest',
  '/kontrol-192x192.png',
  '/kontrol-512x512.png',
  '/kontrol-maskable-512x512.png',
  '/kontrol-apple-touch-icon.png',
  '/kontrol-icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(KONTROL_CACHE).then((cache) => cache.addAll(KONTROL_ASSETS)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k.startsWith('apex-kontrol-') && k !== KONTROL_CACHE).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  const isKontrolPath =
    url.pathname === '/kontrol' ||
    url.pathname.startsWith('/kontrol/') ||
    url.pathname.startsWith('/kontrol-') ||
    url.pathname.startsWith('/assets/');

  if (!isKontrolPath) {
    return;
  }

  // Network-first so Chrome always receives latest UI when online, falling back to cache offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((res) => {
          const clone = res.clone();
          caches.open(KONTROL_CACHE).then((cache) => cache.put('/kontrol/index.html', clone)).catch(() => undefined);
          return res;
        })
        .catch(() => caches.match('/kontrol/index.html').then((r) => r || caches.match('/kontrol')))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(KONTROL_CACHE).then((cache) => cache.put(event.request, clone)).catch(() => undefined);
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
