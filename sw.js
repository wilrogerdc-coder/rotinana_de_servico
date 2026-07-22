const CACHE_NAME = 'sgpo-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/rotina.html',
  '/telegrafia.html',
  '/oficiais.html',
  '/extras.html',
  '/admin.html',
  '/postos.html',
  '/historico.html',
  '/css/base.css',
  '/css/components.css',
  '/css/layout.css',
  '/css/dashboard.css',
  '/css/variables.css',
  '/js/utils.js',
  '/js/api.js',
  '/js/auth.js',
  '/js/sync.js',
  '/js/nav.js',
  '/assets/logos/bombeiros.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== location.origin) return;

  if (request.method !== 'GET') return;

  if (url.pathname.includes('/api/') || url.hostname.includes('script.google.com')) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
        }
        return response;
      }).catch(() => cached);

      return cached || networkFetch;
    })
  );
});
