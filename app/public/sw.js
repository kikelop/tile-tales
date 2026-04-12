const CACHE_NAME = "tile-tales-v1";

// Cache tile images and app shell on install
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// Cache-first strategy for images, network-first for everything else
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Cache-first for tile images and static assets
  if (url.pathname.startsWith("/tiles/") || url.pathname.endsWith(".webp") || url.pathname.endsWith(".png")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first for HTML/JS (always get latest)
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
