import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

// A Agenda precisa usar as sessões concluídas, pois periodization_days não é
// atualizado quando o aluno conclui um treino.
assert.match(html, /async function loadCalendarCompletionState\(\)/);
assert.match(html, /from\("sessions"\)[\s\S]{0,260}\.eq\("status", "completed"\)/);
assert.match(html, /from\("aero_logs"\)/);
assert.match(html, /function calendarDayCompletion\(day, today = todayISO\(\)\)/);
assert.match(html, /matchingCode\.some\(session => !session\.workout_id\)/);
assert.match(html, /const hasCompletedActivity = completedWorkoutSessions\.length > 0/);
assert.match(html, /\|\| STATE\.calendarAeroDates\?\.has\(day\.date\)/);
assert.match(html, /function localDateKey\(value\)/);
assert.match(html, /const \[scheduledSessionsResult, completedSessionsResult, aeroResult\] = await Promise\.all\(\[/);
assert.match(html, /\.gte\("completed_at", `\$\{startDate\}T00:00:00\.000Z`\)/);
assert.match(html, /if \(scheduledSessionsResult\.error && completedSessionsResult\.error\)/);
assert.match(html, /if \(aeroResult\.error\)/);
assert.match(html, /const completedByDate = Object\.fromEntries\(allDays\.map\(day => \[day\.date, calendarDayCompletion\(day, today\)\]\)\)/);
assert.match(html, /function getPeriodizationCycleProgress\(weeks, today = todayISO\(\)\)/);
assert.match(html, /const startedWeeks = datedWeeks\.filter\(week => \{/);
assert.match(html, /return firstDay\?\.date <= today;/);
assert.match(html, /const cycleProgress = getPeriodizationCycleProgress\(weeks, today\);/);
assert.match(html, /\$\{cycleProgress\.elapsedWeeks\} de \$\{cycleProgress\.totalWeeks\} semanas/);
assert.match(html, /\$\{cycleProgress\.remainingWeeks\} sem\. restantes/);
assert.doesNotMatch(html, /const doneWeeks\s+= weeks\.filter/);

const helperSource = html.match(/function getPeriodizationCycleProgress\(weeks, today = todayISO\(\)\) \{[\s\S]*?\n\}\n\nfunction getPeriodizationDayBlocks/);
assert.ok(helperSource, "cycle progress helper must remain independently testable");
const cycleProgress = new Function(`${helperSource[0].replace(/\n\nfunction getPeriodizationDayBlocks$/, "")}\nreturn getPeriodizationCycleProgress;`)();
const weeks = Array.from({ length: 12 }, (_, index) => {
  const start = new Date(Date.UTC(2026, 5, 8 + (index * 7))).toISOString().slice(0, 10);
  return { num: index + 1, days: [{ date: start }] };
});
assert.deepEqual(cycleProgress(weeks, "2026-06-07"), { totalWeeks: 12, elapsedWeeks: 0, remainingWeeks: 12 });
assert.deepEqual(cycleProgress(weeks, "2026-07-29"), { totalWeeks: 12, elapsedWeeks: 8, remainingWeeks: 4 });
assert.deepEqual(cycleProgress(weeks, "2026-09-01"), { totalWeeks: 12, elapsedWeeks: 12, remainingWeeks: 0 });

// Apenas atividade programada pode contar como falta. Um bloco OFF legado não
// pode aparecer como atrasado nem reduzir o percentual do ciclo.
assert.match(html, /b\.workout_code && b\.workout_code !== "OFF"/);

// Estados do calendário: concluído verde e falta vermelho, legíveis no mobile.
assert.match(html, /\.day-pill\.is-done \{ border-color: var\(--green\)/);
assert.match(html, /\.day-pill\.is-late \{ border-color: var\(--red\)/);
assert.match(html, /completion\.state === "missed"/);
assert.match(html, /isDone \? \"is-done\" : isLate \? \"is-late\"/);
assert.match(html, /serviceWorker\.register\("\/sw\.js\?release=20260729-periodization-cycle-progress"\)/);

console.log("Calendar progress QA passed");
