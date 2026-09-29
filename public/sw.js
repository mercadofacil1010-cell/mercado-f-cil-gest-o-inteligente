// Service worker do B5.5 — só cuida de duas coisas: (1) ser um dos
// requisitos de instalação do PWA (junto com o manifest) e (2) deixar
// /repositor e /conferente abrirem offline (cache-first do app shell,
// atualizando o cache sempre que a rede responde). Os dados em si (tarefas,
// contagens) são cacheados à parte pelo app em IndexedDB (src/lib/offline-db.ts)
// — este arquivo não sabe nada sobre Supabase.
const CACHE_NAME = "mercado-facil-shell-v1";
const OFFLINE_SCOPES = ["/repositor", "/conferente"];

function inOfflineScope(pathname) {
  return OFFLINE_SCOPES.some((scope) => pathname === scope || pathname.startsWith(scope + "/"));
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== "GET") return;
  if (!inOfflineScope(url.pathname) && url.pathname !== "/" && !url.pathname.startsWith("/assets/")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/"))),
  );
});
