import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");
const sql = fs.readFileSync("sql/social_feed_coach_training_2026_05_08.sql", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260508223000_social_feed_coach_training.sql", "utf8");

assert.equal(sql, migration, "migration must mirror sql script");

assert.match(html, /async function ensureCoachStudentFollows\(\)/);
assert.match(html, /safeLoad\("coach auto-follow", ensureCoachStudentFollows\)/);
assert.match(html, /window\.openSocialList = async function\(type\)/);
assert.match(html, /function renderSelfTrainingCard\(/);
assert.match(html, /\{ id: "feed", label: "Feed"/);
assert.match(html, /\{ id: "workout", label: "Treino"/);
assert.match(html, /profile\.role === "student" \|\| profile\.role === "coach"/);
assert.match(html, /full_name\.ilike\.%\$\{term\}%/);
assert.match(html, /email\.ilike\.%\$\{term\}%/);

assert.match(sql, /create policy "profiles approved social discovery"/);
assert.match(sql, /create policy "follows insert self"/);
assert.match(sql, /create or replace function public\.sync_coach_student_follow/);
assert.match(sql, /create trigger trg_profiles_sync_coach_student_follow/);
assert.match(sql, /insert into public\.follows \(follower_id, following_id\)\s+select p\.coach_id, p\.id/);
assert.match(sql, /create policy "feed social read"/);
assert.match(sql, /create policy "periodization days self manage"/);
assert.match(sql, /create policy "sessions self manage"/);
assert.match(sql, /create policy "setlogs self manage"/);

console.log("qa-social-feed-coach-training ok");
