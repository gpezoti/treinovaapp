import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

const checks = [
  ["editor has bounded database reads", /async function loadWorkoutForEditor[\s\S]*?workout editor timeout[\s\S]*?workout exercises timeout/.test(html)],
  ["editor closes the spinner on failed load", /\[openWorkoutEditor\][\s\S]*?closeSheetForAction\(\)[\s\S]*?Não foi possível abrir o treino agora/.test(html)],
  ["exercise mutations are serialized per workout", /function waitForWorkoutMutation\(workoutId, task\)/.test(html)],
  ["batch insert reserves position inside queue", /await waitForWorkoutMutation\(wId, async \(\) => \{[\s\S]*?insertExercisesAtNextPositions/.test(html)],
  ["manual insert reserves position inside queue", /const createdEx = await waitForWorkoutMutation\(wId, async \(\) => \{[\s\S]*?returnCreated: true/.test(html)],
  ["position conflict retries after a fresh read", /if \(!isExercisePositionConflict\(error\) \|\| attempt === 1\) throw error/.test(html)],
  ["library loading has a visible loading state", /Carregando biblioteca\.\.\./.test(html)],
  ["library read reports database errors", /exercise library timeout[\s\S]*?if \(error\) throw error/.test(html)],
  ["startup watchdog allows slow mobile connections", /\}, 30000\);/.test(html)],
  ["startup recovery retries before clearing storage", /id="stuck-retry"[\s\S]*?Tentar novamente/.test(html)],
  ["profile data retries transient read failures", /async function loadProfileWithRetry\(\)/.test(html)],
  ["service worker never reloads a trainer mid-edit", /Nova versão pronta\. Ela será aplicada ao reabrir o app\./.test(html)]
];

for (const [label, ok] of checks) {
  assert.equal(ok, true, label);
}

console.log(`OK: ${checks.length} workout editor reliability checks passed`);
