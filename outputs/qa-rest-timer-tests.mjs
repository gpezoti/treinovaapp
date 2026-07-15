import fs from "node:fs";

const html = fs.readFileSync("index.html", "utf8");
const sw = fs.readFileSync("sw.js", "utf8");
const lifecycleTimerSource = html.slice(
  html.indexOf("function reconcileTimerAfterLifecycle"),
  html.indexOf("// Re-adquire wake lock")
);
const finishTimerSource = html.slice(
  html.indexOf("function finishTimer()"),
  html.indexOf("function cancelTimer()")
);

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
      html.includes("cancelServerRestPush(STATE.timer.id, STATE.timer.pushScheduleToken)") &&
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
      html.includes("const ok = await scheduleServerRestPush(sec, exerciseName)") &&
      html.includes("const pushReady = await ensureRestNotificationPermission()") &&
      html.includes('sb.functions.invoke("rest-timer-push"') &&
      html.includes("verifyRestTimerPushJob") &&
      html.includes("rememberRestPushStatus") &&
      html.includes('action: "schedule"') &&
      html.includes('action: "cancel"') &&
      html.includes("buildRestTimerWorkoutUrl"),
  },
  {
    name: "timer nao antecipa push remoto nem duplica fallback local",
    pass: html.includes("const PUSH_LATENCY_COMPENSATION_MS = 0") &&
      html.includes("if (saved.notified || saved.pushScheduled || saved.pushScheduling) return") &&
      html.includes("STATE.timer.pushScheduling = true") &&
      html.includes("STATE.timer.pushScheduled = verified") &&
      html.includes("markRestTimerPushDelivered") &&
      (html.match(/notifyRestFinished\(/g) || []).length === 1,
  },
  {
    name: "service worker evita duplicar notificacao quando app esta visivel",
    pass: sw.includes("REST_TIMER_PUSH_DELIVERED") &&
      sw.includes('client.visibilityState === "visible" || client.focused') &&
      sw.includes("if (isRestTimer && hasVisibleApp) return") &&
      sw.includes("treinova-rest-timer-${id}") &&
      sw.includes("timerId"),
  },
  {
    name: "timer preserva o job remoto na expiracao e o invalida ao cancelar",
    pass: html.includes("function isAppForegroundActive()") &&
      !html.includes('if (isAppForegroundActive()) cancelServerRestPush(STATE.timer.id);') &&
      html.includes("cancelServerRestPush(STATE.timer.id, STATE.timer.pushScheduleToken);") &&
      html.includes("cancelServerRestPush(timerId, scheduleToken);") &&
      !lifecycleTimerSource.includes("cancelServerRestPush(") &&
      !finishTimerSource.includes("cancelServerRestPush("),
  },
  {
    name: "concluir treino encerra o descanso local e cancela o push pendente",
    pass: (() => {
      const completeStart = html.indexOf("async function completeSession()");
      const completionToast = html.indexOf('showToast("Treino concluído! ✓", "success");', completeStart);
      const cancelTimerCall = html.indexOf(
        'await withTimeout(closeTimer(), 3500, "rest timer cancel timeout");',
        completeStart
      );
      const closeTimerStart = html.indexOf("function closeTimer()");
      const closeTimerEnd = html.indexOf("function startTimer(", closeTimerStart);
      const closeTimerSource = html.slice(closeTimerStart, closeTimerEnd);
      const cancelTimerStart = html.indexOf("function cancelTimer()");
      const cancelTimerEnd = html.indexOf("function closeTimer()", cancelTimerStart);
      const cancelTimerSource = html.slice(cancelTimerStart, cancelTimerEnd);

      return completeStart >= 0 &&
        cancelTimerCall > completeStart &&
        completionToast > cancelTimerCall &&
        closeTimerSource.includes("const cancellation = cancelTimer();") &&
        closeTimerSource.includes("return cancellation;") &&
        cancelTimerSource.includes("cancelBackgroundRestNotification();") &&
        cancelTimerSource.includes("return cancelServerRestPush(timerId, scheduleToken);");
    })(),
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
      html.includes('qs.get("sessionId")') &&
      html.includes('loadWorkoutSessionById(restResume.sessionId)') &&
      sw.includes('new URL(rawUrl, self.location.origin).href') &&
      sw.includes('/?view=workout&restTimer=1'),
  },
  {
    name: "UI exibe contexto e CTA de proximo exercicio",
    pass: html.includes('id="timer-bar-sub"') &&
      html.includes('id="timer-fs-next"') &&
      html.includes("timer-fs.done .timer-fs-next"),
  },
  {
    name: "professor pode continuar reiniciar e apagar proprio treino concluido",
    pass: html.includes('["student", "coach"].includes(STATE.profile?.role)') &&
      html.includes("reopenCompletedWorkout") &&
      html.includes("restartCompletedWorkout") &&
      html.includes("deleteTodayCompletedWorkout") &&
      html.includes("Continuar treino") &&
      html.includes("Apagar"),
  },
  {
    name: "concluir treino exige gesto de slide para evitar toque acidental",
    pass: html.includes("function initWorkoutFinishSlider") &&
      html.includes('id="finish-slide"') &&
      html.includes("Deslize para concluir treino") &&
      html.includes("pointerdown") &&
      html.includes("currentX >= maxX() * 0.82"),
  },
  {
    name: "service worker aceita notificacao local",
    pass: /const VERSION = "v\d+(?:-[^"]+)?"/.test(sw) &&
      sw.includes('type === "SHOW_NOTIFICATION"') &&
      sw.includes('type === "SCHEDULE_REST_TIMER"') &&
      sw.includes('type === "CANCEL_REST_TIMER"') &&
      sw.includes("self.registration.showNotification") &&
      sw.includes("silent: false"),
  },
];

