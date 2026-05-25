import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");
const sql = fs.readFileSync("supabase/migrations/20260525103000_coach_branding_logo_permissions.sql", "utf8");

assert.match(html, /function brandingLogoPathPrefix\(\)/, "branding logo uploads must use a dedicated path helper");
assert.match(html, /STATE\.profile\?\.role === "coach"[\s\S]{0,120}return `\$\{userId\}\/logos`/, "coach logo uploads must be scoped to the trainer folder");
assert.match(html, /uploadImage\("branding", brandingLogoPathPrefix\(\), file, 512\)/, "logo upload must use the scoped branding path");
assert.match(html, /Sem permiss[aã]o para enviar logo/, "branding permission errors should be actionable");
assert.match(html, /upsert\(\{ coach_id: STATE\.profile\.id,[\s\S]{0,160}\}, \{ onConflict: "coach_id" \}\)/, "coach branding save must target coach_id on conflict");

assert.match(sql, /insert into storage\.buckets \(id, name, public\)[\s\S]*values \('branding', 'branding', true\)/, "branding bucket must be ensured");
assert.match(sql, /drop policy if exists "branding upload staff"/, "old broad branding storage upload policy should be replaced");
assert.match(sql, /create policy "branding upload own coach logo or admin"/, "coach branding upload policy must exist");
assert.match(sql, /storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/, "coach branding storage writes must be folder-scoped");
assert.match(sql, /create policy "branding upload legacy logos for approved coach"/, "legacy branding uploads should keep stale PWAs working during update");
assert.match(sql, /storage\.foldername\(name\)\)\[1\] = 'logos'/, "legacy branding upload compatibility must be limited to logos folder");
assert.match(sql, /alter table public\.coach_branding enable row level security/, "coach_branding must have RLS enabled");
assert.match(sql, /create unique index if not exists coach_branding_coach_id_uidx/, "coach_branding upserts need a unique coach_id target");
assert.match(sql, /create policy "coach_branding coach update own"/, "coach must be able to update own branding");
assert.match(sql, /coach_id = auth\.uid\(\) and public\.is_coach\(auth\.uid\(\)\)/, "coach branding writes must be owner-scoped");
assert.match(sql, /create policy "coach_branding admin all"/, "admin must retain platform-level branding support");

console.log("qa-coach-branding-logo-permissions-tests: ok");
