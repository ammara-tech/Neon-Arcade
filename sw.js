/* =========================================================
   NEON ARCADE — service worker (offline support)
   • The arcade's own files are cached on install, so it opens offline.
   • Google Fonts are cached the first time they load online.
   When you change any file, bump VERSION so players get the update.
========================================================= */
const VERSION = 'neon-arcade-v1';
const FONT_CACHE = 'neon-arcade-fonts';

const APP_FILES = [
  './',
  'index.html',
  'style.css',
  'games.css',
  'manifest.webmanifest',
  'js/core.js',
  'js/games/ttt.js',
  'js/games/rps.js',
  'js/games/memory.js',
  'js/games/clicker.js',
  'js/games/whack.js',
  'js/games/hangman.js',
  'js/games/typing.js',
  'js/games/snake.js',
  'js/games/runner.js',
  'js/games/breakout.js',
  'js/gauntlet.js',
  'js/stats.js',
  'js/ui.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  // remove caches from older versions
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== FONT_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fonts: use the cached copy if there is one, otherwise fetch and keep it
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(req).then(hit => hit || fetch(req).then(res => {
          if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
          return res;
        }).catch(() => hit))
      )
    );
    return;
  }

  // The arcade's own files: network first (so updates show up), cache when offline
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('index.html')))
    );
  }
});
