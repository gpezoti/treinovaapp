import fs from "node:fs";
import assert from "node:assert/strict";

const migration = fs.readFileSync("supabase/migrations/20260602170000_periodization_week_bulk_rpcs.sql", "utf8");
const report = fs.readFileSync("outputs/migrations-hardening-audit-2026-06-02.md", "utf8");

function has(source, needle, message) {
  assert.ok(source.includes(needle), message || `Missing: ${needle}`);
}

has(migration, "create or replace function public.duplicate_periodization_week", "duplicate week RPC must be in an official migration");
has(migration, "create or replace function public.move_periodization_week", "move week RPC must be in an official migration");
has(migration, "perform public.ensure_coach_owns_student", "periodization bulk RPCs must call the current permission guard");
has(migration, "revoke all on function public.duplicate_periodization_week", "duplicate RPC must not be callable by public/anon");
has(migration, "revoke all on function public.move_periodization_week", "move RPC must not be callable by public/anon");
has(migration, "grant execute on function public.duplicate_periodization_week", "duplicate RPC must be callable by authenticated users");
has(migration, "grant execute on function public.move_periodization_week", "move RPC must be callable by authenticated users");

has(report, "P0-02 Migration/Hardening Audit", "hardening audit report must exist");
has(report, "Resultado final: todos os checks críticos retornaram `ok = true`.", "report must include remote verification result");
has(report, "20260602170000_periodization_week_bulk_rpcs", "report must mention the new periodization RPC migration");
has(report, "20260602153000", "report must preserve the previous social discovery hardening context");
has(report, "save_my_coach_branding", "report must include coach branding hardening verification");
has(report, "manual_sets_reps_overrides", "report must include manual set/reps override migration history repair");
has(report, "Nao aplicar em lote sem revalidacao", "report must warn against applying legacy SQL in bulk");

console.log("Migration hardening audit static QA checks passed");
