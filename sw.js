/* Treinova Service Worker
   - Network-first para HTML/manifest (sempre versão fresca)
   - Network-first para API Supabase
   - Cache-first com revalidação para assets estáticos (CDN, imagens)
   - Push notifications nativos
*/
const VERSION = "v6";
const SHELL = `treinova-shell-${VERSION}`;
const RUNTIME = `treinova-runtime-${VERSION}`;

self.addEventListener("install", (event) => {
  // Não pré-cacheia HTML — sempre buscar da network
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => ![SHELL, RUNTIME].includes(k)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
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

  // HTML/Manifest do app: NETWORK-FIRST (evita versão antiga grudada)
  const path = url.pathname;
  const isShell = url.origin === self.location.origin && (
    path === "/" || path.endsWith(".html") ||
    path.endsWith("/app/") || path.endsWith("/app") ||
    path.endsWith("manifest.webmanifest") ||
    path.endsWith("sw.js")
  );
  if (isShell) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        if (fresh && fresh.status === 200) {
          const copy = fresh.clone();
          caches.open(RUNTIME).then(c => c.put(req, copy)).catch(()=>{});
        }
        return fresh;
      } catch (e) {
        const cached = await caches.match(req);
        return cached || new Response("Offline", { status: 503 });
      }
    })());
    return;
  }

  // Outros assets (CDN, imagens, etc.): stale-while-revalidate
  if (url.origin === self.location.origin || url.protocol === "https:") {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      const fetchPromise = fetch(req).then(res => {
        if (res && res.status === 200 && (res.type === "basic" || res.type === "cors")) {
          const copy = res.clone();
          caches.open(RUNTIME).then(c => c.put(req, copy)).catch(()=>{});
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })());
    return;
  }
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
  const url = (event.notification.data && event.notification.data.url) || "/app/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes(self.location.origin)) { w.focus(); w.navigate(url); return; }
      }
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});
