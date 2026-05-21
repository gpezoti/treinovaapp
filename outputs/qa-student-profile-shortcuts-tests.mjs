import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

assert.match(html, /\.shortcut-view\s*\{/, "student shortcut shared layout CSS must exist");
assert.match(html, /function getProgressPhotoPath\(photo\)/, "progress photo storage path resolver must exist");
assert.match(html, /function resolveProgressPhotoUrl\(photo\)/, "progress photo URL resolver must exist");
assert.match(html, /createSignedUrl\(path,\s*60 \* 60\)/, "progress photos should support private bucket signed URLs");
assert.match(html, /async function loadProgressPhotos\(studentId = STATE\.profile\.id\)/, "progress photos should load through a guarded loader");
assert.match(html, /class="shortcut-loading"/, "progress menu should show a loading state");
assert.match(html, /class="shortcut-error"/, "progress menu should show an error state");
assert.match(html, /class="photo-grid"/, "progress gallery should use the polished grid");
assert.match(html, /data-full-url=/, "full photo preview should avoid unsafe inline URL interpolation");
assert.doesNotMatch(html, /p\.url\.split\('\/'\)\.slice\(-2\)/, "delete should not derive storage path from the last URL segments");
assert.doesNotMatch(html, /Histórico \(últimos 20\)/, "student profile should not duplicate workout history because feed is the history surface");
assert.doesNotMatch(html, /let historyHTML = "";/, "student profile should not build a dedicated workout history list");
assert.doesNotMatch(html, /Sem treinos concluídos ainda\. Bora começar!/, "student profile should not render the old empty history block");
assert.match(html, /function calculateWorkoutStreak\(hist, today = todayISO\(\)\)/, "student profile must use a dedicated workout streak calculator");
assert.match(html, /if \(dateDiffDaysISO\(today, latest\) > 1\) return 0;/, "streak should only expire after more than one missed day");
assert.match(html, /const streak = calculateWorkoutStreak\(hist\);/, "profile progress summary must use the streak calculator");
assert.doesNotMatch(html, /[\u{1F300}-\u{1FAFF}]/u, "visible emoji characters should be removed from source UI strings in favor of SVG icons or initials");
assert.match(html, /function iconSvg\(name, size = 18, extra = ""\)/, "shared SVG icon helper should replace emoji decoration");
assert.match(html, /const FEED_REACTION_OPTIONS = \[/, "feed reactions must keep their social reaction options");
assert.match(html, /function feedReactionEmojiHTML\(key, size = 18\)/, "feed reactions should render as emojis by product choice");
assert.doesNotMatch(html, /function feedReactionIconHTML/, "feed reactions should not use generic icons");
assert.match(html, /root\.removeAttribute\("data-dismissable"\)/, "sheets should reset dismissable behavior by default");
assert.match(html, /root\.dataset\.dismissable !== "true"/, "only explicitly dismissable sheets should close on outside tap");
assert.match(html, /setAttribute\("data-dismissable", "true"\)/, "reaction picker should close when tapping outside");
assert.doesNotMatch(html, /1777323170543\.jpg/, "app shell should not flash the old hardcoded Supabase branding image");
assert.doesNotMatch(html, /supabase\.co\/storage\/v1\/object\/public\/branding\/logos/, "app shell should not depend on remote hardcoded branding fallback");
assert.match(html, /id="brand-logo"[\s\S]*?\/assets\/icon-192\.png\?v=20260505/, "mobile header should start with the local Treinova logo while branding loads");
assert.match(html, /id="desktop-brand-logo"[\s\S]*?\/assets\/icon-192\.png\?v=20260505/, "desktop header should start with the local Treinova logo while branding loads");
assert.match(html, /data-fallback="\$\{fallback\}"/, "dynamic branding images should fall back to initials on load error");
assert.match(html, /profile history timeout/, "student profile should not stay stuck forever while progress history loads");
assert.match(html, /Seu histórico aparece aqui depois do primeiro treino concluído\./, "student profile progress card should have a useful empty state");
assert.match(html, /<button class="mini-btn mini-btn-ghost" onclick="navTo\('feed'\)">Abrir feed<\/button>/, "student profile social counts should have a direct feed action");
assert.doesNotMatch(html, /Light\s*\n\s*<svg[\s\S]{0,500}?Light/, "profile theme selector should not render the Light button content twice");

for (const fn of ["renderHistory", "renderRanking", "renderProgress", "renderAero", "renderOneRM"]) {
  assert.ok(html.includes(`async function ${fn}(`), `${fn} should be present`);
}

console.log("Student shortcut and progress photo static QA checks passed");
