import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");
const sql = fs.readFileSync("sql/trainer_periodization_types_sets_2026_05_08.sql", "utf8");
const flexSql = fs.readFileSync("sql/fix_flex_period_and_push_subscription_2026_05_08.sql", "utf8");
const exerciseLibrarySql = fs.readFileSync("sql/exercise_library_curated_2026_05_08.sql", "utf8");
const exerciseLibraryDedupeSql = fs.readFileSync("supabase/migrations/20260519143000_exercise_library_dedupe_and_popular_ux.sql", "utf8");
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
assert.doesNotMatch(html, /isMobility\s*\?\s*renderMobBtn/, "Mobility exercises must render the period-driven set table");
assert.doesNotMatch(
  html.slice(html.indexOf("async function toggleSetDone"), html.indexOf("function onSerieCompleted")),
  /if \(!isMobility\)/,
  "Mobility exercises must use the same rest flow as other exercises"
);
assert.match(html, /STATE\.adminWorkoutTab/, "Trainer workouts page must support tabs");
assert.match(html, /setAdminWorkoutTab\('periodization'\)/, "Trainer workouts page must expose periodization tab");
assert.match(html, /setAdminWorkoutTab\('exercises'\)/, "Trainer workouts page must expose exercise library tab");
assert.match(html, /function renderExerciseLibraryManagerHTML/, "Exercise library manager must render inside trainer workouts page");
assert.match(html, /openLibraryExerciseSheet/, "Trainer must be able to create/edit library exercises");
assert.match(html, /deleteLibraryExercise/, "Trainer must be able to remove library exercises");
assert.match(html, /EXERCISE_LIBRARY_GROUPS/, "Exercise library must use standardized muscle groups");
assert.match(html, /function lockPageScrollForSheet/, "Open sheets must lock background page scroll");
assert.match(html, /unlockPageScrollForSheet/, "Closing sheets must restore page scroll");
assert.match(html, /exercise-library-group-scroll/, "Exercise category filters must have a stable scroll container");
assert.match(html, /_exerciseLibraryFilterScrollLeft/, "Exercise category filters must preserve horizontal scroll");
assert.match(html, /dedupeLibraryExercises/, "Exercise library must hide duplicate library rows in the UI");
assert.match(html, /EXERCISE_LIBRARY_MODES/, "Exercise library manager must expose focused list modes");
assert.match(html, /EXERCISE_LIBRARY_PAGE_SIZE\s*=\s*20/, "Exercise library should paginate in batches of 20");
assert.match(html, /POPULAR_LIBRARY_EXERCISE_NAMES/, "Exercise library must surface a curated popular exercise list");
assert.match(html, /toggleLibraryExerciseFavorite/, "Trainer must be able to favorite library exercises");
assert.match(html, /recordExerciseUsage/, "Exercise picker must learn the most used exercises per trainer");
assert.match(html, /Mais usados por você/, "Exercise picker must prioritize trainer-specific frequent exercises");
assert.match(html, /maybeLoadMoreExerciseLibrary/, "Exercise library must progressively load more cards on scroll");
assert.match(html, /exercise-library-sentinel/, "Exercise library must render a sentinel for infinite scrolling");
assert.match(html, /STATE\.exerciseLibraryHasMore \? `<div id="exercise-library-sentinel"/, "Exercise library sentinel must use the active pagination flag");
assert.doesNotMatch(html, /STATE\._exerciseLibraryHasMore/, "Exercise library must not use the old pagination flag");
assert.match(html, /document\.addEventListener\("scroll", onExerciseLibraryScroll, \{ passive: true, capture: true \}\)/, "Exercise library infinite scroll must work inside nested scroll containers");
assert.match(html, /STATE\._exerciseLibraryLoading = true/, "Exercise library tab should show loading state before the library query resolves");
assert.match(html, /function loadExerciseLibraryPage/, "Exercise library manager must fetch paginated rows from the backend");
assert.match(html, /mode === "favorites"[\s\S]*getExerciseFavoriteIds/, "Exercise library manager must keep the favorites filter available");
assert.doesNotMatch(html, /safeLoad\("exercise library", loadExerciseLibrary\)/, "Exercise library should not block the main sign-in boot flow");
assert.match(html, /coach-finance-tabs[\s\S]*aria-label="Treinos do treinador"/, "Trainer workouts tabs must reuse the finance tab component");
assert.match(html, /coach-finance-tabs coach-finance-tabs-3[\s\S]*aria-label="Treinos do treinador"/, "Trainer workouts tabs must fit 3 tabs on one row");
assert.match(html, /Esse código já existe/, "Duplicate periodization type codes must show a friendly validation message");
assert.match(html, /PERIOD_COLOR_OPTIONS/, "Period type colors must be selectable visually");
assert.match(html, /renderPeriodColorPicker/, "New/edit period type forms must use visual color picker");
assert.match(html, /<label class="form-label">Cor<\/label>/, "Period type forms must show a compact single color control");
assert.match(html, /q = q\.eq\("coach_id", myId\)\.is\("student_id", null\)/, "Coach workout models must only load the trainer's own models");
assert.match(html, /const scopedWorkouts = \(workouts \|\| \[\]\)\.filter/, "Workout loading must scope returned rows before reading exercises");
assert.doesNotMatch(html.slice(html.indexOf("async function loadPeriodWorkoutOptions"), html.indexOf("const grouped = {};")), /is_global\.eq\.true/, "Periodization workout options must not fall back to global workouts");
assert.match(html, /openEditWorkoutTypeSheet/, "Trainer must be able to edit workout model names");
assert.match(html, /saveWorkoutTypeName/, "Workout model name edits must persist to Supabase");
assert.match(html, /eq\("coach_id", STATE\.profile\.id\)\.is\("student_id", null\)/, "Coach workout rename must be scoped to owned model workouts");
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
assert.match(exerciseLibrarySql, /ACE Exercise Library, ExRx Exercise Directory e NASM Exercise Library/, "Curated exercise seed must document source taxonomy");
assert.match(exerciseLibrarySql, /'Seguir período'/, "Exercise library seed must not hard-code period training parameters");
assert.match(exerciseLibrarySql, /where is_library = true/, "Exercise library seed must normalize existing library rows");
assert.match(exerciseLibrarySql, /when lower\(muscle_group\) in \('peito'\) then 'Peito'/, "Exercise library seed must normalize legacy group labels");
assert.match(exerciseLibraryDedupeSql, /delete from public\.exercises/, "Exercise library dedupe migration must remove exact duplicate library rows");
assert.match(exerciseLibraryDedupeSql, /where is_library = true/, "Exercise library dedupe migration must be limited to library rows");
assert.match(exerciseLibraryDedupeSql, /'Seguir período'/, "Exercise library cleanup must preserve period-driven workout parameters");
assert.match(html, /renderPushSubscriptionCardHTML/, "Notification sheet must show production push status instead of test controls");
assert.doesNotMatch(notifSheet, /Teste bloqueado 15s|Testar agora|Diagnóstico push/, "Notification sheet must not expose push test controls");
assert.match(edgeFn, /request-subscription/, "Rest timer edge function must save subscriptions on login/permission renewal");

console.log("qa-trainer-periodization-workouts-tests: ok");
