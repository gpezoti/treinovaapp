import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");
const sql = fs.readFileSync("supabase/migrations/20260602170000_periodization_week_bulk_rpcs.sql", "utf8");

function has(source, needle, message) {
  assert.ok(source.includes(needle), message || `Missing: ${needle}`);
}

has(html, "duplicatePeriodWeek", "periodization UI must expose duplicate week action");
has(html, "movePeriodWeek", "periodization UI must expose week reorder action");
has(html, "Duplicar", "week card must show duplicate label");
has(html, "↑ Subir", "week card must show move up action");
has(html, "↓ Descer", "week card must show move down action");
has(html, "STATE._periodWeekAction", "week actions must guard rapid repeated taps");
has(html, "Apenas treinador pode organizar a periodização.", "frontend must block non-coach period management");
has(html, 'sb.rpc("duplicate_periodization_week"', "duplicate action must call atomic RPC");
has(html, 'sb.rpc("move_periodization_week"', "move action must call atomic RPC");
has(html, "duplicatePeriodWeekClientFallback", "duplicate action must have client fallback if RPC is missing");
has(html, "movePeriodWeekClientFallback", "move action must have client fallback if RPC is missing");
has(html, "loadPeriodDaysOrdered", "fallback must load ordered periodization days");
has(html, "updatePeriodDayDate", "fallback must persist reordered dates");
has(html, "STATE._periodDaysByStudent", "period editor must cache ordered days for faster navigation");
has(html, "dias configurados", "week cards must summarize configured days");
has(html, "summarizePeriodDayBlocks", "day pills must expose richer block summaries");
has(html, "falta treino", "day summaries must flag workout blocks missing a workout");
has(html, "sem bloco", "day summaries must identify empty days");
has(html, "← Dia", "day editor must expose previous day navigation");
has(html, "Dia →", "day editor must expose next day navigation");
has(html, "applyDayToSameWeekday", "day editor must expose bulk weekday apply");
has(html, "Aplicar este dia em toda", "day editor must label weekday bulk action");
has(html, "openRepeatPeriodWeekSheet", "week card must expose repeat-week action");
has(html, "repeatPeriodWeek", "week repetition flow must exist");
has(html, "replacePeriodDayBlocks", "bulk periodization actions must reuse one safe block replacement helper");
has(html, "mantendo os blocos já configurados nos dias preservados", "period config must explain that kept days preserve blocks");
has(html, "const overlap = Math.min(existingDays.length, targetDates.length)", "period config must preserve overlapping days instead of recreating all");
has(html, "const tempBase = \"2700-01-01\"", "period config must use temporary dates to avoid unique collisions");
has(html, "periodization_blocks\").insert(blockRows)", "fallback duplicate must clone periodization blocks");
has(html, "console.warn(\"duplicate_periodization_week RPC falhou; usando fallback client-side\"", "duplicate must visibly fall back after RPC error");
has(html, "console.warn(\"move_periodization_week RPC falhou; usando fallback client-side\"", "move must visibly fall back after RPC error");

has(sql, "create or replace function public.duplicate_periodization_week", "duplicate RPC must exist");
has(sql, "create or replace function public.move_periodization_week", "move RPC must exist");
has(sql, "perform public.ensure_coach_owns_student", "RPCs must verify coach owns student");
has(sql, "insert into public.periodization_blocks", "duplicate must clone blocks with new IDs");
has(sql, "where day_id = d.id", "duplicate must clone source week blocks");
has(sql, "set date = v_temp_base + o.idx", "RPC must use temporary dates to avoid unique conflicts");
has(sql, "target.day_offset = source.day_offset", "move must preserve day order inside week");
has(sql, "grant execute on function public.duplicate_periodization_week", "duplicate RPC must be callable by authenticated users");
has(sql, "grant execute on function public.move_periodization_week", "move RPC must be callable by authenticated users");
has(sql, "revoke all on function public.duplicate_periodization_week", "duplicate RPC must not be public/anon callable");
has(sql, "revoke all on function public.move_periodization_week", "move RPC must not be public/anon callable");

console.log("Periodization week management static QA checks passed");
