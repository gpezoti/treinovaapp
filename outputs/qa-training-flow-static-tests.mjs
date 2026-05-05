import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

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
  ["premium illustration fallback exists", /EXERCISE_ILLUSTRATION_PROMPTS/.test(html)]
];

for (const [label, ok] of checks) {
  assert.equal(ok, true, label);
}

console.log(`OK: ${checks.length} focused training-flow checks passed`);
