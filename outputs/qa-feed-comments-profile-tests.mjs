import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");

assert.match(html, /async function hydrateCommentAuthors\(comments = \[\]\)/, "Comments must explicitly hydrate author profiles.");
assert.match(html, /const profilesById = await loadSocialProfilesByIds\(ids\)/, "Comment author hydration must use the social profile resolver by user_id.");
assert.match(html, /function getCommentAuthorFallback\(userId\)/, "Comments must fallback to the logged-in profile for newly inserted comments.");
assert.match(html, /function renderCommentItems\(comments = \[\], postId\)/, "Comment rendering must be centralized.");
assert.match(html, /const authorName = personDisplayName\(a, "Usuário"\)/, "Comment names must use the normalized profile display name.");
assert.match(html, /\.select\("id, post_id, user_id, content, created_at"\)/, "Comment loading should not depend on implicit profile joins.");
assert.doesNotMatch(html, /author:profiles\(id, full_name, avatar_emoji, avatar_url\)/, "Comment loading must not rely on the old implicit author join.");
assert.match(html, /#cm-overlay\{position:fixed;top:var\(--vv-top\).*height:var\(--vv-height\)/s, "Comments sheet must use visual viewport to avoid keyboard pushing the page.");
assert.match(html, /#cm-overlay \.cm-card\{.*height:min\(56vh,calc\(var\(--vv-height\) \* \.58\)\)/s, "Comments sheet should open around half the screen.");

console.log("qa-feed-comments-profile-tests: ok");
