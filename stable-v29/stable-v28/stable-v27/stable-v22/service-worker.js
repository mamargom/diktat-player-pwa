const CACHE = "diktat-player-standalone-v22-download-action";
const GENERATED_CACHE = "diktat-generated-files";
const APP_SCOPE = self.registration.scope;
const OFFLINE_PAGE = new URL("index.html", APP_SCOPE).href;
const GENERATED_PATH = new URL("generated/", APP_SCOPE).pathname;

self.addEventListener("install", event => {
  event.waitUntil(
    fetch(OFFLINE_PAGE, { cache: "reload" })
      .then(response => {
        if (!response.ok) throw new Error("Offline page unavailable");
        return caches.open(CACHE).then(cache => cache.put(OFFLINE_PAGE, response));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("diktat-player-") && key !== CACHE && key !== GENERATED_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin && url.pathname.startsWith(GENERATED_PATH)) {
    event.respondWith(caches.open(GENERATED_CACHE).then(cache => cache.match(request)).then(hit => hit || new Response("Archivo no disponible", { status: 404 })));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_PAGE))
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(hit => hit || fetch(request).then(response => {
        if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
        return response;
      }))
    );
  }
});
