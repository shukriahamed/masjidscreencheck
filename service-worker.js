/**
 * service-worker.js
 * Provides offline caching for the Masjid Display System.
 *
 * IMPORTANT: Service Workers only work on localhost or HTTPS.
 * Opening index.html via file:// will NOT activate offline caching.
 * Run with: npx serve . OR python -m http.server 8080
 */

const CACHE_NAME  = 'masjid-display-v6';
const STATIC_ASSETS = [
  './',
  './index.html',
  './admin.html',
  './css/style.css',
  './css/admin.css',
  './css/layouts.css',
  './css/screens.css',
  './css/themes.css',
  './css/responsive.css',
  './js/app.js',
  './js/admin.js',
  './js/clock.js',
  './js/prayer-times.js',
  './js/countdown.js',
  './js/athan.js',
  './js/globe.js',
  './js/ticker.js',
  './js/slideshow.js',
  './js/jummah.js',
  './js/offline.js',
  './js/storage.js',
  './manifest.json',
  './assets/icons/mosque-icon.svg',
  './assets/images/default-bg.svg',
  './assets/images/default-logo.svg',
  './assets/images/straighten-shaf.png',
];

// Install: pre-cache all static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching assets...');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
  console.log('[SW] Activated. Controlling all clients.');
});

// Fetch: Cache-first strategy for static assets
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Never cache the API (settings/uploads must always be live)
  if (new URL(event.request.url).pathname.startsWith('/api/')) return;

  // Network-first for navigation (HTML pages)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Cache-first for all other assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful responses dynamically
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Return offline fallback for pages
      if (event.request.destination === 'document') {
        return caches.match('./index.html');
      }
    })
  );
});

// Background sync for prayer times (future enhancement)
self.addEventListener('sync', (event) => {
  if (event.tag === 'prayer-sync') {
    console.log('[SW] Background sync: prayer-sync');
  }
});
