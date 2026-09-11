const CACHE_NAME = 'streamer-clicker-v3';
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './assets/character/torso.png',
  './assets/character/head.png',
  './assets/character/blush.png',
  './assets/character/eyes.png',
  './assets/character/brows_neutral.png',
  './assets/character/brows_happy.png',
  './assets/character/mouth_neutral.png',
  './assets/character/mouth_happy.png',
  './assets/character/hair_back_blonde.png',
  './assets/character/hair_back_white.png',
  './assets/character/hair_back_black.png',
  './assets/character/hair_back_red.png',
  './assets/character/hair_front_blonde.png',
  './assets/character/hair_front_white.png',
  './assets/character/hair_front_black.png',
  './assets/character/hair_front_red.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
