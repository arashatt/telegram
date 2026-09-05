/* Service worker for the two intake sites.

   It exists so the pages behave like installed apps on Android and iOS:
   they open instantly from the home screen, and a dropped connection shows
   the site rather than the browser's dinosaur.

   Three rules, in the order the fetch handler applies them:

     /api/*        never touched. Chat, extraction and submission are live
                   calls with rate limits and a session cookie behind them;
                   a cached answer to any of them would be wrong.
     navigations   network-first. A deploy must be visible on the next load,
                   so the cached shell is a fallback, never the source.
     /assets/*     cache-first. Vite content-hashes these, so a given URL's
                   bytes never change and revalidating them is wasted time.

   Everything else same-origin — icons, manifests, favicons, robots.txt —
   is served from cache while a fresh copy is fetched for next time.

   Cross-origin requests (the Google Fonts stylesheet and its font files) are
   left to the browser's own HTTP cache: intercepting them would mean storing
   opaque responses of unknown size for no gain, and the font stack already
   falls back to the system UI font.

   Bump VERSION to retire every cache from the previous release. */
const VERSION = "v1";
const SHELL = `shell-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;
const KEEP = [SHELL, RUNTIME];

const OFFLINE = "/offline.html";

/* The two documents, plus what the offline page needs to render itself.
   Hashed bundles are deliberately absent: their names are only known at
   build time, and the first visit caches them on the way past. */
const SHELL_URLS = [
  "/",
  "/instagram",
  OFFLINE,
  "/manifest.webmanifest",
  "/manifest-instagram.webmanifest",
  "/favicon.svg",
  "/favicon-instagram.svg",
  "/icons/icon-192.png",
  "/icons/instagram-192.png",
];

/* Which shell answers a navigation. Both sites are single pages, and the
   asset router already serves index.html for anything it does not
   recognise, so every path resolves to one of the two. */
function shellFor(pathname) {
  return pathname === "/instagram" || pathname.startsWith("/instagram/") ? "/instagram" : "/";
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await self.caches.open(SHELL);
      /* One at a time rather than addAll: addAll is atomic, so a single
         404 would fail the install and leave the site with no worker. */
      await Promise.all(SHELL_URLS.map((url) => cache.add(url).catch(() => {})));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await self.caches.keys();
      await Promise.all(names.filter((n) => !KEEP.includes(n)).map((n) => self.caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

async function fromNetworkFirst(request) {
  const url = new URL(request.url);
  const key = shellFor(url.pathname);
  const cache = await self.caches.open(SHELL);
  try {
    const fresh = await fetch(request);
    /* Only a real 200 is worth keeping. A 404 or a 5xx cached as the shell
       would outlive the outage that produced it. */
    if (fresh && fresh.ok && fresh.type !== "opaque") {
      cache.put(key, fresh.clone());
    }
    return fresh;
  } catch {
    return (await cache.match(key)) || (await cache.match(OFFLINE)) || Response.error();
  }
}

async function fromCacheFirst(request) {
  const cache = await self.caches.open(RUNTIME);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    return Response.error();
  }
}

async function fromCacheThenUpdate(request) {
  const cache = await self.caches.open(RUNTIME);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((fresh) => {
      if (fresh && fresh.ok) cache.put(request, fresh.clone());
      return fresh;
    })
    .catch(() => null);
  return hit || (await network) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fromNetworkFirst(request));
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(fromCacheFirst(request));
    return;
  }
  event.respondWith(fromCacheThenUpdate(request));
});
