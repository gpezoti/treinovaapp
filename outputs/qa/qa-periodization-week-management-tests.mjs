import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");
const sql = fs.readFileSync("sql/beta_periodization_week_management_2026_05_05.sql", "utf8");

function has(source, needle, message) {
  assert.ok(source.includes(needle), message || `Missing: ${needle}`);
}

has(html, "duplicatePeriodWeek", "periodization UI must expose duplicate week action");
has(html, "movePeriodWeek", "periodization UI must expose week reorder action");
has(html, "Duplicar", "week card must show duplicate label");
has(html, "↑ Subir", "week card must show move up action");
has(html, "↓ Descer", "week card must show move down action");
has(html, "STATE._periodWeekAction", "week actions must guard rapid repeated taps");
has(html, "Apenas professor pode organizar a periodização.", "frontend must block non-coach period management");
has(html, 'sb.rpc("duplicate_periodization_week"', "duplicate action must call atomic RPC");
has(html, 'sb.rpc("move_periodization_week"', "move action must call atomic RPC");

has(sql, "create or replace function public.duplicate_periodization_week", "duplicate RPC must exist");
has(sql, "create or replace function public.move_periodization_week", "move RPC must exist");
has(sql, "perform public.ensure_coach_owns_student", "RPCs must verify coach owns student");
has(sql, "insert into public.periodization_blocks", "duplicate must clone blocks with new IDs");
has(sql, "where day_id = d.id", "duplicate must clone source week blocks");
has(sql, "set date = v_temp_base + o.idx", "RPC must use temporary dates to avoid unique conflicts");
has(sql, "target.day_offset = source.day_offset", "move must preserve day order inside week");
has(sql, "grant execute on function public.duplicate_periodization_week", "duplicate RPC must be callable by authenticated users");
has(sql, "grant execute on function public.move_periodization_week", "move RPC must be callable by authenticated users");

console.log("Periodization week management static QA checks passed");
