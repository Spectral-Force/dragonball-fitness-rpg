const CACHE_NAME = 'dbz-fitness-rpg-v5.0.32';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/top_banner.png',
  './images/dragon_balls/earth_dragon_ball_1.svg',
  './images/dragon_balls/earth_dragon_ball_2.svg',
  './images/dragon_balls/earth_dragon_ball_3.svg',
  './images/dragon_balls/earth_dragon_ball_4.svg',
  './images/dragon_balls/earth_dragon_ball_5.svg',
  './images/dragon_balls/earth_dragon_ball_6.svg',
  './images/dragon_balls/earth_dragon_ball_7.svg',
  './images/dragon_balls/namek_dragon_ball_1.svg',
  './images/dragon_balls/namek_dragon_ball_2.svg',
  './images/dragon_balls/namek_dragon_ball_3.svg',
  './images/dragon_balls/namek_dragon_ball_4.svg',
  './images/dragon_balls/namek_dragon_ball_5.svg',
  './images/dragon_balls/namek_dragon_ball_6.svg',
  './images/dragon_balls/namek_dragon_ball_7.svg',
  './images/dragon_balls/super_dragon_ball_1.svg',
  './images/dragon_balls/super_dragon_ball_2.svg',
  './images/dragon_balls/super_dragon_ball_3.svg',
  './images/dragon_balls/super_dragon_ball_4.svg',
  './images/dragon_balls/super_dragon_ball_5.svg',
  './images/dragon_balls/super_dragon_ball_6.svg',
  './images/dragon_balls/super_dragon_ball_7.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
