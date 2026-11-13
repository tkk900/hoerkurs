/* Built by tools/build-listen.js. Saves the app on the phone so it works offline. */
const CACHE = "hoerkurs-75c584bd4068";
const FONTS = "hoerkurs-fonts";
/* Recorded clips stay saved across app updates; a new voice gets a new store and the old one is removed. */
const AUDIO = "hoerkurs-audio-e7f29fdc";
const FILES = ["./","index.html","course.js","steps.js","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","icons/maskable-512.png","icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONTS && k !== AUDIO).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function fromCache(req) {
  const hit = await caches.match(req, { ignoreSearch: true });
  if (hit) return hit;
  if (req.mode === "navigate") { const page = await caches.match("./"); if (page) return page; }
  return fetch(req);
}

/* Clips: from the phone when saved, otherwise from the internet, and then saved. */
async function clip(req) {
  const cache = await caches.open(AUDIO);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function font(req) {
  const cache = await caches.open(FONTS);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin === location.origin && url.pathname.includes("/audio/")) e.respondWith(clip(e.request));
  else if (url.origin === location.origin) e.respondWith(fromCache(e.request));
  else if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") e.respondWith(font(e.request));
});
