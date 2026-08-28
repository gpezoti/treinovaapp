/* Treinova Service Worker
   - Network-first para HTML/manifest (sempre versão fresca)
   - Sem cache de respostas autenticadas da API Supabase
   - Cache-first com revalidação para assets estáticos (CDN, imagens)
   - Push notifications nativos
*/
// Alterar a versão a cada release que mexe no shell do app. Isso força a
// atualização imediata do PWA instalado e elimina HTML antigo do cache.
const VERSION = "v32-material-preview-20260828";
const SHELL = `treinova-shell-${VERSION}`;
const RUNTIME = `treinova-runtime-${VERSION}`;
const REST_TIMER_HANDLES = new Map();
const APP_SCOPE = self.registration.scope;
const APP_URL = (path) => new URL(path, APP_SCOPE).toString();
const OFFLINE_APP_SHELL = [
  APP_URL("./"),
  APP_URL("index.html"),
  APP_URL("manifest.webmanifest"),
  APP_URL("analytics-config.js"),
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"
];

self.addEventListener("install", (event) => {
  // O shell precisa estar disponivel no primeiro uso offline apos uma
  // atualizacao. Dados autenticados continuam fora deste cache.
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await Promise.all(OFFLINE_APP_SHELL.map(async (asset) => {
      try {
        const request = new Request(asset, { cache: "no-store" });
        const response = await fetch(request);
        if (response?.ok || response?.type === "opaque") await cache.put(request, response.clone());
      } catch (e) {}
    }));
    await self.skipWaiting();
  })());
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

  // Respostas autenticadas nao entram no Cache Storage: o cache do browser nao
  // separa de forma confiavel usuarios por Authorization e poderia expor dados
  // de uma conta a outra no mesmo aparelho. O offline do aluno usa um bundle
  // local escopado pelo id da conta, gravado pelo app.
  const isSupabaseHost = url.hostname.includes("supabase.co") || url.hostname.includes("supabase.in");
  // Arquivos de bucket público não carregam Authorization e podem ser
  // reutilizados offline. REST, Auth e Storage privado seguem fora do cache.
  const isPublicSupabaseStorageAsset = isSupabaseHost
    && /^\/storage\/v1\/(?:object|render\/image)\/public\//.test(url.pathname);
  if (isSupabaseHost && !isPublicSupabaseStorageAsset) {
    return;
  }

  // HTML/Manifest do app: NETWORK-FIRST (evita versão antiga grudada)
  const path = url.pathname;
  const scopePath = new URL(APP_SCOPE).pathname;
  const isShell = url.origin === self.location.origin && (
    path === scopePath || path === `${scopePath}index.html` || path.endsWith(".html") ||
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
  event.waitUntil((async () => {
    const title = data.title || "Treinova";
    const timerId = data.timer_id || data.timerId || "";
    const tag = data.tag || undefined;
    const isRestTimer = title === "Descanso finalizado" || String(tag || "").startsWith("treinova-rest-timer") || !!timerId;
    const appClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of appClients) {
      if (isRestTimer) client.postMessage({ type: "REST_TIMER_PUSH_DELIVERED", timerId, tag });
    }
    const hasVisibleApp = appClients.some((client) => client.visibilityState === "visible" || client.focused);
    if (isRestTimer && hasVisibleApp) return;
    const opts = {
      body: data.body || "",
      icon: data.icon || "https://mjftgknutxxgxhwlmsln.supabase.co/storage/v1/object/public/branding/logos/1777323170543.jpg",
      badge: data.badge || "https://mjftgknutxxgxhwlmsln.supabase.co/storage/v1/object/public/branding/logos/1777323170543.jpg",
      tag,
      data: {
        ...(data.url ? { url: data.url } : {}),
        ...(timerId ? { timerId } : {})
      },
      vibrate: [80, 40, 80],
      silent: data.silent === true ? true : false,
      renotify: data.renotify !== false,
    };
    await self.registration.showNotification(title, opts);
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const notificationData = event.notification.data || {};
  const rawUrl = notificationData.url || "?view=workout&restTimer=1";
  const url = new URL(rawUrl, APP_SCOPE).href;
  const timerId = notificationData.timerId || "";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (timerId) w.postMessage({ type: "REST_TIMER_PUSH_DELIVERED", timerId });
        if (w.url.includes(self.location.origin)) { w.focus(); w.navigate(url); return; }
      }
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
  if (e.data && e.data.type === "SCHEDULE_REST_TIMER") {
    const data = e.data.payload || {};
    const id = data.id || "rest";
    const delay = Math.max(0, Math.min(60 * 60 * 1000, Number(data.fireAt || 0) - Date.now()));
    if (REST_TIMER_HANDLES.has(id)) clearTimeout(REST_TIMER_HANDLES.get(id));
    const handle = setTimeout(() => {
      REST_TIMER_HANDLES.delete(id);
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        for (const client of clients) client.postMessage({ type: "REST_TIMER_PUSH_DELIVERED", timerId: id, tag: `treinova-rest-timer-${id}` });
        const hasVisibleApp = clients.some((client) => client.visibilityState === "visible" || client.focused);
        if (hasVisibleApp) return;
        return self.registration.showNotification("Descanso finalizado", {
          body: `Próximo exercício: ${data.exerciseName || "Próxima série"}`,
          icon: APP_URL("assets/icon-192.png"),
          badge: APP_URL("assets/favicon-32x32.png"),
          tag: `treinova-rest-timer-${id}`,
          renotify: true,
          vibrate: [160, 80, 160],
          silent: false,
          data: { url: data.url || `?view=workout&restTimer=1&timerId=${encodeURIComponent(id)}`, timerId: id },
        });
      }).catch(()=>{});
    }, delay);
    REST_TIMER_HANDLES.set(id, handle);
  }
  if (e.data && e.data.type === "CANCEL_REST_TIMER") {
    const id = e.data.payload && e.data.payload.id;
    if (!id || id === "all") {
      for (const handle of REST_TIMER_HANDLES.values()) clearTimeout(handle);
      REST_TIMER_HANDLES.clear();
    } else if (REST_TIMER_HANDLES.has(id)) {
      clearTimeout(REST_TIMER_HANDLES.get(id));
      REST_TIMER_HANDLES.delete(id);
    }
  }
  if (e.data && e.data.type === "SHOW_NOTIFICATION") {
    const data = e.data.payload || {};
    e.waitUntil(self.registration.showNotification(data.title || "Treinova", {
      body: data.body || "",
      icon: data.icon || APP_URL("assets/icon-192.png"),
      badge: data.badge || APP_URL("assets/favicon-32x32.png"),
      tag: data.tag || "treinova-local",
      renotify: data.renotify !== false,
      vibrate: data.vibrate || [80, 40, 80],
      silent: data.silent === true ? true : false,
      data: data.url ? { url: data.url } : {},
    }));
  }
});
