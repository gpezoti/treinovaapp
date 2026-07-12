import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");

assert.match(html, /const canEdit = \["coach", "admin"\]\.includes\(STATE\.profile\?\.role\);/);
assert.match(html, /Programação definida pelo seu treinador/);
assert.match(html, /canEdit \? `\<div class="period-toolbar"/);
assert.match(html, /canEdit \? `\<div class="period-week-actions"/);
assert.match(html, /canEdit \? `\n      \<div style="font-size:12px;font-weight:700;color:var\(--text-3\).*Ações em massa/s);
assert.match(html, /canEdit \? `\n      \<div style="font-size:12px;font-weight:700;color:var\(--text-3\).*\+ Adicionar bloco/s);
assert.match(html, /renderBlockItem\(b, idx, dayId, studentId, \(blocks\|\|\[\]\)\.length, periodWorkoutOptions, canEdit\)/);
assert.match(html, /if \(!canEditPeriodization\(\)\) return;/);
assert.match(html, /renderPeriodizationLoadError/);
assert.match(html, /if \(error\) throw error;/);

console.log("Student periodization read-only UX QA passed.");
