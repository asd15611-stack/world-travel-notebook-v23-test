// World Travel Notebook — cache app shell only; traveler data stays in localStorage.
const CACHE = 'world-travel-notebook-shell-v2-2-0';
const PREFIX = 'world-travel-notebook-shell-';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icons/icon-192.png', './icons/icon-512.png'];
const SHELL = new URL('./index.html', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      await cache.addAll(CORE);
      if (!await cache.match(SHELL)) throw new Error('App shell missing after pre-cache');
      await self.skipWaiting();
    } catch (error) {
      await caches.delete(CACHE); // do not remove a prior version
      throw error;
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    if (!await cache.match(SHELL)) throw new Error('App shell missing');
    const names = await caches.keys();
    for (const name of names) {
      if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        // Network first, but never overwrite a verified offline shell with another HTML page.
        return await fetch(request);
      } catch (_) {
        // Only the app entry paths are eligible for shell fallback.
        const path = url.pathname;
        const rootPath = scope.pathname;
        if (path !== rootPath && path !== new URL('index.html', scope).pathname) return Response.error();
        const cache = await caches.open(CACHE);
        return await cache.match(SHELL) || Response.error();
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return await cache.match(request) || fetch(request);
  })());
});