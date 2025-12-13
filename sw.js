// Service Worker for Ledger Connect
const CACHE_NAME = 'ledger-connect-v5';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Navigation (HTML) - Network First, SPA Fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // If 404 (Not Found), return index.html (SPA Fallback)
          if (!response || response.status === 404) {
            return caches.match('./')
              .then(resp => resp || caches.match('./index.html'));
          }
          return response;
        })
        .catch(() => {
          // Offline -> Return cached root or index.html
          return caches.match('./')
            .then(resp => resp || caches.match('./index.html'));
        })
    );
    return;
  }

  // Assets (Cache First, Network Fallback)
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});