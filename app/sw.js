/* Treinova Service Worker
   - Cache-first para shell + assets
   - Network-first para API Supabase (sempre dados frescos)
   - Push notifications nativos
*/
const VERSION = "v3";
const SHELL = `treinova-shell-${VERSION}`;
const RUNTIME = `treinova-runtime-${VERSION}`;

const SHELL_FILES = [
  "/app/",
  "/app/index.html",
  "/app/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll(SHELL_FILES)).catch(()=>null)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => ![SHELL, RUNTIME].includes(k)).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Supabase API/Realtime/Auth: network-first
  if (url.hostname.includes("supabase.co") || url.hostname.includes("supabase.in")) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // Shell e mesmo origem: cache-first com revalidação
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req).then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(RUNTIME).then((c) => c.put(req, copy));
          }
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // CDN / outros (jpg do Supabase Storage, etc.): stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

/* ---------- PUSH ---------- */
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: event.data ? event.data.text() : "Treinova" }; }
  const title = data.title || "Treinova";
  const opts = {
    body: data.body || "",
    icon: data.icon || "https://mjftgknutxxgxhwlmsln.supabase.co/storage/v1/object/public/branding/logos/1777323170543.jpg",
    badge: data.badge || "https://mjftgknutxxgxhwlmsln.supabase.co/storage/v1/object/public/branding/logos/1777323170543.jpg",
    tag: data.tag || undefined,
    data: data.url ? { url: data.url } : {},
    vibrate: [80, 40, 80],
  };
  event.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes(self.location.origin)) { w.focus(); w.navigate(url); return; }
      }
      return self.clients.openWindow(url);
    })
  );
});

/* Permite o app pedir skipWaiting ao detectar nova versão */
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});
