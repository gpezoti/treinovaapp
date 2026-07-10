import fs from "node:fs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`OK: ${message}`);
  }
}

assert(
  html.includes("function closeSheetForAction()") &&
    html.includes("closeSheet({ skipHistoryBack: true })"),
  "ações internas de sheet fecham sem competir com history.back"
);

assert(
  html.includes("window.openAgendaWorkoutFromSheet = function") &&
    html.includes("window.openAgendaBlockFromSheet = function"),
  "agenda possui helpers dedicados para abrir treino/bloco a partir do sheet"
);

assert(
  html.includes("onclick=\"openAgendaDay(${jsArg(d.date)})\""),
  "cards da agenda escapam a data com jsArg antes de chamar openAgendaDay"
);

assert(
  html.includes("onclick=\"openAgendaBlockFromSheet(${jsArg(iso)},${idx})\""),
  "sheet de dia com vários blocos abre bloco sem chamar closeSheet direto"
);

assert(
  html.includes("openAgendaWorkoutFromSheet(${jsArg(iso)},${jsArg(workoutCode)},${jsArg(presetCode || \"\")}") &&
    html.includes("openAgendaWorkoutFromSheet(${jsArg(iso)},${jsArg(wCode)},${jsArg(info.preset_code || \"\")}"),
  "botões de treino atrasado usam helper seguro e preservam o dia selecionado"
);

assert(
  html.includes("sessionMatchesWorkoutTarget(STATE.currentSession, date, code, STATE.selectedWorkoutId)") &&
    html.includes("loadOrCreateSession(date, code, STATE.selectedIntensity, STATE.selectedWorkoutId)"),
  "retomada de treino valida date/code/workout_id e repassa workout_id"
);

if (process.exitCode) {
  throw new Error("Agenda other-day workout QA failed");
}
