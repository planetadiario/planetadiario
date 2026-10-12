// Service worker do Planeta Diário: app instalável e abre rápido/offline.
// Navegação: rede primeiro (cai no cache se offline). Assets com hash: cache primeiro.
// Nunca guarda API, Supabase nem vídeos.
const CACHE = "pd-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/painel", "/logo.png", "/icone-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    const base = url.pathname.startsWith("/painel") ? "/painel" : "/";
    e.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok && (url.pathname === "/" || url.pathname === "/painel")) caches.open(CACHE).then((c) => c.put(req, r.clone()));
          return r;
        })
        .catch(() => caches.match(base)),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/") || /\.(png|svg|woff2?)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((r) => {
            if (r.ok) caches.open(CACHE).then((c) => c.put(req, r.clone()));
            return r;
          }),
      ),
    );
  }
});
