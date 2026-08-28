import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const sw = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");

const checks = [
  ["student plan cache is scoped by user", /treinova_student_offline_bundle_v1/.test(html) && /parsed\?\.user_id === userId/.test(html)],
  ["plan contains workouts, periodization and presets", /workouts,[\s\S]*periodization:[\s\S]*presets:/.test(html)],
  ["offline boot hydrates plan and active workout", /hydrateOfflineStudentBundle\(STATE\.user\?\.id\);[\s\S]*hydrateOfflineWorkoutState\(STATE\.user\?\.id\)/.test(html)],
  ["exercise images are preloaded through the service worker", /function preloadStudentWorkoutAssets\(\)/.test(html) && /await navigator\.serviceWorker\.ready/.test(html)],
  ["sets update locally before network sync", /if \(isStudentOfflineEnabled\(\)\) \{[\s\S]*Object\.assign\(local, patch\);[\s\S]*queueOfflineSetLogUpsert\(local\)/.test(html)],
  ["workout completion is queued offline", /const completedSession = \{[\s\S]*queueOfflineSessionSync\(completedSession\)/.test(html)],
  ["pending changes flush on reconnect", /flushOfflineWorkoutSync\("online"\)/.test(html)],
  ["service worker precaches only the offline app shell", /const OFFLINE_APP_SHELL = \[[\s\S]*?supabase\.min\.js/.test(sw) && /caches\.open\(SHELL\)/.test(sw)],
  ["service worker does not cache Supabase API responses", /const isSupabaseHost = url\.hostname\.includes\("supabase\.co"\)/.test(sw) && /const isPublicSupabaseStorageAsset = isSupabaseHost/.test(sw) && /if \(isSupabaseHost && !isPublicSupabaseStorageAsset\) \{[\s\S]{0,80}return;/.test(sw) && !/fetch\(req\)\.catch\(\(\) => caches\.match\(req\)\)/.test(sw)]
];

for (const [label, ok] of checks) assert.equal(ok, true, label);

console.log(`Offline workout QA passed (${checks.length} checks).`);
