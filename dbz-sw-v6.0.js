'use strict';

importScripts('./v6-asset-manifest.js');

const BUILD_ID = '6.4.0-20260803.6';
const VERSION = `v${BUILD_ID}`;
const SHELL_CACHE = `dbz-fitness-shell-${VERSION}`;
const ASSET_CACHE = `dbz-fitness-assets-${VERSION}`;
const ENTRY = './DragonBall_Fitness_RPG_v6.0.html';
const APP_SHELL = [
    './',
    ENTRY,
    './manifest-v6.webmanifest',
    './dbz-v6.css',
    './dbz-v6-overrides.css',
    './dbz-v6-story.css',
    './dbz-v6-config.js',
    './dbz-v6-progression-config.js',
    './dbz-v6-progression-core.js',
    './dbz-v6-story-db.js',
    './dbz-v6-story-dbz.js',
    './dbz-v6-story-super.js',
    './dbz-v6-story-characters.js',
    './dbz-v6-story-core.js',
    './v6-asset-manifest.js',
    './dbz-v6-storage.js',
    './dbz-v6.js',
    './dbz-v6-enhancements.js',
    './dbz-v6-race-ui.js',
    './dbz-v6-story-ui.js',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/apple-touch-icon.png',
    './images/cover_a.jpg',
    './images/v6/v6_hero.webp',
    './images/v6/race_route_backdrop.webp',
    ...(Object.values(self.DBZ_V6_ASSETS || {}).filter(asset => /^\.\/images\/v6\/races\//i.test(asset)))
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(SHELL_CACHE)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key => key.startsWith('dbz-fitness-') && ![SHELL_CACHE, ASSET_CACHE].includes(key))
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(SHELL_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        return (await caches.match(request)) || (await caches.match(ENTRY));
    }
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(ASSET_CACHE);
    const cached = await cache.match(request);
    const network = fetch(request)
        .then(response => {
            if (response.ok) cache.put(request, response.clone());
            return response;
        })
        .catch(() => null);
    return cached || (await network) || Response.error();
}

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request));
        return;
    }

    if (/\.(?:avif|gif|jpe?g|png|webp)$/i.test(url.pathname)) {
        event.respondWith(staleWhileRevalidate(request));
        return;
    }

    event.respondWith(
        caches.match(request, { ignoreSearch: true }).then(cached => cached || fetch(request).then(response => {
            if (response.ok) {
                const copy = response.clone();
                caches.open(SHELL_CACHE).then(cache => cache.put(request, copy));
            }
            return response;
        }))
    );
});
