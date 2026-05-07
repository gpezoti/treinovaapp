import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");
const sql = fs.readFileSync("sql/fix_workout_duration_cap_2026_05_07.sql", "utf8");

assert.match(html, /function calculateWorkoutDurationSeconds\(\)/);
assert.match(html, /const maxPlausible = 4 \* 60 \* 60/);
assert.match(html, /activeSpan \+ 10 \* 60/);
assert.match(html, /const duration = calculateWorkoutDurationSeconds\(\)/);
assert.doesNotMatch(html, /const duration = Math\.floor\(\(Date\.now\(\) - startedAt\) \/ 1000\)/);

assert.match(sql, /duration_seconds, 0\) > 14400/);
assert.match(sql, /extract\(epoch from \(sw\.last_done_at - sw\.first_done_at\)\)::int \+ 600/);
assert.match(sql, /set duration_seconds = r\.fixed_duration/);

console.log("QA workout duration checks passed.");
