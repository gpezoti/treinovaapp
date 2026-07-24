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
  html.includes("window.onDayClick = function(iso)") &&
    html.includes("window.openAgendaDay(iso);"),
  "faixa de dias da Home usa o mesmo fluxo da Agenda"
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
    !agendaBlockSource.includes("iso < today") &&
    agendaBlockSource.includes("setWorkoutTarget({") &&
    agendaBlockSource.includes('navTo("workout")'),
  "qualquer bloco de treino da agenda abre diretamente para execução, inclusive fora do dia atual"
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

assert(
  html.includes("function findWorkoutSessionRows(date, workoutCode, workoutId = null)") &&
    html.includes('base().eq("workout_id", workoutId).limit(5)') &&
    html.includes('base().is("workout_id", null).limit(5)'),
  "sessões consultam primeiro o workout_id e só usam registros legados sem ID como fallback"
);

assert(
  html.includes("function setWorkoutTarget({ date, workoutCode") &&
    html.includes("const agendaTarget = currentWorkoutTarget();") &&
    html.includes("const keepAgendaSelection = STATE.view === \"workout\"") &&
    html.includes("if (!keepAgendaSelection) {") &&
    html.includes("await abandonOtherInProgressSessions(active);"),
  "a escolha da Agenda permanece estável contra refresh assíncrono da Home"
);

if (process.exitCode) {
  throw new Error("Agenda other-day workout QA failed");
}
