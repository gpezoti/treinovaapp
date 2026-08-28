import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const worker = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");

assert.match(html, /function scheduleOfflineWorkoutRetry\(\)/);
assert.match(html, /OFFLINE_WORKOUT_RETRY_MAX_DELAY_MS = 30_000/);
assert.match(html, /scheduleOfflineWorkoutRetry\(\);/);
assert.match(html, /onclick="retryOfflineWorkoutSync\(\)"/);
assert.match(html, /bundle\.profile\?\.id !== userId/);
assert.match(html, /function canUseOfflineStudentProfileForFailure\(userId, error\)/);
assert.match(html, /serviceWorker\.register\("sw\.js\?release=20260828-material-preview"\)/);
assert.match(worker, /v32-material-preview-20260828/);
assert.match(worker, /const APP_SCOPE = self\.registration\.scope/);
assert.ok(worker.includes("storage\\/v1\\/(?:object|render\\/image)\\/public\\/"));
assert.match(worker, /if \(isSupabaseHost && !isPublicSupabaseStorageAsset\)/);

console.log("Offline workout QA passed");
