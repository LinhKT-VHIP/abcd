const CACHE_NAME = 'material-master-v1';
const ASSETS_TO_CACHE = [
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './assets/css/styles.css',
  './assets/js/app.js',
  './assets/js/material-rules.js',
  './assets/js/cloud-bridge.js',
  './assets/js/barcode.js',
  './assets/data/config.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
