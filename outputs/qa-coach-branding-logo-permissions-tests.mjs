import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");
const sql = fs.readFileSync("supabase/migrations/20260525103000_coach_branding_logo_permissions.sql", "utf8");
const rpcSql = fs.readFileSync("supabase/migrations/20260525144500_save_my_coach_branding_rpc.sql", "utf8");
const storageCompatSql = fs.readFileSync("supabase/migrations/20260525150500_branding_storage_upload_api_compat.sql", "utf8");

assert.match(html, /function brandingLogoPathPrefix\(\)/, "branding logo uploads must use a dedicated path helper");
assert.match(html, /STATE\.profile\?\.role === "coach"[\s\S]{0,120}return `\$\{userId\}\/logos`/, "coach logo uploads must be scoped to the trainer folder");
assert.match(html, /uploadImage\("branding", brandingLogoPathPrefix\(\), file, 512\)/, "logo upload must use the scoped branding path");
assert.match(html, /upsert: bucket === "branding" \? false : true/, "branding logo uploads should avoid Storage upsert/RLS update path");
assert.match(html, /Sem permiss[aã]o para enviar logo/, "branding permission errors should be actionable");
assert.match(html, /sb\.rpc\("save_my_coach_branding", \{ p_payload: patch \}\)/, "coach branding save should use the safe RPC first");
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

assert.match(rpcSql, /create or replace function public\.save_my_coach_branding\(p_payload jsonb/, "safe coach branding RPC must be created");
assert.match(rpcSql, /security definer/, "safe coach branding RPC must run as security definer");
assert.match(rpcSql, /v_uid uuid := auth\.uid\(\)/, "safe coach branding RPC must use auth.uid");
assert.match(rpcSql, /not public\.is_coach\(v_uid\)/, "safe coach branding RPC must require an approved coach");
assert.match(rpcSql, /'insert into public\.coach_branding \(%s\) values \(%s\)/, "safe coach branding RPC must upsert coach_branding");
assert.match(rpcSql, /using v_uid, coalesce\(p_payload/, "safe coach branding RPC must ignore caller-supplied coach_id");
assert.match(rpcSql, /grant execute on function public\.save_my_coach_branding\(jsonb\) to authenticated/, "safe coach branding RPC must be callable by authenticated users");

assert.match(storageCompatSql, /create policy "branding read public"/, "branding bucket objects should be readable for Storage upsert compatibility");
assert.match(storageCompatSql, /create policy "branding update legacy logos for approved coach"/, "legacy cached branding uploads need update compatibility");
assert.match(storageCompatSql, /public\.is_coach\(auth\.uid\(\)\)/, "legacy branding update compatibility must require approved coach");
assert.match(storageCompatSql, /storage\.foldername\(name\)\)\[1\] = 'logos'/, "legacy branding update compatibility must be limited to logos folder");

console.log("qa-coach-branding-logo-permissions-tests: ok");
