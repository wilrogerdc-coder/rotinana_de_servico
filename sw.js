const CACHE_NAME = 'sgpo-v9';
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
  '/js/dashboard.js',
  '/js/rotina.js',
  '/assets/logos/bombeiros.svg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== location.origin) return;
  if (request.method !== 'GET') return;
  if (url.pathname.includes('/api/') || url.hostname.includes('script.google.com')) return;

  // Network-first com fallback para cache:
  // Garante que atualizações de código e interface apareçam imediatamente para o usuário,
  // mantendo funcionamento offline total quando a conexão estiver indisponível.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});
