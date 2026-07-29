import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

// A Agenda precisa usar as sessões concluídas, pois periodization_days não é
// atualizado quando o aluno conclui um treino.
assert.match(html, /async function loadCalendarCompletionState\(\)/);
assert.match(html, /from\("sessions"\)[\s\S]{0,260}\.eq\("status", "completed"\)/);
assert.match(html, /from\("aero_logs"\)/);
assert.match(html, /function calendarDayCompletion\(day, today = todayISO\(\)\)/);
assert.match(html, /const completedByDate = Object\.fromEntries\(allDays\.map\(day => \[day\.date, calendarDayCompletion\(day, today\)\]\)\)/);

// Apenas atividade programada pode contar como falta. Um bloco OFF legado não
// pode aparecer como atrasado nem reduzir o percentual do ciclo.
assert.match(html, /b\.workout_code && b\.workout_code !== "OFF"/);

// Estados do calendário: concluído verde e falta vermelho, legíveis no mobile.
assert.match(html, /\.day-pill\.is-done \{ border-color: var\(--green\)/);
assert.match(html, /\.day-pill\.is-late \{ border-color: var\(--red\)/);
assert.match(html, /completion\.state === "missed"/);
assert.match(html, /isDone \? \"is-done\" : isLate \? \"is-late\"/);
assert.match(html, /serviceWorker\.register\("\/sw\.js\?release=20260729-agenda-progress"\)/);

console.log("Calendar progress QA passed");
