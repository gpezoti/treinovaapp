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
    name: "UI exibe contexto e CTA de proximo exercicio",
    pass: html.includes('id="timer-bar-sub"') &&
      html.includes('id="timer-fs-next"') &&
      html.includes("Iniciar próximo exercício") &&
      html.includes("timer-fs.done .timer-fs-next"),
  },
  {
    name: "service worker aceita notificacao local",
    pass: sw.includes('VERSION = "v7"') &&
      sw.includes('type === "SHOW_NOTIFICATION"') &&
      sw.includes('type === "SCHEDULE_REST_TIMER"') &&
      sw.includes('type === "CANCEL_REST_TIMER"') &&
      sw.includes("self.registration.showNotification"),
  },
];

const failed = checks.filter((check) => !check.pass);

for (const check of checks) {
  console.log(`${check.pass ? "OK" : "FAIL"} - ${check.name}`);
}

if (failed.length) {
  console.error(`\n${failed.length} rest timer check(s) failed.`);
  process.exit(1);
}

console.log("\nAll rest timer checks passed.");
