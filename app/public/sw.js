const CACHE_NAME = "tile-tales-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never intercept cross-origin requests — the browser handles CORS, caching,
  // and integrity for those (e.g. CDN scripts, WASM). Intercepting them can
  // taint the response and break <script> execution silently.
  if (url.origin !== self.location.origin) return;

  // Cache-first for tile images and static texture assets
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

  // Network-first for everything else from our origin (always get latest)
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
