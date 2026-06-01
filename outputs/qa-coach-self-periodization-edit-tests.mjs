import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");
const migration = readFileSync("supabase/migrations/20260601124500_coach_self_periodization_edit.sql", "utf8");

assert.ok(
  html.includes("openStudentPeriodSheet('${STATE.profile.id}')\">Editar ciclo"),
  "Coach self-training card must open the editable periodization sheet after the cycle exists"
);
assert.ok(
  html.includes("<div class=\"today-title\">Dia OFF</div>") &&
    html.includes("openStudentPeriodSheet('${STATE.profile.id}')\">Editar ciclo"),
  "Coach OFF day card must still expose periodization editing"
);

assert.ok(
  migration.includes("create or replace function public.can_manage_periodization_student"),
  "Migration must provide a shared permission helper for periodization edits"
);
assert.ok(
  migration.includes("p_student_id = auth.uid()") &&
    migration.includes("and public.is_coach(auth.uid())"),
  "Permission helper must allow a coach to edit his own periodization"
);
assert.ok(
  migration.includes("s.role = 'student'") &&
    migration.includes("s.coach_id = auth.uid()"),
  "Permission helper must still allow a coach to edit only his own students"
);
assert.ok(
  migration.includes("perform public.ensure_coach_owns_student(p_student_id);"),
  "Week RPCs must validate permission before mutating periodization"
);
assert.ok(
  migration.includes('create policy "periodization days coach self edit"') &&
    migration.includes('create policy "periodization blocks coach self edit"'),
  "RLS policies must explicitly cover coach self periodization days and blocks"
);

console.log("Coach self periodization edit QA checks passed");
