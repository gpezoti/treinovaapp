import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");

assert.match(html, /function coachChecklistStudentIds\(\)/);
assert.match(html, /async function refreshCoachPeriodizationChecklist\(\)/);
assert.match(html, /typeof s\.has_periodization === "boolean"/);
assert.match(html, /\.from\("periodization_days"\)\s*\.select\("student_id"\)/);
assert.match(html, /openCoachFirstStudentPeriodization\(\)/);
assert.doesNotMatch(html, /const hasPeriod = \(STATE\.students \|\| \[\]\)\.some\(s => Number\(s\.sessions_done \|\| 0\) > 0 \|\| s\.last_session_at\)/);

assert.match(html, /const parentNav = HOME_SUBVIEWS\.includes\(view\) \|\| view === "calendar" \? "home" : view/);
assert.match(html, /STATE\._focusCurrentCalendarWeek = true/);
assert.match(html, /if \(STATE\._focusCurrentCalendarWeek\) \{[\s\S]*scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
assert.match(html, /Seu ciclo ainda não está configurado/);
assert.match(html, /Falar com treinador/);
assert.match(html, /Dicas para seu treino/);
assert.match(html, /id="toast" role="status" aria-live="polite" aria-atomic="true"/);

const migration = fs.readFileSync("supabase/migrations/20260712120000_coach_student_periodization_summary.sql", "utf8");
assert.match(migration, /create index if not exists idx_periodization_days_student_id/);
assert.match(migration, /as has_periodization/);
assert.match(migration, /security_invoker = true/);

console.log("Navigation, agenda and coach checklist UX QA passed.");
