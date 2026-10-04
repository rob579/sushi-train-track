'use strict';
/* Sushi Train Track service worker.
   - The page itself is "network first": you always get the newest version when there is signal,
     and the saved copy when there is none (or the connection is too slow to wait for).
   - Icons, fonts and the manifest are served from the cache and refreshed in the background.
   - VERSION is stamped with the git commit by update.sh, so every deploy changes this file and
     phones notice the update. */
const VERSION = 'dev';
const APP_CACHE = 'stt-app-' + VERSION;
const PAGE = './index.html';   // the name the app page is stored under in the cache
const PAGE_URL = './';         // what is actually fetched: the site root (hosts such as Cloudflare Pages redirect /index.html to /)
const PRECACHE = ['./manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png',
  './fonts/m-plus-rounded-1c-latin-400-normal.woff2', './fonts/m-plus-rounded-1c-latin-500-normal.woff2', './fonts/m-plus-rounded-1c-latin-800-normal.woff2'];
const NAV_TIMEOUT_MS = 3500;

/* A browser refuses to show a page visit that is answered with a response which came through a redirect,
   so take such a response apart and rebuild it as a plain one. */
async function cleanCopy(res) {
  if (!res.redirected) return res;
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(APP_CACHE);
    await c.addAll(PRECACHE.map(u => new Request(u, { cache: 'reload' })));
    const page = await fetch(new URL(PAGE_URL, self.location).href, { cache: 'reload' });
    if (!page.ok) throw new Error('could not fetch the app page');
    await c.put(PAGE, await cleanCopy(page));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if ((k.startsWith('stt-app-') && k !== APP_CACHE) || k === 'stt-fonts-v1') await caches.delete(k);   // old versions, and the old Google Fonts cache
    await self.clients.claim();
    // tell any open page which version is now active, so it can offer a reload if it is out of date
    for (const c of await self.clients.matchAll({ includeUncontrolled: true })) c.postMessage({ type: 'sw-version', version: VERSION });
  })());
});

async function pageNetworkFirst() {
  const cache = await caches.open(APP_CACHE);
  const net = fetch(new URL(PAGE_URL, self.location).href, { cache: 'no-cache' }).then(async fetched => {
    const res = await cleanCopy(fetched);
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
  const base = new URL('./', self.location).pathname;   // the folder this service worker lives in (the site root)
  if (req.mode === 'navigate' && url.origin === location.origin) {
    // only the app itself is answered from here; other pages (privacy.html and so on) come straight from the website
    if (url.pathname === base || url.pathname === base + 'index.html') e.respondWith(pageNetworkFirst());
  } else if (url.origin === location.origin) {
    e.respondWith(staleWhileRevalidate(req, APP_CACHE));
  }
});
