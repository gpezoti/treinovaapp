import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const recoverySql = readFileSync(new URL("../sql/student_workout_session_recovery_2026_05_06.sql", import.meta.url), "utf8");
const paymentRlsSql = readFileSync(new URL("../supabase/migrations/20260512125000_restore_rls_payment_function_execute.sql", import.meta.url), "utf8");
const workoutBindingSql = readFileSync(new URL("../supabase/migrations/20260518193000_periodization_blocks_workout_binding.sql", import.meta.url), "utf8");

const checks = [
  ["workout code rules are centralized at 12 chars", /WORKOUT_CODE_MAX_LENGTH\s*=\s*12/.test(html) && /function normalizeWorkoutCodeValue/.test(html)],
  ["direct custom workout uses the same code limit as trainer library", /<input[^>]*id="nw-code"[^>]*maxlength="\$\{WORKOUT_CODE_MAX_LENGTH\}"/.test(html) && !/<input[^>]*id="nw-code"[^>]*maxlength="20"/.test(html)],
  ["direct custom workout placeholder has one comma-free example", /<input[^>]*id="nw-code"[^>]*placeholder="Ex: SUPERIOR2"/.test(html) && !/Ex: E, F, SUPERIOR2/.test(html)],
  ["custom workout validates code format", /WORKOUT_CODE_HELP_TEXT/.test(html) && /isValidWorkoutCodeValue\(code\)/.test(html)],
  ["custom workout save guard exists", /STATE\._savingWorkout/.test(html)],
  ["exercise add guard exists", /STATE\._addingExercise/.test(html)],
  ["exercise picker back button uses existing renderer", /onclick="_renderPickerFull\(\)"/.test(html)],
  ["stale renderExercisePicker reference removed", !/renderExercisePicker\(\)/.test(html)],
  ["exercise reorder function exists", /window\.moveExerciseInWorkout/.test(html)],
  ["period blocks support moving down", /moveBlock\('\$\{b\.id\}','\$\{dayId\}','\$\{studentId\}',1\)/.test(html)],
  ["periodization uses student available workout options", /loadPeriodWorkoutOptions/.test(html) && /STATE\._periodWorkoutOptions/.test(html)],
  ["periodization resolves cached students by student_id", /\(s\.student_id \|\| s\.id\) === studentId/.test(html)],
  ["student workouts prefer trainer model before legacy student clones", /chosen = list\.find\(w => w\.coach_id === studentCoachId && !w\.student_id\)[\s\S]*?\|\| list\.find\(w => w\.student_id === myId\)/.test(html)],
  ["periodization options prefer trainer model before legacy student clones", /map\[code\] = list\.find\(w => coachId && w\.coach_id === coachId && !w\.student_id\)[\s\S]*?\|\| list\.find\(w => w\.student_id === studentId\)/.test(html)],
  ["period blocks preserve exact workout binding", /insert\.workout_id = workoutOptions\?\.\[insert\.workout_code\]\?\.id \|\| null/.test(html) && /update\(\{ workout_code: workout \|\| null, workout_id: workoutId \|\| null \}\)/.test(html)],
  ["workout resolver prefers workout id over ambiguous code", /function resolveWorkoutRef\(workoutCode, workoutId = null\)[\s\S]*?STATE\.workoutsById\[workoutId\]/.test(html)],
  ["today workout preselection keeps workout id", /STATE\.selectedWorkoutId = info\.workout_id \|\| null/.test(html)],
  ["workout view backfills missing workout id from periodization", /if \(code && !STATE\.selectedWorkoutId\)[\s\S]*?STATE\.selectedWorkoutId = info\.workout_id/.test(html)],
  ["active workout can be from any date, not only today", /eq\("status", "in_progress"\)[\s\S]*?limit\(8\)/.test(html) && /getActiveWorkoutSessionForHome/.test(html)],
  ["starting selected workout abandons competing active sessions", /async function abandonOtherInProgressSessions\(session\)[\s\S]*?abandonInProgressSessionsForDate\(null, session\.id\)/.test(html) && /await abandonOtherInProgressSessions\(STATE\.currentSession\)/.test(html)],
  ["rest notification deep link carries real workout session", /function buildRestTimerWorkoutUrl\(context = \{\}\)[\s\S]*?params\.set\("sessionId"/.test(html) && /loadWorkoutSessionById\(restResume\.sessionId\)/.test(html)],
  ["periodization workout binding migration backfills trainer models first", /add column if not exists workout_id uuid/.test(workoutBindingSql) && /when w\.coach_id = student\.coach_id and w\.student_id is null then 1/.test(workoutBindingSql)],
  ["completed workout double-submit guard exists", /Treino já concluído/.test(html)],
  ["student can reopen completed workout today", /reopenCompletedWorkout/.test(html) && /Continuar treino/.test(html)],
  ["student can restart completed workout today", /restartCompletedWorkout/.test(html) && /Reiniciar treino de hoje/.test(html)],
  ["student can delete completed workout today", /deleteTodayCompletedWorkout/.test(html) && /Apagar treino concluído/.test(html)],
  ["completed workout recovery uses safe RPC", /manage_my_workout_session/.test(html) && /mutateCompletedWorkoutSessionDirect/.test(html)],
  ["workout start surfaces session creation errors", /Falha ao iniciar sessão/.test(html) && /Não foi possível iniciar treino/.test(html)],
  ["recovery SQL restricts to own today session", /student_id = auth\.uid\(\)/.test(recoverySql) && /date = current_date/.test(recoverySql)],
  ["recovery SQL supports reopen restart delete", /'reopen', 'restart', 'delete'/.test(recoverySql) && /delete from public\.set_logs/.test(recoverySql)],
  ["payment RLS helper can be executed by authenticated users", /grant execute on function public\.is_payment_ok\(uuid\) to authenticated, service_role/.test(paymentRlsSql)],
  ["payment RLS helper is scoped to current user", /uid = auth\.uid\(\)/.test(paymentRlsSql)],
  ["premium illustration fallback exists", /EXERCISE_ILLUSTRATION_PROMPTS/.test(html)],
  ["student can open exercise image fullscreen", /openExerciseImageViewer/.test(html) && /cursor:zoom-in/.test(html)],
  ["exercise video supports youtube embeds", /function getYouTubeEmbedUrl/.test(html) && /youtube\.com\/embed/.test(html) && /renderExerciseVideoEmbed/.test(html)],
  ["exercise edit accepts pasted video url", /id="ex-video-url"/.test(html) && /normalizeExerciseVideoUrl/.test(html) && /video_url:\s*videoUrl \|\| null/.test(html)],
  ["workout completion share icons are explicit", /<circle cx="8" cy="10" r="1\.4"\/>/.test(html) && /<path d="m11 9 4 3-4 3z"/.test(html)]
];

for (const [label, ok] of checks) {
  assert.equal(ok, true, label);
}

console.log(`OK: ${checks.length} focused training-flow checks passed`);
