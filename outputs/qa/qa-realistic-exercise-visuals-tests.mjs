import { readFileSync, statSync } from "node:fs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const promptPack = readFileSync(new URL("./exercise-realistic-image-prompts.md", import.meta.url), "utf8");

assert.match(html, /REALISTIC_EXERCISE_VISUAL_DIRECTION/, "realistic visual direction should be defined");
assert.match(html, /EXERCISE_REALISTIC_IMAGE_PROMPTS/, "realistic prompt mapping should exist");
assert.match(html, /assets\/exercises\/realistic_barbell_squat\.webp/, "squat should map to a realistic WebP asset path");
assert.match(html, /getStandardExerciseAssetUrl/, "standard exercise assets should resolve to WebP paths");
assert.match(html, /data-fallback-src=/, "missing WebP assets should have a safe fallback");
assert.match(html, /teacher.*custom|imagem própria do professor/i, "teacher custom images should remain the priority");
assert.doesNotMatch(html, /premium soft 3D minimalist style/, "old soft-3D prompt style should not remain active");

const expectedAssets = [
  "realistic_barbell_squat.webp",
  "realistic_leg_press.webp",
  "realistic_walking_lunge.webp",
  "realistic_hip_thrust.webp",
  "realistic_deadlift.webp",
  "realistic_bench_press.webp",
  "realistic_chest_fly.webp",
  "realistic_dumbbell_row.webp",
  "realistic_lat_pulldown.webp",
  "realistic_shoulder_press.webp",
  "realistic_lateral_raise.webp",
  "realistic_biceps_curl.webp",
  "realistic_triceps_pushdown.webp",
  "realistic_forearm_plank.webp",
  "realistic_abdominal_crunch.webp",
  "realistic_calf_raise.webp",
  "realistic_mobility_stretch.webp",
  "realistic_functional_strength.webp"
];

for (const asset of expectedAssets) {
  assert.match(html, new RegExp(asset.replace(".", "\\.")), `${asset} should be mapped in the app`);
  assert.match(promptPack, new RegExp(asset.replace(".", "\\.")), `${asset} should have a generation prompt`);
  const file = new URL(`../assets/exercises/${asset}`, import.meta.url);
  assert.ok(statSync(file).size > 8000, `${asset} should be a non-empty optimized raster asset`);
  const info = execFileSync("file", [fileURLToPath(file)], { encoding: "utf8" });
  assert.match(info, /Web\/P image.*640x640/, `${asset} should be a 640x640 WebP`);
}

console.log("Realistic exercise visual static QA checks passed");
