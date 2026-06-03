// TV IA Control · Service Worker
// Cache-first for app shell, network-first for WebSocket (bypassed)

const CACHE_NAME = 'tv-ia-control-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install: pre-cache app shell
self.addEventListener('install', ev => {
  self.skipWaiting();
  ev.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL).catch(() => {}))
  );
});

// Activate: remove old caches
self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for app shell assets
self.addEventListener('fetch', ev => {
  // Skip non-GET and WebSocket requests
  if (ev.request.method !== 'GET') return;
  if (ev.request.url.startsWith('ws://') || ev.request.url.startsWith('wss://')) return;

  ev.respondWith(
    caches.match(ev.request).then(cached => {
      if (cached) return cached;
      return fetch(ev.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(ev.request, clone));
        return response;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
