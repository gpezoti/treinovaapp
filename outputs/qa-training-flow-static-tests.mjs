import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const recoverySql = readFileSync(new URL("../sql/student_workout_session_recovery_2026_05_06.sql", import.meta.url), "utf8");

const checks = [
  ["custom workout validates code format", /Use apenas letras, números, _ ou - no código/.test(html)],
  ["custom workout save guard exists", /STATE\._savingWorkout/.test(html)],
  ["exercise add guard exists", /STATE\._addingExercise/.test(html)],
  ["exercise picker back button uses existing renderer", /onclick="_renderPickerFull\(\)"/.test(html)],
  ["stale renderExercisePicker reference removed", !/renderExercisePicker\(\)/.test(html)],
  ["exercise reorder function exists", /window\.moveExerciseInWorkout/.test(html)],
  ["period blocks support moving down", /moveBlock\('\$\{b\.id\}','\$\{dayId\}','\$\{studentId\}',1\)/.test(html)],
  ["periodization uses available workout codes", /Object\.keys\(STATE\.workouts \|\| \{\}\)/.test(html)],
  ["completed workout double-submit guard exists", /Treino já concluído/.test(html)],
  ["student can reopen completed workout today", /reopenCompletedWorkout/.test(html) && /Continuar treino/.test(html)],
  ["student can restart completed workout today", /restartCompletedWorkout/.test(html) && /Reiniciar treino de hoje/.test(html)],
  ["student can delete completed workout today", /deleteTodayCompletedWorkout/.test(html) && /Apagar treino concluído/.test(html)],
  ["completed workout recovery uses safe RPC", /manage_my_workout_session/.test(html) && /mutateCompletedWorkoutSessionDirect/.test(html)],
  ["recovery SQL restricts to own today session", /student_id = auth\.uid\(\)/.test(recoverySql) && /date = current_date/.test(recoverySql)],
  ["recovery SQL supports reopen restart delete", /'reopen', 'restart', 'delete'/.test(recoverySql) && /delete from public\.set_logs/.test(recoverySql)],
  ["premium illustration fallback exists", /EXERCISE_ILLUSTRATION_PROMPTS/.test(html)]
];

for (const [label, ok] of checks) {
  assert.equal(ok, true, label);
}

console.log(`OK: ${checks.length} focused training-flow checks passed`);
