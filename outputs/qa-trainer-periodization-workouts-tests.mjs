import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");
const sql = fs.readFileSync("sql/trainer_periodization_types_sets_2026_05_08.sql", "utf8");
const flexSql = fs.readFileSync("sql/fix_flex_period_and_push_subscription_2026_05_08.sql", "utf8");
const edgeFn = fs.readFileSync("supabase/functions/rest-timer-push/index.ts", "utf8");
const notifSheet = html.slice(
  html.indexOf("window.openNotificationsSheet"),
  html.indexOf("function renderPushSubscriptionCardHTML")
);

assert.match(html, /selectedPresetCode:\s*null/, "STATE must track the selected periodization preset");
assert.match(html, /function getTrainingScheme/, "Workout execution must resolve rules from periodization presets");
assert.match(html, /function getExerciseTargetSets/, "Exercise set count must be derived centrally");
assert.match(html, /STATE\.profile\.role === "student" \? STATE\.profile\.coach_id/, "Students must load coach-specific periodization presets");
assert.match(html, /resolvePresetForWorkoutDate/, "Workout open flow must recover the linked period type");
assert.match(html, /target_reps:\s*getCurrentTrainingScheme\(\)\.reps/, "Set logs must store target reps from the periodization type");
assert.match(html, /const target = getExerciseTargetSets\(ex, scheme\)/, "Exercise cards must use periodization sets");
assert.match(html, /const target = getExerciseTargetSets\(ex, scheme\);[\s\S]*for \(let i = 0; i < target; i\+\+\)/, "Set table must render the periodization set count");
assert.match(html, /STATE\.adminWorkoutTab/, "Trainer workouts page must support tabs");
assert.match(html, /setAdminWorkoutTab\('periodization'\)/, "Trainer workouts page must expose periodization tab");
assert.match(html, /coach-finance-tabs[\s\S]*aria-label="Treinos do professor"/, "Trainer workouts tabs must reuse the finance tab component");
assert.match(html, /Esse código já existe/, "Duplicate periodization type codes must show a friendly validation message");
assert.match(html, /PERIOD_COLOR_OPTIONS/, "Period type colors must be selectable visually");
assert.match(html, /renderPeriodColorPicker/, "New/edit period type forms must use visual color picker");
assert.match(html, /addSelectedExercisesToWorkout/, "Exercise picker must support adding multiple exercises");
assert.match(html, /new Set\(\)/, "Exercise picker must track multi-selection");
assert.doesNotMatch(html, /id="ne-sets"|id="ne-reps"|id="ne-pause"/, "New exercise form must not configure sets, reps, or pause");
assert.doesNotMatch(html, /id="ex-sets"|id="ex-reps"|id="ex-pause"/, "Exercise edit form must not configure sets, reps, or pause");
assert.match(sql, /add column if not exists sets_count integer/, "SQL must add sets_count to intensity_presets");
assert.match(sql, /add column if not exists active boolean/, "SQL must add active flag for soft delete");
assert.match(sql, /duration_minutes/, "SQL must support standalone periodization duration");
assert.match(flexSql, /where code = 'flex'/, "Flex period data migration must target flex");
assert.match(flexSql, /sets_count = 3/, "Flex period must default to 3 sets");
assert.match(flexSql, /pause_seconds = 60/, "Flex period must default to 60s rest");
assert.match(html, /renderPushSubscriptionCardHTML/, "Notification sheet must show production push status instead of test controls");
assert.doesNotMatch(notifSheet, /Teste bloqueado 15s|Testar agora|Diagnóstico push/, "Notification sheet must not expose push test controls");
assert.match(edgeFn, /request-subscription/, "Rest timer edge function must save subscriptions on login/permission renewal");

console.log("qa-trainer-periodization-workouts-tests: ok");
