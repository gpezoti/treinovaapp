import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");
const edge = fs.readFileSync("supabase/functions/rest-timer-push/index.ts", "utf8");
const sql = fs.readFileSync("sql/fix_beta_three_bugs_2026_05_08.sql", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260508000100_fix_beta_three_bugs.sql", "utf8");

assert.match(html, /async function mutateCompletedWorkoutSessionDirect\(action\)/);
assert.match(html, /async function afterCompletedWorkoutMutation\(action\)/);
assert.match(html, /await mutateCompletedWorkoutSessionDirect\(action\)/);

assert.match(html, /async function getCurrentPushSubscriptionPayload\(\)/);
assert.match(html, /body: \{ action: "test", subscription, user_agent: navigator\.userAgent \}/);
assert.match(html, /subscription,\s*user_agent: navigator\.userAgent/);

assert.match(html, /async function mergeAdminPaymentProfiles\(rows\)/);
assert.match(html, /async function mergeCoachPaymentProfiles\(rows\)/);
assert.match(html, /sb\.from\("v_admin_payments"\)\.select\("\*"\)/);
assert.match(html, /sb\.from\("v_coach_payments"\)/);

assert.match(edge, /function normalizePushSubscription\(input: any\)/);
assert.match(edge, /async function saveRequestSubscription\(userId: string, body: any\)/);
assert.match(edge, /await saveRequestSubscription\(user\.id, body\)/);
assert.match(edge, /onConflict: "endpoint"/);

assert.equal(sql, migration);
assert.match(sql, /create or replace function public\.manage_my_workout_session/);
assert.match(sql, /create view public\.v_coach_payments/);
assert.match(sql, /create view public\.v_admin_payments/);
assert.match(sql, /alter table public\.push_subscriptions/);

console.log("qa-beta-three-bugs ok");
