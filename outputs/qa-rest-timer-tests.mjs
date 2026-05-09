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
    name: "ajuste e pausa do timer sincronizam push remoto",
    pass: html.includes("async function rescheduleServerRestPushFromTimer") &&
      html.includes('rescheduleServerRestPushFromTimer("adjust")') &&
      html.includes('rescheduleServerRestPushFromTimer("resume")') &&
      html.includes("cancelServerRestPush(STATE.timer.id)") &&
      html.indexOf('rescheduleServerRestPushFromTimer("adjust")') > html.indexOf("function adjustTimer(delta)") &&
      html.indexOf('rescheduleServerRestPushFromTimer("resume")') > html.indexOf("function pauseToggle()"),
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
      html.includes("async function startTimer") &&
      html.includes("await startTimer(pauseSec, timerLabel") &&
      html.includes("Agendando descanso...") &&
      html.includes("const ok = await scheduleServerRestPush(sec, exerciseName)") &&
      html.includes("const pushReady = await ensureRestNotificationPermission()") &&
      html.includes('sb.functions.invoke("rest-timer-push"') &&
      html.includes("verifyRestTimerPushJob") &&
      html.includes("rememberRestPushStatus") &&
      html.includes('action: "schedule"') &&
      html.includes('action: "cancel"') &&
      html.includes("?view=workout&restTimer=1"),
  },
  {
    name: "timer preserva push remoto ao finalizar localmente",
    pass: html.includes("function isAppForegroundActive()") &&
      !html.includes('if (isAppForegroundActive()) cancelServerRestPush(STATE.timer.id);') &&
      html.includes("cancelServerRestPush(timerId);"),
  },
  {
    name: "modal de notificacoes consegue renovar assinatura com helper global",
    pass: html.includes("window.openNotificationsSheet = function()") &&
      html.includes("function renderPushSubscriptionCardHTML()") &&
      html.includes("async function ensureUserPushSubscription()") &&
      html.indexOf("async function ensureUserPushSubscription()") > html.indexOf("async function postLoginInit()") &&
      html.indexOf("async function ensureUserPushSubscription()") < html.indexOf("function showForcePasswordReset()"),
  },
  {
    name: "falha de push remoto nao mostra erro tecnico para aluno",
    pass: !html.includes("Verifique push/cron no Supabase") &&
      html.includes("O descanso local continua ativo."),
  },
  {
    name: "timer garante subscription antes de agendar backend",
    pass: html.includes("async function subscribePushNotifications(opts = {})") &&
      html.includes("throwOnError") &&
      html.includes("forceRenew") &&
      html.includes("await sub.unsubscribe();") &&
      html.includes("isWebPushRuntimeSupported") &&
      html.includes("upsertRestTimerPushJobDirect") &&
      html.includes("last_seen_at: new Date().toISOString()") &&
      !html.includes(".delete()\n      .eq(\"user_id\", userId)\n      .neq(\"endpoint\", json.endpoint)") &&
      html.includes('return Boolean(await subscribePushNotifications({ throwOnError: true }))'),
  },
  {
    name: "modal de notificacoes permite renovar push do aparelho atual",
    pass: html.includes("window.forceRenewPushSubscription = async function()") &&
      html.includes('subscribePushNotifications({ throwOnError: true, forceRenew: true })') &&
      html.includes("Renovar push") &&
      html.includes("Teste bloqueado 15s") &&
      html.includes("No iPhone, push fora do app só funciona com o app instalado na Tela de Início."),
  },
  {
    name: "modal de notificacoes nao expoe controles de teste push",
    pass: html.includes("renderPushSubscriptionCardHTML") &&
      !html.slice(
        html.indexOf("window.openNotificationsSheet"),
        html.indexOf("function renderPushSubscriptionCardHTML")
      ).includes("Teste bloqueado 15s") &&
      !html.slice(
        html.indexOf("window.openNotificationsSheet"),
        html.indexOf("function renderPushSubscriptionCardHTML")
      ).includes("Diagnóstico push"),
  },
  {
    name: "onboarding nao marca push como ativo quando subscription falha",
    pass: html.includes("async function requestPushPermission()") &&
      html.includes("await subscribePushNotifications({ throwOnError: true })") &&
      html.includes("Permissão aprovada, mas o push fora do app ainda não está pronto.") &&
      html.includes('return false;') &&
      !html.includes("await subscribePushNotifications();\n    showToast(\"Notificações ativadas\""),
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
    pass: sw.includes('VERSION = "v9"') &&
      sw.includes('type === "SHOW_NOTIFICATION"') &&
      sw.includes('type === "SCHEDULE_REST_TIMER"') &&
      sw.includes('type === "CANCEL_REST_TIMER"') &&
      sw.includes("self.registration.showNotification") &&
      sw.includes("silent: false"),
  },
];

const edge = fs.readFileSync("outputs/edge-functions/rest-timer-push/index.ts", "utf8");
const sql = fs.readFileSync("sql/rest_timer_push_jobs_2026_05_05.sql", "utf8");
const pushSql = fs.readFileSync("sql/push_subscriptions_2026_05_06.sql", "utf8");
const cronSql = fs.readFileSync("sql/rest_timer_push_cron_setup_TEMPLATE_2026_05_06.sql", "utf8");

checks.push(
  {
    name: "edge function processa jobs vencidos com VAPID",
    pass: edge.includes("webpush.setVapidDetails") &&
      edge.includes("processDueJobs") &&
      edge.includes("processSingleDueJob") &&
      edge.includes("testPush") &&
      edge.includes("testDelayedPush") &&
      edge.includes('urgency: "high"') &&
      edge.includes("TTL: 60 * 60") &&
      edge.includes("formatWebPushError") &&
      edge.includes("edge_vapid_public_key") &&
      edge.includes("diagnosePush") &&
      edge.includes("cronDebug") &&
      edge.includes('body.action === "cron_debug"') &&
      edge.includes("EdgeRuntime") &&
      edge.includes("requestSubscription") &&
      edge.includes("processSingleDueJob(job.id, 15_000, requestSubscription)") &&
      edge.includes("job._request_subscription") &&
      edge.includes("allSubs.unshift(requestSub)") &&
      edge.includes("DIRECT_SEND_MAX_DELAY_MS") &&
      edge.includes("rest_timer_push_jobs") &&
      edge.includes("push_subscriptions") &&
      edge.includes("Descanso finalizado") &&
      edge.includes("treinova-rest-timer-${job.timer_id") &&
      edge.includes("silent: false") &&
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
  {
    name: "template do cron passa pela verificacao JWT da edge function",
    pass: cronSql.includes("'Authorization', 'Bearer SUPABASE_ANON_KEY'") &&
      cronSql.includes("'apikey', 'SUPABASE_ANON_KEY'") &&
      cronSql.includes("'x-cron-secret', 'MESMO_VALOR_DE_REST_TIMER_CRON_SECRET'"),
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
