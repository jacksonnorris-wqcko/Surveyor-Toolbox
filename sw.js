/* Surveyor's Toolbox — update-aware service worker */
const CACHE_VERSION = 'surveyors-toolbox-iphone-v9-4';
const CACHE_PREFIX = 'surveyors-toolbox-iphone-';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './v8-workspace.js',
  './sw.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    // Install only succeeds when the complete new shell is available.
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_VERSION)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Always ask the network for page navigations so GitHub Pages changes appear
  // on the next open; retain the last good shell for offline use.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_VERSION);
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response && response.ok) {
          cache.put('./index.html', response.clone()).catch(() => {});
          return response;
        }
        return (await cache.match(request)) || (await cache.match('./index.html')) || response;
      } catch (error) {
        return (await cache.match(request)) || (await cache.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // Versioned app shell: use this worker's cache, falling back to network and
  // saving a successful response for offline use.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
      return response;
    } catch (error) {
      return Response.error();
    }
  })());
});
