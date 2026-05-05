import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

const checks = [
  ["gallery input exists without capture", /id="pp-gallery-file" accept="image\/\*" style="display:none"/.test(html)],
  ["camera input exists with capture", /id="pp-camera-file" accept="image\/\*" capture="environment"/.test(html)],
  ["selected file state is used for save", /let selectedFile = null[\s\S]*const file = selectedFile/.test(html)],
  ["save button enables after selection", /btn\.disabled = false;\s*btn\.textContent = "Salvar foto"/.test(html)],
  ["upload has timeout", /progress photo upload timeout/.test(html)],
  ["database save has timeout", /progress photo save timeout/.test(html)],
  ["record stores current date", /date: todayISO\(\)/.test(html)],
  ["storage path fallback helper exists", /async function insertProgressPhotoRecord\(payload, storagePath\)/.test(html)],
  ["photo loading has timeout", /progress photos load timeout/.test(html)],
  ["photo url resolving is safe", /safeLoad\("progress photo url"/.test(html)]
];

for (const [label, ok] of checks) {
  assert.equal(ok, true, label);
}

console.log(`OK: ${checks.length} progress photo upload checks passed`);
