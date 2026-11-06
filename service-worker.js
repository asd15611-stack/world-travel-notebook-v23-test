// 世界旅記 V2.3 — only cache the app shell; traveler data stays in localStorage.
// A unique cache is built completely before activation; failed installs preserve the old worker.
const CACHE = 'world-travel-notebook-shell-v2-3-final-1';
const PREFIX = 'world-travel-notebook-shell-';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icons/icon-192.png', './icons/icon-512.png'];
const SCOPE = new URL(self.registration.scope);
const SHELL = new URL('./index.html', SCOPE).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      // Revalidate all files instead of trusting a potentially stale HTTP cache.
      await cache.addAll(CORE.map(path => new Request(new URL(path, SCOPE), {cache: 'reload'})));
      for (const path of CORE) {
        const response = await cache.match(new URL(path, SCOPE));
        if (!response || !response.ok) throw new Error('Missing pre-cached file: ' + path);
      }
      // The old service worker stays usable until every new asset has been cached.
      await self.skipWaiting();
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const shell = await cache.match(SHELL);
    if (!shell || !shell.ok) throw new Error('Offline shell unavailable');
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
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  const rootPath = SCOPE.pathname;
  const isEntry = url.pathname === rootPath || url.pathname === new URL('index.html', SCOPE).pathname;

  if (request.mode === 'navigate') {
    // Do not replace cached, validated shell with arbitrary fetched HTML.
    if (!isEntry) return;
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) return response;
      } catch (_) {}
      const cache = await caches.open(CACHE);
      return await cache.match(SHELL) || Response.error();
    })());
    return;
  }

  // Cached application assets are available offline; other in-scope files are fetched normally.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return await cache.match(request) || fetch(request);
  })());
});