const edge = fs.readFileSync("supabase/functions/rest-timer-push/index.ts", "utf8");
const sql = fs.readFileSync("sql/rest_timer_push_jobs_2026_05_05.sql", "utf8");
const pushSql = fs.readFileSync("sql/push_subscriptions_2026_05_06.sql", "utf8");
const cronSql = fs.readFileSync("sql/rest_timer_push_cron_setup_TEMPLATE_2026_05_06.sql", "utf8");
const idempotencySql = fs.readFileSync("supabase/migrations/20260713091140_rest_timer_push_delivery_idempotency.sql", "utf8");
const indexCleanupSql = fs.readFileSync("supabase/migrations/20260713093000_remove_duplicate_rest_timer_push_index.sql", "utf8");

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
      edge.includes("timer_id: job.timer_id || job.id || \"\"") &&
      edge.includes("timerId=${encodeURIComponent(job.timer_id") &&
      edge.includes("treinova-rest-timer-${job.timer_id") &&
      edge.includes("silent: false") &&
      edge.includes("/?view=workout&restTimer=1"),
  },
  {
    name: "edge entrega cada descanso somente uma vez e no aparelho de origem",
    pass: edge.includes("async function claimDueJob(jobId: string)") &&
      edge.includes('status: "processing"') &&
      edge.includes('.eq("status", "scheduled")') &&
      edge.includes('.eq("status", "processing")') &&
      edge.includes("schedule_token: scheduleToken") &&
      edge.includes("target_endpoint: requestSubscription?.endpoint || null") &&
      edge.includes("const targetEndpoint = String(job.target_endpoint || \"\")") &&
      edge.includes("(subs || []).filter((s: any) => s.endpoint === targetEndpoint)") &&
      edge.includes("requestSub\n      ? [requestSub]") &&
      edge.includes("(subs || []).slice(0, 1)") &&
      edge.includes("Job cancelado antes do envio.") &&
      edge.includes('.in("status", ["scheduled", "processing"])'),
  },
  {
    name: "migration cria tabela e indices do timer push",
    pass: sql.includes("create table if not exists public.rest_timer_push_jobs") &&
      sql.includes("idx_rest_timer_push_jobs_due") &&
      sql.includes("enable row level security") &&
      sql.includes("treinova-rest-timer-push-every-minute"),
  },
  {
    name: "migration adiciona claim atomico e destino por dispositivo",
    pass: idempotencySql.includes("add column if not exists schedule_token text") &&
      idempotencySql.includes("add column if not exists target_endpoint text") &&
      idempotencySql.includes("add column if not exists claimed_at timestamptz") &&
      idempotencySql.includes("idx_rest_timer_push_jobs_processing_claimed"),
  },
  {
    name: "migration remove indice duplicado sem afetar jobs agendados",
    pass: indexCleanupSql.includes("drop index if exists public.idx_rest_timer_push_jobs_due_claim"),
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
