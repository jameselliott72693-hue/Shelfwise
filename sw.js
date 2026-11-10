const CACHE = "shelfwise-shell-v3";

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
  "./js/input.js",
  "./js/links.js",
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
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL.map((path) => new Request(path, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
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
    event.respondWith(networkFirst(event.request, "./index.html"));
    return;
  }
  event.respondWith(networkFirst(event.request));
});

async function networkFirst(request, fallback) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request.url, { cache: "reload", credentials: "same-origin" });
    if (fresh.ok) cache.put(fallback || request, fresh.clone());
    if (fresh.ok || fresh.type === "opaqueredirect") return fresh;
  } catch {
    /* Offline or a blocked reload. Use the last cached copy. */
  }
  const cached = (fallback && await cache.match(fallback)) || await cache.match(request) || await cache.match("./");
  return cached || new Response("Offline", { status: 503 });
}
