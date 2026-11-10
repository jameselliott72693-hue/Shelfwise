const CACHE = "shelfwise-shell-v2";

const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/app.js",
  "./js/calc.js",
  "./js/format.js",
  "./js/storage.js",
  "./js/config.js",
  "./js/gas.js",
  "./js/pool.js",
  "./js/receipt.js",
  "./js/remote.js",
  "./js/ocr.js",
  "./js/pwa.js",
  "./data/fees.js",
  "./data/items.js",
  "./data/prices.js",
  "./data/stores.js",
  "./data/towns.js",
  "./data/gas.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== "GET") return;
  if (event.request.mode === "navigate") {
    event.respondWith(networkThenCache(event.request, "./index.html"));
    return;
  }
  event.respondWith(cacheThenNetwork(event.request));
});

async function networkThenCache(request, fallback) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(fallback, fresh.clone());
    return fresh;
  } catch {
    return (await cache.match(fallback)) || (await cache.match("./")) || new Response("Offline", { status: 503 });
  }
}

async function cacheThenNetwork(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  if (cached) return cached;
  return (await network) || new Response("Offline", { status: 503 });
}
