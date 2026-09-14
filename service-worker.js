// ChurchTech PWA - Service Worker
// Enables offline functionality, fast caching, and instant version updates

const CACHE_VERSION = 'v1.0.3-20260914';
const CACHE_NAME = `churchtech-cache-${CACHE_VERSION}`;

const URLS_TO_CACHE = [
  './',
  './index.html',
  './editor.html',
  './settings.html',
  './styles.css',
  './manifest.json',
  './config.js',
  './js/db.js',
  './js/categories.js',
  './js/prompts.js',
  './js/api.js',
  './js/gdrive.js',
  './js/utils.js',
  './js/app.js',
  './js/editor.js',
  './js/settings.js',
  './icons/icon-72x72.png',
  './icons/icon-96x96.png',
  './icons/icon-128x128.png',
  './icons/icon-144x144.png',
  './icons/icon-152x152.png',
  './icons/icon-192x192.png',
  './icons/icon-384x384.png',
  './icons/icon-512x512.png'
];

// Install event - Cache all essential files
self.addEventListener('install', (event) => {
  console.log('[ChurchTech SW] Installing version:', CACHE_VERSION);

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ChurchTech SW] Caching application assets');
        return cache.addAll(URLS_TO_CACHE);
      })
      .catch((error) => {
        console.error('[ChurchTech SW] Cache install error:', error);
      })
  );

  // Force active immediately
  self.skipWaiting();
});

// Activate event - Purge older caches
self.addEventListener('activate', (event) => {
  console.log('[ChurchTech SW] Activating version:', CACHE_VERSION);

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName.startsWith('churchtech-cache-')) {
            console.log('[ChurchTech SW] Deleting obsolete cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch event - Smart network-first for pages, cache-first with network fallback for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Non-GET requests (e.g. OpenAI / Google Webhook POSTs) must bypass SW cache
  if (request.method !== 'GET') {
    return;
  }

  // Cross-origin requests bypass SW cache
  if (url.origin !== location.origin) {
    return;
  }

  // For HTML documents: Network first, fall back to cache
  if (request.headers.get('accept') && request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => cached || caches.match('./index.html'));
        })
    );
    return;
  }

  // For other static assets (CSS, JS, images): Stale-while-revalidate or Cache first
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
        }
        return networkResponse;
      }).catch((err) => {
        // Network failed; cached response will be returned if available
        return null;
      });

      return cachedResponse || fetchPromise;
    })
  );
});

// Message listener for skip waiting and reload triggers from settings UI
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    console.log('[ChurchTech SW] Received SKIP_WAITING signal');
    self.skipWaiting();
  }

  if (event.data.type === 'CLEAR_CACHE') {
    console.log('[ChurchTech SW] Clearing all caches');
    event.waitUntil(
      caches.keys().then((keys) => {
        return Promise.all(keys.map((key) => caches.delete(key)));
      }).then(() => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: true });
        }
      })
    );
  }

  if (event.data.type === 'CHECK_VERSION') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ version: CACHE_VERSION, cacheName: CACHE_NAME });
    }
  }
});
