import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync("index.html", "utf8");
const sql = readFileSync("supabase/migrations/20260526100000_manual_sets_reps_overrides.sql", "utf8");

assert.match(sql, /add column if not exists sets_override integer/, "Exercise rows must support trainer-level set overrides");
assert.match(sql, /add column if not exists reps_override text/, "Exercise rows must support trainer-level rep overrides");
assert.match(sql, /add column if not exists exercise_overrides jsonb/, "Sessions must support student-level runtime overrides");
assert.match(sql, /sessions_exercise_overrides_object/, "Session overrides must stay a JSON object");

assert.match(html, /function getExerciseBaseTargetSets/, "Default set count must remain centralized");
assert.match(html, /function getExerciseTargetSets\(ex, scheme = getCurrentTrainingScheme\(\), logs = null\)/, "Runtime set count must consider overrides and logs");
assert.match(html, /function getExerciseTargetReps/, "Runtime rep target must be resolved centrally");
assert.match(html, /target_reps:\s*getExerciseTargetReps/, "New set logs must store the effective target reps");
assert.match(html, /window\.addManualSet/, "Student must be able to add a set during an active workout");
assert.match(html, /window\.removeManualSet/, "Student must be able to remove the last set during an active workout");
assert.match(html, /window\.onRepsChange/, "Student must be able to edit reps per set");
assert.match(html, /id="ex-sets-override"/, "Trainer exercise editor must expose set override");
assert.match(html, /id="ex-reps-override"/, "Trainer exercise editor must expose rep override");
assert.match(html, /sets_override:\s*setsOverride/, "Trainer set override must persist to Supabase");
assert.match(html, /reps_override:\s*repsOverride \|\| null/, "Trainer rep override must persist to Supabase");
assert.match(html, /ajuste carga, reps ou séries se necessário/, "Workout UI must explain manual flexibility");
assert.match(html, /Inicie o treino para editar carga, reps e séries/, "Workout UI must avoid creating logs before a session starts");

console.log("qa-manual-sets-reps-overrides-tests: ok");
