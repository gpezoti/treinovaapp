import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");
const edge = fs.readFileSync("supabase/functions/admin-user/index.ts", "utf8");
const sql = fs.readFileSync("sql/fix_profiles_rls_admin_trainer_2026_05_07.sql", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260507213000_fix_profiles_rls_admin_trainer.sql", "utf8");
const fallbackSql = fs.readFileSync("sql/fix_admin_trainer_rpc_fallback_2026_05_07.sql", "utf8");

assert.match(sql, /create or replace function public\.app_profile_role/);
assert.match(sql, /security definer/);
assert.match(sql, /drop policy if exists "profiles self update"/);
assert.match(sql, /role = public\.app_profile_role\(auth\.uid\(\)\)/);
assert.match(sql, /create policy "profiles admin update all"/);
assert.equal(sql, migration);

assert.match(edge, /action === "update_trainer"/);
assert.match(edge, /action === "remove_trainer"/);
assert.match(edge, /sbAdmin\.auth\.admin\.updateUserById\(user_id, authPatch\)/);
assert.match(edge, /\.update\(\{ coach_id: null \}\)\s*\.eq\("coach_id", user_id\)/);
assert.match(edge, /ban_duration: "876000h"/);

assert.match(html, /id="et-password"/);
assert.match(html, /runAdminTrainerAction\("update_trainer"/);
assert.match(html, /runAdminTrainerAction\("remove_trainer"/);
assert.match(html, /sb\.rpc\("admin_update_trainer"/);
assert.match(html, /sb\.rpc\("admin_remove_trainer"/);
assert.doesNotMatch(html, /from\("profiles"\)\.update\(\{ status: "blocked", role: "student" \}\)\.eq\("id", id\)/);

assert.match(fallbackSql, /create or replace function public\.admin_update_trainer/);
assert.match(fallbackSql, /update auth\.users/);
assert.match(fallbackSql, /extensions\.crypt\(p_password/);
assert.match(fallbackSql, /create or replace function public\.admin_remove_trainer/);
assert.match(fallbackSql, /if not public\.is_admin\(auth\.uid\(\)\)/);

console.log("qa-admin-trainer-management ok");
