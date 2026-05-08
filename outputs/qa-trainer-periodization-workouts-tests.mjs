import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");
const sql = fs.readFileSync("sql/trainer_periodization_types_sets_2026_05_08.sql", "utf8");

assert.match(html, /selectedPresetCode:\s*null/, "STATE must track the selected periodization preset");
assert.match(html, /function getTrainingScheme/, "Workout execution must resolve rules from periodization presets");
assert.match(html, /function getExerciseTargetSets/, "Exercise set count must be derived centrally");
assert.match(html, /target_reps:\s*getCurrentTrainingScheme\(\)\.reps/, "Set logs must store target reps from the periodization type");
assert.match(html, /const target = getExerciseTargetSets\(ex, scheme\)/, "Exercise cards must use periodization sets");
assert.match(html, /const target = getExerciseTargetSets\(ex, scheme\);[\s\S]*for \(let i = 0; i < target; i\+\+\)/, "Set table must render the periodization set count");
assert.match(html, /STATE\.adminWorkoutTab/, "Trainer workouts page must support tabs");
assert.match(html, /setAdminWorkoutTab\('periodization'\)/, "Trainer workouts page must expose periodization tab");
assert.match(html, /coach-finance-tabs[\s\S]*aria-label="Treinos do professor"/, "Trainer workouts tabs must reuse the finance tab component");
assert.match(html, /Esse código já existe/, "Duplicate periodization type codes must show a friendly validation message");
assert.match(html, /addSelectedExercisesToWorkout/, "Exercise picker must support adding multiple exercises");
assert.match(html, /new Set\(\)/, "Exercise picker must track multi-selection");
assert.doesNotMatch(html, /id="ne-sets"|id="ne-reps"|id="ne-pause"/, "New exercise form must not configure sets, reps, or pause");
assert.doesNotMatch(html, /id="ex-sets"|id="ex-reps"|id="ex-pause"/, "Exercise edit form must not configure sets, reps, or pause");
assert.match(sql, /add column if not exists sets_count integer/, "SQL must add sets_count to intensity_presets");
assert.match(sql, /add column if not exists active boolean/, "SQL must add active flag for soft delete");
assert.match(sql, /duration_minutes/, "SQL must support standalone periodization duration");

console.log("qa-trainer-periodization-workouts-tests: ok");
