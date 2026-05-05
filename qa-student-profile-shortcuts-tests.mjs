import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

assert.match(html, /\.shortcut-view\s*\{/, "student shortcut shared layout CSS must exist");
assert.match(html, /function getProgressPhotoPath\(photo\)/, "progress photo storage path resolver must exist");
assert.match(html, /function resolveProgressPhotoUrl\(photo\)/, "progress photo URL resolver must exist");
assert.match(html, /createSignedUrl\(path,\s*60 \* 60\)/, "progress photos should support private bucket signed URLs");
assert.match(html, /function loadProgressPhotos\(\)/, "progress photos should load through a guarded loader");
assert.match(html, /class="shortcut-loading"/, "progress menu should show a loading state");
assert.match(html, /class="shortcut-error"/, "progress menu should show an error state");
assert.match(html, /class="photo-grid"/, "progress gallery should use the polished grid");
assert.match(html, /data-full-url=/, "full photo preview should avoid unsafe inline URL interpolation");
assert.doesNotMatch(html, /p\.url\.split\('\/'\)\.slice\(-2\)/, "delete should not derive storage path from the last URL segments");

for (const fn of ["renderHistory", "renderRanking", "renderProgress", "renderAero", "renderOneRM"]) {
  assert.ok(html.includes(`async function ${fn}(`), `${fn} should be present`);
}

console.log("Student shortcut and progress photo static QA checks passed");
