'use strict';
/* Sushi Train Track service worker.
   - The page itself is "network first": you always get the newest version when there is signal,
     and the saved copy when there is none (or the connection is too slow to wait for).
   - Icons and the manifest are served from the cache and refreshed in the background.
   - VERSION is stamped with the git commit by update.sh, so every deploy changes this file and
     phones notice the update. */
const VERSION = 'dev';
const APP_CACHE = 'stt-app-' + VERSION;
const FONT_CACHE = 'stt-fonts-v1';
const PAGE = './index.html';
const PRECACHE = [PAGE, './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const NAV_TIMEOUT_MS = 3500;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(APP_CACHE)
      .then(c => c.addAll(PRECACHE.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('stt-app-') && k !== APP_CACHE) await caches.delete(k);
    await self.clients.claim();
    // tell any open page which version is now active, so it can offer a reload if it is out of date
    for (const c of await self.clients.matchAll({ includeUncontrolled: true })) c.postMessage({ type: 'sw-version', version: VERSION });
  })());
});

async function pageNetworkFirst() {
  const cache = await caches.open(APP_CACHE);
  const net = fetch(new URL(PAGE, self.location).href, { cache: 'no-cache' }).then(res => {
    if (res.ok) cache.put(PAGE, res.clone());
    return res;
  });
  const timer = new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), NAV_TIMEOUT_MS));
  try {
    return await Promise.race([net, timer]);
  } catch (err) {
    const cached = await cache.match(PAGE);
    if (cached) { net.catch(() => {}); return cached; }   // let the slow request finish and refresh the cache
    return net;
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const net = fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return cached || (await net) || Response.error();
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate' && url.origin === location.origin) {
    e.respondWith(pageNetworkFirst());
  } else if (url.origin === location.origin) {
    e.respondWith(staleWhileRevalidate(req, APP_CACHE));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(staleWhileRevalidate(req, FONT_CACHE));   // keeps the rounded font available offline
  }
});
