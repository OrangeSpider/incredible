const CACHE_NAME = "incredible-machine-v1";
const CORE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/app-icon-192.png",
  "/app-icon-512.png",
  "/assets/cat-animation-sprites.png",
  "/assets/fire-animation-sprites.png",
  "/assets/gadget-cartoon-atlas.png",
  "/assets/hamster-running-sprites.png",
  "/assets/hamster-wheel-sprites.png",
  "/assets/mouse-running-sprites.png",
  "/assets/mr-blue-animation-sprites.png",
  "/assets/rocket-launch-sprites.png",
  "/assets/water-animation-sprites.png"
];

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const page = await fetch(new Request("/", { cache: "reload" }));
  if (!page.ok) throw new Error("App shell unavailable");
  await cache.put("/", page.clone());
  const html = await page.text();
  const discovered = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => new URL(match[1], self.location.origin))
    .filter((url) => url.origin === self.location.origin)
    .map((url) => `${url.pathname}${url.search}`);
  await Promise.allSettled([...new Set([...CORE_ASSETS.slice(1), ...discovered])].map(async (url) => {
    const response = await fetch(new Request(url, { cache: "reload" }));
    if (response.ok) await cache.put(url, response);
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
    self.clients.claim()
  ]));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(async (response) => {
      if (response.ok) (await caches.open(CACHE_NAME)).put("/", response.clone());
      return response;
    }).catch(async () => (await caches.match("/")) || Response.error()));
    return;
  }

  if (["script", "style", "font", "image", "manifest"].includes(request.destination)) {
    event.respondWith(caches.match(request).then((cached) => {
      const refresh = fetch(request).then(async (response) => {
        if (response.ok) (await caches.open(CACHE_NAME)).put(request, response.clone());
        return response;
      });
      return cached || refresh;
    }));
  }
});
