import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");
const migration = fs.readFileSync(
  "supabase/migrations/20260711231200_single_active_workout_session.sql",
  "utf8"
);

assert.match(html, /const localSession = \{[\s\S]*?id: createOfflineUuid\(\),[\s\S]*?status: "in_progress"/);
assert.match(html, /queueOfflineSessionSync\(localSession\)/);
assert.match(html, /sb\.from\("sessions"\)\.upsert\(pendingSession\.row, \{ onConflict: "id" \}\)/);
assert.match(html, /await abandonOtherInProgressSessions\(active\)/);
assert.match(html, /activeRows\.find\(s => String\(s\.id\) === String\(STATE\.currentSession\.id\)\)/);
assert.doesNotMatch(html, /list\.find\(s => s\.status === "completed"\)\s*\|\| list\[0\]/);
assert.match(migration, /row_number\(\) over/);
assert.match(migration, /where status = 'in_progress'/);
assert.match(migration, /sessions_one_in_progress_per_student_uidx/);
assert.match(migration, /revoke execute on function %s from anon/);

console.log("Single active workout session QA passed.");
