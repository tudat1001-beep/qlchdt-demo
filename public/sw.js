/**
 * QLCHDT Service Worker - Installable Online-First PWA
 * Caches app shell & static assets only.
 * NEVER caches or queues API mutations, and never claims offline financial writes succeeded.
 */

const CACHE_NAME = 'qlchdt-shell-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.svg',
  '/icon-512.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key.startsWith('qlchdt-') && key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. API requests or any mutating methods (POST, PATCH, PUT, DELETE)
  // NEVER cache API requests or mutations; never mock success offline.
  if (url.pathname.startsWith('/api') || event.request.method !== 'GET') {
    // Pass straight to network without caching or queuing.
    // If the client is offline, the browser's fetch will naturally fail with a network error.
    return;
  }

  // 2. Static assets & SPA navigation (App shell only)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache if online
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {
            // Offline - ignore background refresh failure
          });
        return cachedResponse;
      }

      // Fetch from network and cache
      return fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (event.request.destination === 'script' ||
              event.request.destination === 'style' ||
              event.request.destination === 'image' ||
              event.request.destination === 'font' ||
              url.pathname.endsWith('.js') ||
              url.pathname.endsWith('.css') ||
              url.pathname.endsWith('.svg') ||
              url.pathname.endsWith('.png'))
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline and navigating to a page, serve cached index.html
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Ngoại tuyến: Tài nguyên không có sẵn trong bộ nhớ đệm.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        });
    })
  );
});
