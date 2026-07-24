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

const agendaBlockStart = html.indexOf("function openAgendaBlockDirect");
const agendaBlockEnd = html.indexOf("window.openAgendaBlock = function", agendaBlockStart);
const agendaBlockSource = html.slice(agendaBlockStart, agendaBlockEnd);
const pickSessionStart = html.indexOf("function pickBestWorkoutSession");
const pickSessionEnd = html.indexOf("function findKnownSessionForWorkout", pickSessionStart);
const pickSessionSource = html.slice(pickSessionStart, pickSessionEnd);

assert(
  !agendaBlockSource.includes("openDayHistory(") &&
    agendaBlockSource.includes("openWorkoutWithPreset(iso, workoutCode, presetCode, workoutId)") &&
    agendaBlockSource.includes("openWorkout(iso, workoutCode, info.intensity, workoutId)"),
  "qualquer bloco de treino da agenda abre para execução, sem bloquear dias concluídos"
);

assert(
  html.includes("Escolha qualquer treino para abrir e executar, mesmo fora do dia atual.") &&
    html.includes('"Executar agora"'),
  "agenda deixa explícito que o aluno pode executar qualquer treino planejado"
);

assert(
  pickSessionSource.includes("const exact = workoutId") &&
    pickSessionSource.includes("const legacy = workoutId") &&
    !pickSessionSource.includes("candidates.length ? candidates : rows"),
  "sessões de treinos com o mesmo código não se misturam entre modelos diferentes"
);

if (process.exitCode) {
  throw new Error("Agenda other-day workout QA failed");
}
