import fs from "node:fs";
import assert from "node:assert/strict";

const index = fs.readFileSync("index.html", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260714180350_app_observability.sql", "utf8");
const edge = fs.readFileSync("supabase/functions/app-observability/index.ts", "utf8");
const signup = fs.readFileSync("supabase/functions/platform-signup/index.ts", "utf8");

for (const marker of [
  "function reportOperationalEvent",
  "function operationalErrorKind",
  "workout_session_started",
  "workout_completed",
  "rest_push_schedule_failed",
  "checkout_started",
  "window.refreshOperationalHealth",
  'safeLoad("operational health", loadOperationalHealth, 7000)',
]) {
  assert.ok(index.includes(marker), `index.html: missing ${marker}`);
}

for (const marker of [
  "create table if not exists public.app_event_log",
  "alter table public.app_event_log enable row level security",
  "revoke all on table public.app_event_log from anon, authenticated",
  "create or replace function public.get_admin_operational_health",
  "security definer",
  "public.is_admin((select auth.uid()))",
  "grant execute on function public.get_admin_operational_health(integer) to authenticated, service_role",
]) {
  assert.ok(migration.includes(marker), `migration: missing ${marker}`);
}

for (const marker of [
  "const EVENT_NAMES = new Set",
  "const since = new Date(Date.now() - 60_000).toISOString()",
  "if ((count || 0) >= 60)",
  "function safeDetails",
  'for (const key of ["source", "load", "error_kind", "view", "action"])',
  ".replace(/https?:\\/\\/\\S+/gi, \"[url]\")",
  ".replace(/[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}/g, \"[email]\")",
]) {
  assert.ok(edge.includes(marker), `app-observability: missing ${marker}`);
}

assert.ok(signup.includes('event_name: "signup_completed"'), "platform signup must log successful public trials");
assert.ok(!edge.includes("full_name"), "app-observability must not persist names");
assert.ok(!edge.includes("email:"), "app-observability must not persist emails");

console.log("qa-observability-tests: OK");
