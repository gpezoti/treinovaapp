import fs from "node:fs";

const html = fs.readFileSync("index.html", "utf8");
const sw = fs.readFileSync("sw.js", "utf8");

const checks = [
  {
    name: "timer persiste estado completo em chave versionada",
    pass: html.includes('REST_TIMER_KEY = "treinova_rest_timer_v2"') &&
      html.includes("startTimestamp") &&
      html.includes("duration") &&
      html.includes("exerciseName") &&
      html.includes('status: STATE.timer.paused ? "paused" : "running"'),
  },
  {
    name: "timer recalcula tempo restante pelo relogio real",
    pass: html.includes("getTimerRemainingSeconds") &&
      html.includes("Date.now()") &&
      html.includes("Number(state.duration || 0) - ((now - Number(state.startTimestamp"),
  },
  {
    name: "timer escuta ciclo de vida do app",
    pass: html.includes("bindRestTimerLifecycle") &&
      html.includes('document.visibilityState === "hidden"') &&
      html.includes('window.addEventListener("pagehide"') &&
      html.includes('window.addEventListener("pageshow"') &&
      html.includes('window.addEventListener("focus"'),
  },
  {
    name: "timer suporta pausar, retomar, ajustar e cancelar sem duplicar intervalos",
    pass: html.includes("pauseToggle") &&
      html.includes("pausedRemaining") &&
      html.includes("if (STATE.timer.raf) { clearTimeout(STATE.timer.raf); STATE.timer.raf = null; }") &&
      html.includes("cancelTimer()"),
  },
  {
    name: "notificacao de descanso finalizado usa Notification API e Service Worker",
    pass: html.includes("ensureRestNotificationPermission") &&
      html.includes("notifyRestFinished") &&
      html.includes('reg.showNotification(title, opts)') &&
      html.includes('new Notification(title, opts)'),
  },
  {
    name: "timer agenda web push real no backend",
    pass: html.includes("scheduleServerRestPush") &&
      html.includes("const pushReady = await ensureRestNotificationPermission()") &&
      html.includes('sb.functions.invoke("rest-timer-push"') &&
      html.includes('action: "schedule"') &&
      html.includes('action: "cancel"') &&
      html.includes("?view=workout&restTimer=1"),
  },
  {
    name: "timer garante subscription antes de agendar backend",
    pass: html.includes("async function subscribePushNotifications(opts = {})") &&
      html.includes("throwOnError") &&
      html.includes("last_seen_at: new Date().toISOString()") &&
      html.includes('return Boolean(await subscribePushNotifications({ throwOnError: true }))'),
  },
  {
    name: "clique na notificacao volta para treino ativo",
    pass: html.includes("prepareWorkoutDeepLinkFromRestTimer") &&
      html.includes("hydrateTimerFromPersisted(saved)") &&
      html.includes('if (view === "workout") prepareWorkoutDeepLinkFromRestTimer()') &&
      sw.includes('new URL(rawUrl, self.location.origin).href') &&
      sw.includes('/?view=workout&restTimer=1'),
  },
  {
    name: "UI exibe contexto e CTA de proximo exercicio",
    pass: html.includes('id="timer-bar-sub"') &&
      html.includes('id="timer-fs-next"') &&
      html.includes("Iniciar próximo exercício") &&
      html.includes("timer-fs.done .timer-fs-next"),
  },
  {
    name: "service worker aceita notificacao local",
    pass: sw.includes('VERSION = "v8"') &&
      sw.includes('type === "SHOW_NOTIFICATION"') &&
      sw.includes('type === "SCHEDULE_REST_TIMER"') &&
      sw.includes('type === "CANCEL_REST_TIMER"') &&
      sw.includes("self.registration.showNotification"),
  },
];

const edge = fs.readFileSync("outputs/edge-functions/rest-timer-push/index.ts", "utf8");
const sql = fs.readFileSync("sql/rest_timer_push_jobs_2026_05_05.sql", "utf8");
const pushSql = fs.readFileSync("sql/push_subscriptions_2026_05_06.sql", "utf8");

checks.push(
  {
    name: "edge function processa jobs vencidos com VAPID",
    pass: edge.includes("webpush.setVapidDetails") &&
      edge.includes("processDueJobs") &&
      edge.includes("rest_timer_push_jobs") &&
      edge.includes("push_subscriptions") &&
      edge.includes("Descanso finalizado") &&
      edge.includes("/?view=workout&restTimer=1"),
  },
  {
    name: "migration cria tabela e indices do timer push",
    pass: sql.includes("create table if not exists public.rest_timer_push_jobs") &&
      sql.includes("idx_rest_timer_push_jobs_due") &&
      sql.includes("enable row level security") &&
      sql.includes("treinova-rest-timer-push-every-minute"),
  },
  {
    name: "migration cria tabela segura de push subscriptions",
    pass: pushSql.includes("create table if not exists public.push_subscriptions") &&
      pushSql.includes("endpoint text not null unique") &&
      pushSql.includes("p256dh text not null") &&
      pushSql.includes("auth text not null") &&
      pushSql.includes("last_seen_at") &&
      pushSql.includes("enable row level security") &&
      pushSql.includes("push subscriptions owner insert"),
  },
);

const failed = checks.filter((check) => !check.pass);

for (const check of checks) {
  console.log(`${check.pass ? "OK" : "FAIL"} - ${check.name}`);
}

if (failed.length) {
  console.error(`\n${failed.length} rest timer check(s) failed.`);
  process.exit(1);
}

console.log("\nAll rest timer checks passed.");
