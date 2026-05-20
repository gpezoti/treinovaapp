import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");

assert.match(html, /instagram_handle: null/, "Branding state must include an Instagram handle field.");
assert.match(html, /function normalizeInstagramHandle\(raw\)/, "Instagram handles must be normalized before saving/rendering.");
assert.match(html, /id="br-instagram"/, "Coach branding settings must expose an Instagram input.");
assert.match(html, /patch\.instagram_handle = normalizeInstagramHandle/, "Coach branding save must persist normalized Instagram handle.");
assert.match(html, /const instagramHandle = normalizeInstagramHandle\(STATE\.branding && STATE\.branding\.instagram_handle\)/, "Share card must use the configured handle, not the app name.");
assert.doesNotMatch(html, /const handleName = \(\(STATE\.branding && STATE\.branding\.app_name\)/, "Share card must not auto-generate @ from app name.");
assert.match(html, /studentAvatarUrl: \(p\.student && p\.student\.avatar_url\)/, "Feed share payload must include the post owner's avatar.");
assert.match(html, /studentAvatarUrl: STATE\.profile\?\.avatar_url/, "Workout completion share payload must include the logged-in user's avatar.");
assert.match(html, /const studentAvatarImg = await loadCardImage\(meta\.studentAvatarUrl/, "Share card generator must load the user's avatar.");
assert.match(html, /function avatarHTML\(p\)[\s\S]*onerror="this\.parentElement\.textContent=this\.dataset\.fallback/, "Avatar HTML must fallback instead of showing a broken image icon.");

console.log("qa-social-share-design-tests: ok");
