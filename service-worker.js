const CACHE_NAME = 'alumni-game-v1';

// Install: cache all core assets
self.addEventListener('install', event => {
    const base = self.registration.scope;
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll([
            base,
            base + 'index.html',
            base + 'style.css',
            base + 'script.js',
            base + 'players_with_images.csv',
            base + 'manifest.json'
        ]))
    );
    self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// Fetch: serve from cache, fall back to network
self.addEventListener('fetch', event => {
    // Skip non-GET and cross-origin requests (e.g. Google Fonts, ESPN logos)
    if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                // Cache successful responses for local assets
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            });
        })
    );
});
