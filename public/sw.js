/**
 * Reference Radar service worker.
 *
 * - Precaches the app shell and hashed build assets (list injected at build).
 * - Runtime-caches the lazily-fetched CJK font (a static app asset).
 * - Never caches user documents or analysis results — everything the user
 *   uploads stays in memory only.
 */
const VERSION = "rr-v1.0.0";
const PRECACHE = `${VERSION}-precache`;
const RUNTIME = `${VERSION}-runtime`;

self.addEventListener("install", (event) => {
  const urls = self.__RR_PRECACHE || [];
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      await Promise.allSettled(urls.map((u) => cache.add(new Request(u, { cache: "reload" }))));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Fonts: cache-first (lazy static asset, large)
  if (url.pathname.includes("/fonts/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) await cache.put(req, res.clone());
        return res;
      })()
    );
    return;
  }

  // Navigations: network-first with offline fallback to precached shell.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch {
          const cache = await caches.open(PRECACHE);
          return (await cache.match("./")) || (await cache.match("./index.html")) || Response.error();
        }
      })()
    );
    return;
  }

  // Static app assets (hashed chunks, icons, misc root files): cache-first
  // with a failsafe fallback chain so offline never rejects.
  if (/\/assets\//.test(url.pathname) || /\.(woff2|svg|png|css|js)$/.test(url.pathname)) {
    event.respondWith(serveStatic(req));
    return;
  }
  // Any other same-origin GET (e.g. theme-init.js, manifest): precache-first.
  event.respondWith(serveStatic(req));
});

async function serveStatic(req) {
  try {
    const cache = await caches.open(PRECACHE);
    const hit = await cache.match(req, { ignoreVary: true, ignoreSearch: false });
    if (hit) return hit;
    const res = await fetch(req);
    if (res && res.ok) await cache.put(req, res.clone());
    return res;
  } catch (e) {
    try {
      const cache = await caches.open(PRECACHE);
      const hit = await cache.match(req, { ignoreVary: true });
      if (hit) return hit;
    } catch (e2) {
      /* fall through */
    }
    return new Response("offline", { status: 503, headers: { "content-type": "text/plain" } });
  }
}
