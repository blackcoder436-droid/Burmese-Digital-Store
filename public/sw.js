// ==========================================
// Service Worker — Burmese Digital Store PWA
// Phase 10.2 — Offline shell + asset caching
// Strategy: Network-first for pages, Cache-first for static assets
// ==========================================

const CACHE_NAME = 'bd-store-v2';
const STATIC_CACHE = 'bd-static-v2';

// Static assets to pre-cache on install
const PRECACHE_URLS = [
  '/manifest.json',
  '/logo.jpg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Asset extensions to cache on fetch
const CACHEABLE_EXTENSIONS = ['.js', '.css', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg', '.woff2', '.woff'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  // Activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Claim all clients immediately
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip API routes, auth routes, and external requests
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/')) return;
  if (url.origin !== self.location.origin) return;

  // Static assets: Cache-first strategy
  const isStaticAsset =
    CACHEABLE_EXTENSIONS.some((ext) => url.pathname.endsWith(ext));

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML pages: Network-first with offline fallback
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            // Fallback to cached home page
            return caches.match('/');
          });
        })
    );
    return;
  }
});
